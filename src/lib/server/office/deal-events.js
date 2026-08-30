"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import { requireOfficeUser } from "@/lib/server/office-auth";
import { computeCancellationPolicy, computeRefundAmountCents } from "@/lib/cancellation-policy";
import { audit, clean } from "./shared";

const TERMINAL_STAGES = new Set(["cancelled", "closed_lost"]);

async function amountPaidCentsForDeal(db, dealId) {
  const { data } = await db.from("deal_payments").select("amount").eq("deal_id", dealId);
  const total = (data || []).reduce((sum, row) => sum + Number(row.amount || 0), 0);
  return Math.round(total * 100);
}

/**
 * Establishes refund ELIGIBILITY based on the cancellation policy and records
 * the cancellation. It does NOT call Stripe and does NOT issue a refund — it
 * creates a task telling the office exactly what to refund manually, once
 * confirmed. Actual refund issuance stays an explicit, separate, human action.
 */
export async function cancelHostedEvent(formData) {
  const user = await requireOfficeUser();
  const dealId = clean(formData.get("deal_id"), 50);
  const reason = clean(formData.get("reason"), 1000);
  const prospectId = clean(formData.get("prospect_id"), 50) || null;
  if (!dealId || !reason) return;

  const db = getSupabaseAdmin();
  const { data: deal, error: dealError } = await db
    .from("deals")
    .select("id,event_id,stage")
    .eq("id", dealId)
    .maybeSingle();
  if (dealError || !deal || TERMINAL_STAGES.has(deal.stage)) {
    await audit("cancel_hosted_event", user, { deal_id: dealId }, prospectId, "skipped", "not_eligible_or_already_terminal");
    return;
  }

  let refundEligiblePercent = 0;
  let refundEligibleAmountCents = 0;
  if (deal.event_id) {
    const { data: event } = await db.from("events").select("scheduled_start_time").eq("id", deal.event_id).maybeSingle();
    if (event?.scheduled_start_time) {
      const policy = computeCancellationPolicy({ eventStartsAt: event.scheduled_start_time });
      refundEligiblePercent = policy.refundPercent;
      const amountPaidCents = await amountPaidCentsForDeal(db, dealId);
      refundEligibleAmountCents = computeRefundAmountCents(amountPaidCents, refundEligiblePercent);
    }
  }

  const { error } = await db.rpc("record_hosted_event_cancellation", {
    p_deal_id: dealId,
    p_actor: user.email,
    p_reason: reason,
    p_no_show: false,
    p_refund_eligible_percent: refundEligiblePercent,
    p_refund_eligible_amount_cents: refundEligibleAmountCents,
  });
  await audit(
    "cancel_hosted_event", user,
    { deal_id: dealId, refund_eligible_percent: refundEligiblePercent, refund_eligible_amount_cents: refundEligibleAmountCents },
    prospectId, error ? "failed" : "completed", error?.message,
  );
  if (prospectId) revalidatePath(`/office/prospects/${prospectId}`);
}

/**
 * No-show is always 0% under the standard policy and is only ever set by this
 * explicit action — nothing in the schema infers it automatically from a
 * missed start time.
 */
export async function markEventNoShow(formData) {
  const user = await requireOfficeUser();
  const dealId = clean(formData.get("deal_id"), 50);
  const reason = clean(formData.get("reason"), 1000) || "Customer did not join.";
  const prospectId = clean(formData.get("prospect_id"), 50) || null;
  if (!dealId) return;

  const db = getSupabaseAdmin();
  const { data: deal } = await db.from("deals").select("id,stage").eq("id", dealId).maybeSingle();
  if (!deal || TERMINAL_STAGES.has(deal.stage)) {
    await audit("mark_event_no_show", user, { deal_id: dealId }, prospectId, "skipped", "not_eligible_or_already_terminal");
    return;
  }

  const { error } = await db.rpc("record_hosted_event_cancellation", {
    p_deal_id: dealId,
    p_actor: user.email,
    p_reason: reason,
    p_no_show: true,
    p_refund_eligible_percent: 0,
    p_refund_eligible_amount_cents: 0,
  });
  await audit("mark_event_no_show", user, { deal_id: dealId }, prospectId, error ? "failed" : "completed", error?.message);
  if (prospectId) revalidatePath(`/office/prospects/${prospectId}`);
}
