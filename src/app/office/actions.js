"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireOfficeUser } from "@/lib/server/office-auth";

function clean(value, max = 10000) {
  return String(value || "").trim().slice(0, max);
}

function money(value) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

async function audit(action, user, decision = {}, prospectId = null, outcome = "completed", error = null) {
  const db = getSupabaseAdmin();
  await db.from("agent_log").insert({
    agent_name: "office",
    action,
    outcome,
    prospect_id: prospectId,
    decision: { ...decision, actor: user.email },
    error,
  });
}

export async function requestMagicLink(formData) {
  const requestedEmail = clean(formData.get("email"), 320).toLowerCase();
  const allowedEmail = (process.env.OFFICE_ALLOWED_EMAIL || process.env.INTERNAL_NOTIFICATION_EMAIL || "").trim().toLowerCase();
  if (!allowedEmail || requestedEmail !== allowedEmail) redirect("/office/login?sent=1");

  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL
    || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "https://www.teamtastic.events");
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) redirect("/office/login?error=send_failed");

  const admin = getSupabaseAdmin();
  const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
  const { count } = await admin
    .from("agent_log")
    .select("id", { count: "exact", head: true })
    .eq("agent_name", "office")
    .eq("action", "office_magic_link_sent")
    .eq("outcome", "completed")
    .gte("created_at", oneMinuteAgo);
  if ((count || 0) > 0) redirect("/office/login?sent=1");

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
  const mailResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `office-magic-link/${tokenHash}`,
    },
    body: JSON.stringify({
      from,
      to: [allowedEmail],
      subject: "Your Teamtastic Office sign-in link",
      html: `<div style="font-family:Arial,sans-serif;color:#172033;line-height:1.6"><h2>Sign in to Teamtastic Office</h2><p>Use the secure button below to open your private sales command center.</p><p><a href="${safeUrl}" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:700">Open Teamtastic Office</a></p><p style="color:#64748b;font-size:13px">This one-time link expires shortly. If you did not request it, you can ignore this email.</p></div>`,
      text: `Sign in to Teamtastic Office:\n\n${signInUrl.toString()}\n\nThis one-time link expires shortly. If you did not request it, you can ignore this email.`,
    }),
  });
  const mailResult = await mailResponse.json().catch(() => ({}));
  await admin.from("agent_log").insert({
    agent_name: "office",
    action: "office_magic_link_sent",
    outcome: mailResponse.ok ? "completed" : "failed",
    decision: mailResponse.ok ? { provider_message_id: mailResult.id } : {},
    error: mailResponse.ok ? null : (mailResult.message || `Resend returned ${mailResponse.status}`),
  });
  if (!mailResponse.ok) redirect("/office/login?error=send_failed");
  redirect("/office/login?sent=1");
}

export async function signOutOffice() {
  await requireOfficeUser();
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/office/login");
}

export async function reviewOutreachDraft(formData) {
  const user = await requireOfficeUser();
  const id = clean(formData.get("id"), 50);
  const decision = clean(formData.get("decision"), 20);
  if (!id || !["approve", "reject"].includes(decision)) return;

  const db = getSupabaseAdmin();
  const { data: existing, error: readError } = await db.from("outreach_drafts").select("id,prospect_id,status").eq("id", id).single();
  if (readError || !existing || !["draft", "review"].includes(existing.status)) return;

  const update = decision === "approve" ? {
    subject: clean(formData.get("subject"), 300),
    body_text: clean(formData.get("body_text"), 10000),
    status: "approved",
    approved_at: new Date().toISOString(),
    approved_by: user.email,
    approval_notes: clean(formData.get("notes"), 1000) || null,
  } : {
    status: "rejected",
    approval_notes: clean(formData.get("notes"), 1000) || "Rejected in Office",
  };
  const { error } = await db.from("outreach_drafts").update(update).eq("id", id);
  await audit("review_outreach_draft", user, { draft_id: id, decision }, existing.prospect_id, error ? "failed" : "completed", error?.message);
  revalidatePath("/office");
}

export async function recordCallOutcome(formData) {
  const user = await requireOfficeUser();
  const bookingId = clean(formData.get("booking_id"), 50);
  const outcome = clean(formData.get("outcome"), 30);
  const budget = clean(formData.get("budget"), 30);
  const db = getSupabaseAdmin();
  const { data, error } = await db.rpc("apply_post_call_outcome", {
    p_booking_id: bookingId,
    p_outcome: outcome,
    p_package_name: clean(formData.get("package_name"), 200) || null,
    p_budget_amount: budget ? money(budget) : null,
    p_next_step: clean(formData.get("next_step"), 1000) || null,
    p_notes: clean(formData.get("notes"), 5000) || null,
    p_actor: user.email,
  });
  if (error || !data?.updated) redirect(`/office?error=${encodeURIComponent(error?.message || data?.reason || "outcome_failed")}`);
  revalidatePath("/office");
  redirect(`/office?success=outcome_saved`);
}

