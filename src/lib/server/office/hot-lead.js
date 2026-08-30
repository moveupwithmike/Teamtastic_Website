// @vitest-environment node

// Canonical inbound-reply intent model for the commercial response engine.
// This module is the single source of truth that the Office dashboard, the
// inbound-reply DB trigger (see supabase/migrations/20260829180724_inbound_reply_taxonomy_v2.sql)
// and the Gmail reply classifier (supabase/functions/ingest-gmail-replies) all implement.

export const HOT_INTENTS = ["interested", "pricing_request", "booking_request"];

export const SUPPRESSING_INTENTS = ["unsubscribe", "not_interested", "complaint", "legal"];

export const HANDLED_INTENTS = [
  ...HOT_INTENTS,
  "question",
  "objection",
  "referral",
  "not_now",
  "out_of_office",
  "unknown",
  ...SUPPRESSING_INTENTS,
];

// A classification only counts as "hot" above this confidence. Low-confidence
// classifications must fail safe: they become a review task, never a hot alert.
export const HOT_MIN_CONFIDENCE = 0.75;

export const HANDLED_MIN_CONFIDENCE = 0.5;

export function isHotIntent(classification, confidence = 1) {
  return HOT_INTENTS.includes(classification) && Number.isFinite(confidence) && confidence >= HOT_MIN_CONFIDENCE;
}

export function isSuppressing(classification) {
  return SUPPRESSING_INTENTS.includes(classification);
}

// A reply that should stop active outreach but is NOT a permanent negative and
// is NOT a temporary absence: we schedule a later re-engagement instead.
export function isDeferredIntent(classification) {
  return classification === "not_now";
}

export function isAbsenceIntent(classification) {
  return classification === "out_of_office";
}

// Age buckets used for operational prioritization only. Business thresholds:
// NEW < 1 hour, WAITING 1-4 hours, OVERDUE 4h-3d, STALE 3+ days.
export const AGE_BUCKETS = [
  { key: "NEW", label: "New (< 1h)", minMinutes: 0, maxMinutes: 60 },
  { key: "WAITING", label: "Waiting (1-4h)", minMinutes: 60, maxMinutes: 4 * 60 },
  { key: "OVERDUE", label: "Overdue (4h-3d)", minMinutes: 4 * 60, maxMinutes: 3 * 24 * 60 },
  { key: "STALE", label: "Stale (3d+)", minMinutes: 3 * 24 * 60, maxMinutes: Number.POSITIVE_INFINITY },
];

export function ageBucketForMinutes(minutes) {
  if (!Number.isFinite(minutes) || minutes < 0) return "NEW";
  if (minutes < 60) return "NEW";
  if (minutes < 4 * 60) return "WAITING";
  if (minutes < 3 * 24 * 60) return "OVERDUE";
  return "STALE";
}

export function ageBucketForDate(receivedAt, now = new Date()) {
  const received = receivedAt instanceof Date ? receivedAt : new Date(receivedAt);
  return ageBucketForMinutes((now.getTime() - received.getTime()) / 60000);
}

// Recommended owner action per intent. Used to title Office tasks and to explain
// why a reply surfaced at a given priority. No pricing or availability claims
// are ever generated here.
export const INTENT_NEXT_ACTIONS = {
  interested: "Reply and confirm next step; match the theme/group context already captured.",
  pricing_request: "Reply with a quote built from canonical pricing only; confirm date/capacity first.",
  booking_request: "Confirm availability from the authoritative calendar, then route to booking.",
  question: "Answer with verified facts; escalate to a call if it turns into a booking intent.",
  objection: "Address the stated concern; do not assume a no until the objection is answered.",
  referral: "Record the referral and contact the new contact only after human approval.",
  not_now: "Acknowledge and schedule a documented re-engagement window; do not re-pitch now.",
  out_of_office: "Do nothing actionable now; keep outreach paused until they return.",
  unknown: "Read the thread; confirm intent before any follow-up automation acts.",
  unsubscribe: "Suppress immediately and durably; never email again.",
  not_interested: "Suppress outreach; log the reason; do not delete history.",
  complaint: "Suppress and treat as urgent; route to the owner directly.",
  legal: "Suppress and treat as urgent; route to the owner directly.",
};

export function nextActionFor(classification) {
  return INTENT_NEXT_ACTIONS[classification] || INTENT_NEXT_ACTIONS.unknown;
}

export function classifyHot(classification, confidence) {
  if (isHotIntent(classification, confidence)) {
    return { hot: true, reason: `${classification} at ${Math.round(confidence * 100)}% confidence`, action: nextActionFor(classification) };
  }
  return { hot: false, reason: "not high-confidence hot intent", action: nextActionFor(classification) };
}