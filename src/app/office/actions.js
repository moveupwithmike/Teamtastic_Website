"use server";

import { createHash, randomBytes } from "node:crypto";
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
  const { data: claimed, error: claimError } = await admin
    .rpc("try_claim_magic_link_send", { p_email: allowedEmail });
  if (claimError || claimed !== true) redirect("/office/login?sent=1");

  const { data: reservation } = await admin.rpc("reserve_email_send", {
    p_message_type: "internal_notification",
    p_recipient: allowedEmail,
  });
  if (reservation?.allowed !== true) {
    await admin.from("agent_log").insert({
      agent_name: "office",
      action: "office_magic_link_sent",
      outcome: "blocked",
      decision: { reason: reservation?.reason || "reservation_failed" },
    });
    redirect("/office/login?error=send_failed");
  }

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
  await admin.rpc("record_email_send_result", {
    p_message_type: "internal_notification",
    p_sent: mailResponse.ok,
  });
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

export async function updateSystemConfig(formData) {
  const user = await requireOfficeUser();
  const db = getSupabaseAdmin();

  const dailyCapRaw = Number(formData.get("daily_prospecting_cap"));
  const proposalCapRaw = Number(formData.get("daily_proposal_cap"));
  const scope = clean(formData.get("settings_scope"), 30);
  const update = scope === "proposal" ? {
    proposal_email_enabled: formData.get("proposal_email_enabled") === "on",
    daily_proposal_cap: Number.isFinite(proposalCapRaw) ? Math.min(50, Math.max(0, Math.round(proposalCapRaw))) : 10,
    updated_by: user.email,
  } : {
    prospecting_from_email: clean(formData.get("prospecting_from_email"), 320) || null,
    prospecting_enabled: formData.get("prospecting_enabled") === "on",
    daily_prospecting_cap: Number.isFinite(dailyCapRaw) ? Math.min(500, Math.max(0, Math.round(dailyCapRaw))) : 5,
    sequence_followups_enabled: formData.get("sequence_followups_enabled") === "on",
    updated_by: user.email,
  };
  if (scope !== "proposal" && formData.get("resume_sending") === "on") update.outbound_auto_paused = false;

  const { error } = await db.from("system_config").update(update).eq("id", true);
  await audit("update_system_config", user, update, null, error ? "failed" : "completed", error?.message);
  if (error) redirect("/office/settings?error=settings_save_failed");
  revalidatePath("/office/settings");
  redirect("/office/settings?success=1");
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
  await audit(
    "record_post_call_outcome",
    user,
    { booking_id: bookingId, call_outcome: outcome, reason: data?.reason },
    null,
    error || !data?.updated ? "failed" : "completed",
    error?.message || null,
  );
  if (error || !data?.updated) redirect("/office?error=call_outcome_failed");
  revalidatePath("/office");
  redirect(`/office?success=outcome_saved`);
}