export async function createProposal(formData) {
  const user = await requireOfficeUser();
  const dealId = clean(formData.get("deal_id"), 50);
  const db = getSupabaseAdmin();
  const { data: deal } = await db.from("deals").select("id,prospect_id,prospects(email,full_name)").eq("id", dealId).single();
  if (!deal?.prospects?.email) redirect("/office?error=proposal_missing_recipient");

  const packageName = clean(formData.get("package_name"), 200);
  const price = money(formData.get("price"));
  const expiresOn = clean(formData.get("expires_on"), 20);
  const depositUrl = process.env.NEXT_PUBLIC_STRIPE_DEPOSIT_URL;
  if (!packageName || price === null || !expiresOn || !depositUrl) redirect("/office?error=proposal_incomplete");

  const name = deal.prospects.full_name?.split(" ")[0] || "there";
  const subject = clean(formData.get("subject"), 300) || `Your Teamtastic ${packageName} proposal`;
  const bodyText = clean(formData.get("body_text"), 10000) || [
    `Hi ${name},`,
    "",
    `I’d love to bring ${packageName} to your team. The investment is $${price.toLocaleString("en-US", { minimumFractionDigits: 2 })}.`,
    "",
    "Teamtastic handles the experience from start to finish, so you can join your team, laugh, and enjoy the game instead of running it.",
    "",
    `This proposal is open through ${expiresOn}. When you’re ready, reserve your date here: ${depositUrl}`,
    "",
    "Michael",
    "Teamtastic",
  ].join("\n");

  const { data: proposal, error } = await db.from("proposals").insert({
    deal_id: dealId,
    prospect_id: deal.prospect_id,
    recipient_email: deal.prospects.email,
    package_name: packageName,
    price,
    expires_on: expiresOn,
    deposit_url: depositUrl,
    subject,
    body_text: bodyText,
  }).select("id").single();
  await audit("create_proposal", user, { deal_id: dealId, proposal_id: proposal?.id }, deal.prospect_id, error ? "failed" : "completed", error?.message);
  if (error) redirect(`/office?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/office");
  redirect("/office?success=proposal_drafted");
}

export async function approveAndSendProposal(formData) {
  const user = await requireOfficeUser();
  const id = clean(formData.get("id"), 50);
  const db = getSupabaseAdmin();
  const { data: proposal, error: readError } = await db.from("proposals").select("*").eq("id", id).single();
  if (readError || !proposal || !["draft", "failed"].includes(proposal.status)) redirect("/office?error=proposal_not_available");

  const subject = clean(formData.get("subject"), 300);
  const bodyText = clean(formData.get("body_text"), 10000);
  if (!subject || !bodyText) redirect("/office?error=proposal_content_required");

  const approvedAt = new Date().toISOString();
  const { data: claimedProposal, error: approvalError } = await db.from("proposals").update({
    subject,
    body_text: bodyText,
    status: "approved",
    approved_at: approvedAt,
    approved_by: user.email,
    last_error: null,
  }).eq("id", id).in("status", ["draft", "failed"]).select("id").maybeSingle();
  if (approvalError) redirect(`/office?error=${encodeURIComponent(approvalError.message)}`);
  if (!claimedProposal) redirect("/office?error=proposal_already_being_sent");

  const { data: reservation, error: reservationError } = await db.rpc("reserve_email_send", {
    p_message_type: "proposal",
    p_recipient: proposal.recipient_email,
  });
  if (reservationError || !reservation?.allowed) {
    const reason = reservationError?.message || reservation?.reason || "send_not_reserved";
    await db.from("proposals").update({ status: "draft", last_error: reason }).eq("id", id);
    await audit("send_proposal", user, { proposal_id: id, reason }, proposal.prospect_id, "blocked");
    redirect(`/office?error=${encodeURIComponent(reason)}`);
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.PROSPECTING_FROM_EMAIL || process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    await db.from("proposals").update({ status: "failed", last_error: "Proposal email provider is not configured" }).eq("id", id);
    await audit("send_proposal", user, { proposal_id: id }, proposal.prospect_id, "failed", "Email provider not configured");
    redirect("/office?error=proposal_email_not_configured");
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `proposal/${id}`,
      },
      body: JSON.stringify({ from, to: [proposal.recipient_email], subject, text: bodyText }),
      signal: AbortSignal.timeout(10000),
    });
    const result = await response.json();
    if (!response.ok || !result.id) throw new Error(result.message || `Email provider returned ${response.status}`);
    const sentAt = new Date().toISOString();
    const { error: messageError } = await db.from("messages").insert({
      prospect_id: proposal.prospect_id,
      direction: "outbound",
      message_type: "proposal",
      provider: "resend",
      provider_message_id: result.id,
      from_address: from,
      to_addresses: [proposal.recipient_email],
      subject,
      body_text: bodyText,
      status: "sent",
      sent_at: sentAt,
    });
    if (messageError && messageError.code !== "23505") throw messageError;
    const { error: proposalUpdateError } = await db.from("proposals").update({ status: "sent", sent_at: sentAt, provider_message_id: result.id, last_error: null }).eq("id", id);
    if (proposalUpdateError) throw proposalUpdateError;
    await db.from("deals").update({
      stage: "proposal_sent",
      next_action: "Follow up on the proposal",
      next_action_due_at: new Date(Date.now() + 3 * 86400000).toISOString(),
      decision_date: proposal.expires_on,
      stage_source: "office_proposal",
      stage_source_id: id,
    }).eq("id", proposal.deal_id).eq("outcome", "open");
    await audit("send_proposal", user, { proposal_id: id, provider_message_id: result.id }, proposal.prospect_id);
  } catch (error) {
    await db.from("proposals").update({ status: "failed", last_error: clean(error.message, 1000) }).eq("id", id);
    await audit("send_proposal", user, { proposal_id: id }, proposal.prospect_id, "failed", clean(error.message, 1000));
    redirect(`/office?error=${encodeURIComponent(error.message || "proposal_send_failed")}`);
  }
  revalidatePath("/office");
  redirect("/office?success=proposal_sent");
}
