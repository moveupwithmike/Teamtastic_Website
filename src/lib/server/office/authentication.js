"use server";

import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { officeAllowedEmail, requireOfficeUser } from "@/lib/server/office-auth";
import { sendViaResend } from "@/lib/server/email";
import { clean } from "./shared";


export async function requestMagicLink(formData) {
  const requestedEmail = clean(formData.get("email"), 320).toLowerCase();
  const allowedEmail = officeAllowedEmail();
  if (!allowedEmail || requestedEmail !== allowedEmail) redirect("/office/login?sent=1");

  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL
    || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "https://www.teamtastic.events");
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) redirect("/office/login?error=send_failed");

  const admin = getSupabaseAdmin();
  const { data: claimed, error: claimError } = await admin
    .rpc("try_claim_magic_link_send", { p_email: allowedEmail });
  if (claimError || claimed !== true) redirect("/office/login?sent=1");

  const { data, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: allowedEmail,
  });
  const tokenHash = data?.properties?.hashed_token;
  if (linkError || !tokenHash) {
    await admin.from("agent_log").insert({
      agent_name: "office",
      action: "office_magic_link_sent",
      outcome: "failed",
      error: linkError?.message || "Supabase did not return a token hash",
    });
    redirect("/office/login?error=send_failed");
  }

  const signInUrl = new URL("/auth/callback", configuredOrigin);
  signInUrl.searchParams.set("token_hash", tokenHash);
  signInUrl.searchParams.set("type", "email");
  signInUrl.searchParams.set("next", "/office");
  const safeUrl = signInUrl.toString().replaceAll("&", "&amp;");
  const { reserved, sent, providerMessageId, reason } = await sendViaResend(admin, {
    messageType: "internal_notification",
    recipient: allowedEmail,
    from,
    subject: "Your Teamtastic Office sign-in link",
    html: `<div style="font-family:Arial,sans-serif;color:#172033;line-height:1.6"><h2>Sign in to Teamtastic Office</h2><p>Use the secure button below to open your private sales command center.</p><p><a href="${safeUrl}" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:700">Open Teamtastic Office</a></p><p style="color:#64748b;font-size:13px">This one-time link expires shortly. If you did not request it, you can ignore this email.</p></div>`,
    text: `Sign in to Teamtastic Office:\n\n${signInUrl.toString()}\n\nThis one-time link expires shortly. If you did not request it, you can ignore this email.`,
    idempotencyKey: `office-magic-link/${tokenHash}`,
  });
  if (!reserved) {
    await admin.from("agent_log").insert({
      agent_name: "office",
      action: "office_magic_link_sent",
      outcome: "blocked",
      decision: { reason },
    });
    redirect("/office/login?error=send_failed");
  }
  await admin.from("agent_log").insert({
    agent_name: "office",
    action: "office_magic_link_sent",
    outcome: sent ? "completed" : "failed",
    decision: sent ? { provider_message_id: providerMessageId } : {},
    error: sent ? null : reason,
  });
  if (!sent) redirect("/office/login?error=send_failed");
  redirect("/office/login?sent=1");
}

export async function signOutOffice() {
  await requireOfficeUser();
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/office/login");
}