export async function createProposal(formData) {
  const user = await requireOfficeUser();
  const dealId = clean(formData.get("deal_id"), 50);
  const db = getSupabaseAdmin();
  const { data: deal } = await db.from("deals").select("id,prospect_id,prospects(email,full_name)").eq("id", dealId).single();
  const prospect = Array.isArray(deal?.prospects) ? deal.prospects[0] : deal?.prospects;
  if (!prospect?.email) redirect("/office?error=proposal_missing_recipient");

  const packageName = clean(formData.get("package_name"), 200);
  const price = money(formData.get("price"));
  const expiresOn = clean(formData.get("expires_on"), 20);
  if (!packageName || price === null || price <= 0 || !expiresOn) redirect("/office?error=proposal_incomplete");
  const paymentToken = randomBytes(32).toString("base64url");
  const paymentTokenHash = createHash("sha256").update(paymentToken).digest("hex");
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.teamtastic.events").replace(/\/$/, "");
  const paymentUrl = `${siteUrl}/api/stripe/proposal-checkout?token=${encodeURIComponent(paymentToken)}`;

  const name = prospect.full_name?.split(" ")[0] || "there";
  const subject = clean(formData.get("subject"), 300) || `Your Teamtastic ${packageName} proposal`;
  const suppliedBody = clean(formData.get("body_text"), 10000);
  const bodyText = suppliedBody || [
    `Hi ${name},`,
    "",
    `I’d love to bring ${packageName} to your team. The investment is $${price.toLocaleString("en-US", { minimumFractionDigits: 2 })}.`,
    "",
    "Teamtastic handles the experience from start to finish, so you can join your team, laugh, and enjoy the game instead of running it.",
    "",
    `This proposal is open through ${expiresOn}. When you’re ready, pay the quoted total securely here: ${paymentUrl}`,
    "",
    "Michael",
    "Teamtastic",
  ].join("\n");

  const { data: proposal, error } = await db.from("proposals").insert({
    deal_id: dealId,
    prospect_id: deal.prospect_id,
    recipient_email: prospect.email,
    package_name: packageName,
    price,
    expires_on: expiresOn,
    deposit_url: paymentUrl,
    subject,
    body_text: bodyText,
    metadata: {
      generator: "office",
      template_version: suppliedBody ? "office-custom-v1" : "office-default-v1",
      pricing_version: "office-proposal-v1",
      payment_kind: "full_payment",
    },
  }).select("id").single();
  if (!error && proposal) {
    const amountCents = Math.round(price * 100);
    const { error: paymentError } = await db.from("payment_requests").insert({
      deal_id: dealId,
      proposal_id: proposal.id,
      source: "office_proposal",
      payment_kind: "full_payment",
      quoted_total_cents: amountCents,
      amount_due_now_cents: amountCents,
      currency: "usd",
      pricing_version: "office-proposal-v1",
      pricing_inputs: { package_name: packageName },
      public_token_hash: paymentTokenHash,
      fingerprint: createHash("sha256").update(`proposal:${proposal.id}:${amountCents}`).digest("hex"),
      status: "active",
      expires_at: new Date(`${expiresOn}T23:59:59.999Z`).toISOString(),
    });
    if (paymentError) {
      await db.from("proposals").delete().eq("id", proposal.id);
      await audit("create_proposal", user, { deal_id: dealId, proposal_id: proposal.id }, deal.prospect_id, "failed", paymentError.message);
      redirect("/office?error=proposal_payment_request_failed");
    }
  }
  await audit("create_proposal", user, { deal_id: dealId, proposal_id: proposal?.id }, deal.prospect_id, error ? "failed" : "completed", error?.message);
  if (error) redirect("/office?error=proposal_create_failed");
  revalidatePath("/office");
  redirect("/office?success=proposal_drafted");
}

