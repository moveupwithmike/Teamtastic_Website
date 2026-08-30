// Hosted-event cancellation refund policy, computed relative to the scheduled
// EVENT START TIME (not the purchase date). Kept as one pure function so the
// business rule lives in exactly one place — nothing else in the app computes
// a refund percentage independently.
//
//   7 days or more before event start:            100% refund
//   48 hours to less than 7 days before start:      50% refund
//   less than 48 hours before start:                25% refund
//   at or after event start / no-show:                0% refund
//
// This module establishes ELIGIBILITY only. It never issues a refund.

export const CANCELLATION_TIERS = Object.freeze({
  FULL: "full_refund",
  FIFTY_PERCENT: "fifty_percent_refund",
  TWENTY_FIVE_PERCENT: "twenty_five_percent_refund",
  NONE: "no_refund",
});

const HOUR_MS = 3_600_000;
const SEVEN_DAYS_MS = 7 * 24 * HOUR_MS;
const FORTY_EIGHT_HOURS_MS = 48 * HOUR_MS;

function toDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`cancellation-policy: invalid date input: ${String(value)}`);
  }
  return date;
}

/**
 * @param {{ eventStartsAt: Date|string, cancelledAt?: Date|string }} input
 * @returns {{ tier: string, refundPercent: number, reason: string, msUntilEvent: number }}
 */
export function computeCancellationPolicy({ eventStartsAt, cancelledAt = new Date() }) {
  const eventTime = toDate(eventStartsAt);
  const cancelTime = toDate(cancelledAt);
  const msUntilEvent = eventTime.getTime() - cancelTime.getTime();

  if (msUntilEvent <= 0) {
    return { tier: CANCELLATION_TIERS.NONE, refundPercent: 0, reason: "at_or_after_event_start", msUntilEvent };
  }
  if (msUntilEvent >= SEVEN_DAYS_MS) {
    return { tier: CANCELLATION_TIERS.FULL, refundPercent: 100, reason: "seven_days_or_more_before_event", msUntilEvent };
  }
  if (msUntilEvent >= FORTY_EIGHT_HOURS_MS) {
    return { tier: CANCELLATION_TIERS.FIFTY_PERCENT, refundPercent: 50, reason: "between_48_hours_and_seven_days_before_event", msUntilEvent };
  }
  return { tier: CANCELLATION_TIERS.TWENTY_FIVE_PERCENT, refundPercent: 25, reason: "less_than_48_hours_before_event", msUntilEvent };
}

/** No-show is a distinct business fact (event happened, customer didn't) — not a
 * time calculation. It is always 0% under the standard policy, and marking one
 * is an explicit host/admin action elsewhere, never automatic. */
export function noShowPolicy() {
  return { tier: CANCELLATION_TIERS.NONE, refundPercent: 0, reason: "no_show" };
}

/** Customer-facing rendering of the same tiers, kept in this module so the
 * refund schedule can never drift from the thresholds above. */
export const CANCELLATION_POLICY_TABLE = Object.freeze([
  { tier: CANCELLATION_TIERS.FULL, refundPercent: 100, appliesTo: "7 or more days before the event start time" },
  { tier: CANCELLATION_TIERS.FIFTY_PERCENT, refundPercent: 50, appliesTo: "Less than 7 days, but at least 48 hours, before the event start time" },
  { tier: CANCELLATION_TIERS.TWENTY_FIVE_PERCENT, refundPercent: 25, appliesTo: "Less than 48 hours before the event start time" },
  { tier: CANCELLATION_TIERS.NONE, refundPercent: 0, appliesTo: "At or after the event start time, or a no-show" },
]);

export function computeRefundAmountCents(amountPaidCents, refundPercent) {
  if (!Number.isFinite(amountPaidCents) || amountPaidCents < 0) {
    throw new Error("computeRefundAmountCents: amountPaidCents must be a non-negative number");
  }
  if (!Number.isFinite(refundPercent) || refundPercent < 0 || refundPercent > 100) {
    throw new Error("computeRefundAmountCents: refundPercent must be between 0 and 100");
  }
  return Math.round((amountPaidCents * refundPercent) / 100);
}
