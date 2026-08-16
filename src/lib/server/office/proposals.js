"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import { requireOfficeUser } from "@/lib/server/office-auth";
import { sendViaResend } from "@/lib/server/email";
import { HTTP_TIMEOUT_MS } from "@/lib/server/http";
import { audit, clean, money } from "./shared";


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
  const [{ data: holidayLead }, { data: capacityHold }] = await Promise.all([
    db.from("leads").select("id,preferred_event_date").eq("prospect_id", deal.prospect_id).not("preferred_event_date", "is", null).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("event_capacity_holds").select("id").eq("deal_id", dealId).in("status", ["tentative", "confirmed"]).or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`).limit(1).maybeSingle(),
  ]);
  if (holidayLead?.preferred_event_date && !capacityHold) redirect("/office/capacity?error=capacity_hold_required");

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

  const apiKey = process.env.RESEND_API_KEY;
  // Deliberately not prospecting_from_email — proposals go to warm leads who already had
  // a call, so they use the trusted transactional identity, not the cold-outreach one.
  const from = process.env.INTERNAL_NOTIFICATION_EMAIL ? `Teamtastic <${process.env.INTERNAL_NOTIFICATION_EMAIL}>` : process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    await db.from("proposals").update({ status: "send_failed", last_error: "Proposal email provider is not configured" }).eq("id", id);
    await audit("send_proposal", user, { proposal_id: id }, proposal.prospect_id, "failed", "Email provider not configured");
    redirect("/office?error=proposal_email_not_configured");
  }

  const delivery = await sendViaResend(db, {
    messageType: "proposal",
    recipient: proposal.recipient_email,
    from,
    subject,
    text: bodyText,
    idempotencyKey: `proposal/${id}`,
    timeoutMs: HTTP_TIMEOUT_MS.slow,
  });
  if (!delivery.reserved) {
    const reason = delivery.reason || "send_not_reserved";
    await db.from("proposals").update({ status: "draft", last_error: reason }).eq("id", id);
    await audit("send_proposal", user, { proposal_id: id, reason }, proposal.prospect_id, "blocked");
    redirect("/office?error=proposal_send_blocked");
  }

  let providerMessageId = delivery.providerMessageId || proposal.provider_message_id || null;
  try {
    if (!delivery.sent || !delivery.providerMessageId) throw new Error(delivery.reason || "Email provider request failed");
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