export async function approveAndSendProposal(formData) {
  const user = await requireOfficeUser();
  const id = clean(formData.get("id"), 50);
  const db = getSupabaseAdmin();
  const { data: proposal, error: readError } = await db.from("proposals").select("*").eq("id", id).single();
  if (readError || !proposal || !["draft", "failed", "send_failed"].includes(proposal.status)) redirect("/office?error=proposal_not_available");

  const subject = clean(formData.get("subject"), 300);
  const bodyText = clean(formData.get("body_text"), 10000);
  if (!subject || !bodyText) redirect("/office?error=proposal_content_required");

  const approvedAt = new Date().toISOString();
  const { data: claimedProposal, error: approvalError } = await db.from("proposals").update({
    subject,
    body_text: bodyText,
    status: "sending",
    approved_at: approvedAt,
    approved_by: user.email,
    send_attempted_at: approvedAt,
    last_error: null,
  }).eq("id", id).in("status", ["draft", "failed", "send_failed"]).select("id").maybeSingle();
  if (approvalError) {
    await audit("send_proposal", user, { proposal_id: id }, proposal.prospect_id, "failed", approvalError.message);
    redirect("/office?error=proposal_claim_failed");
  }
  if (!claimedProposal) redirect("/office?error=proposal_already_being_sent");

  const { data: reservation, error: reservationError } = await db.rpc("reserve_email_send", {
    p_message_type: "proposal",
    p_recipient: proposal.recipient_email,
  });
  if (reservationError || !reservation?.allowed) {
    const reason = reservationError?.message || reservation?.reason || "send_not_reserved";
    await db.from("proposals").update({ status: "draft", last_error: reason }).eq("id", id);
    await audit("send_proposal", user, { proposal_id: id, reason }, proposal.prospect_id, "blocked");
    redirect("/office?error=proposal_send_blocked");
  }

  const apiKey = process.env.RESEND_API_KEY;
  // Deliberately not prospecting_from_email — proposals go to warm leads who already had
  // a call, so they use the trusted transactional identity, not the cold-outreach one.
  const from = process.env.INTERNAL_NOTIFICATION_EMAIL ? `Teamtastic <${process.env.INTERNAL_NOTIFICATION_EMAIL}>` : process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    await db.rpc("record_email_send_result", { p_message_type: "proposal", p_sent: false });
    await db.from("proposals").update({ status: "send_failed", last_error: "Proposal email provider is not configured" }).eq("id", id);
    await audit("send_proposal", user, { proposal_id: id }, proposal.prospect_id, "failed", "Email provider not configured");
    redirect("/office?error=proposal_email_not_configured");
  }

  let providerMessageId = proposal.provider_message_id || null;
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
    await db.rpc("record_email_send_result", {
      p_message_type: "proposal",
      p_sent: response.ok && Boolean(result.id),
    });
    if (!response.ok || !result.id) throw new Error(result.message || `Email provider returned ${response.status}`);
    providerMessageId = result.id;
    const sentAt = new Date().toISOString();
    const { data: finalized, error: finalizeError } = await db.rpc("finalize_proposal_send", {
      p_proposal_id: id,
      p_provider_message_id: providerMessageId,
      p_from_address: from,
      p_subject: subject,
      p_body_text: bodyText,
      p_sent_at: sentAt,
      p_actor: user.email,
    });
    if (finalizeError || !finalized?.finalized) throw new Error(finalizeError?.message || finalized?.reason || "proposal_finalize_failed");
  } catch (error) {
    const status = providerMessageId ? "reconcile_required" : "send_failed";
    await db.from("proposals").update({
      status,
      provider_message_id: providerMessageId,
      last_error: status === "reconcile_required" ? "CRM reconciliation required" : "Email provider request failed",
    }).eq("id", id);
    if (providerMessageId) {
      await db.from("tasks").upsert({
        prospect_id: proposal.prospect_id,
        title: "Reconcile sent proposal",
        description: `Resend accepted proposal ${id}, but CRM finalization failed. Provider message: ${providerMessageId}.`,
        priority: "urgent",
        due_at: new Date().toISOString(),
        source: "proposal_reconciliation",
        fingerprint: `proposal:reconcile:${id}`,
      }, { onConflict: "fingerprint", ignoreDuplicates: true });
    }
    await audit("send_proposal", user, { proposal_id: id, provider_message_id: providerMessageId }, proposal.prospect_id, status, clean(error.message, 1000));
    redirect("/office?error=proposal_send_failed");
  }
  revalidatePath("/office");
  redirect("/office?success=proposal_sent");
}

export async function reconcileProposalSend(formData) {
  const user = await requireOfficeUser();
  const id = clean(formData.get("id"), 50);
  const db = getSupabaseAdmin();
  const { data: proposal, error: readError } = await db.from("proposals")
    .select("id,prospect_id,status,provider_message_id,subject,body_text,send_attempted_at")
    .eq("id", id)
    .single();
  if (readError || !proposal || proposal.status !== "reconcile_required" || !proposal.provider_message_id) {
    redirect("/office?error=proposal_not_reconcilable");
  }

  const from = process.env.INTERNAL_NOTIFICATION_EMAIL
    ? `Teamtastic <${process.env.INTERNAL_NOTIFICATION_EMAIL}>`
    : process.env.RESEND_FROM_EMAIL;
  if (!from) redirect("/office?error=proposal_email_not_configured");

  const { data: finalized, error } = await db.rpc("finalize_proposal_send", {
    p_proposal_id: id,
    p_provider_message_id: proposal.provider_message_id,
    p_from_address: from,
    p_subject: proposal.subject,
    p_body_text: proposal.body_text,
    p_sent_at: proposal.send_attempted_at || new Date().toISOString(),
    p_actor: user.email,
  });
  await audit(
    "reconcile_proposal_send",
    user,
    { proposal_id: id, provider_message_id: proposal.provider_message_id },
    proposal.prospect_id,
    error || !finalized?.finalized ? "failed" : "completed",
    error?.message || (!finalized?.finalized ? finalized?.reason : null),
  );
  if (error || !finalized?.finalized) {
    redirect("/office?error=proposal_reconcile_failed");
  }
  revalidatePath("/office");
  redirect("/office?success=proposal_reconciled");
}
