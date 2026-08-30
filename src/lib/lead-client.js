import { identifyLead } from "@/lib/analytics";

export function createSubmissionId() {
  return crypto.randomUUID();
}

// First-touch attribution, kept only for the current browser session (sessionStorage,
// not a persistent cookie). Without this, a visitor who clicks a campaign link, then
// browses to a different page before finding the lead form, would submit with no UTM
// at all — getAttribution() used to read window.location.search fresh at submit time,
// so any internal navigation silently discarded the original campaign. This captures
// the UTM the moment it's first seen and never overwrites it with a later, UTM-less
// internal page — deliberately first-touch, not last-touch: the goal is "don't lose
// the acquisition source to normal browsing," not campaign-replacement semantics. No
// PII is stored, only campaign/landing metadata already sent to /api/leads regardless.
const ATTRIBUTION_KEY = "teamtastic_first_touch_attribution";

function readUtmFromCurrentUrl() {
  const params = new URLSearchParams(window.location.search);
  return {
    landingPage: `${window.location.pathname}${window.location.search}`,
    referrer: document.referrer || null,
    utm: {
      source: params.get("utm_source"),
      medium: params.get("utm_medium"),
      campaign: params.get("utm_campaign"),
      content: params.get("utm_content"),
      term: params.get("utm_term"),
    },
  };
}

export function captureFirstTouchAttribution() {
  if (typeof window === "undefined") return;
  try {
    if (sessionStorage.getItem(ATTRIBUTION_KEY)) return;
    const attribution = readUtmFromCurrentUrl();
    const hasUtm = Object.values(attribution.utm).some(Boolean);
    if (!hasUtm) return;
    sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(attribution));
  } catch {
    // sessionStorage unavailable (private browsing, blocked site data, etc) — captureLead
    // falls back to reading the live URL at submit time, same as before this change.
  }
}

export function getAttribution() {
  if (typeof window === "undefined") return {};
  try {
    const stored = sessionStorage.getItem(ATTRIBUTION_KEY);
    if (stored) return JSON.parse(stored);
  } catch {
    // fall through to a live read below
  }
  return readUtmFromCurrentUrl();
}

export async function captureLead(payload) {
  const response = await fetch("/api/leads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, ...getAttribution() }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.success) {
    /** @type {Error & {code?: string, retryable?: boolean}} */
    const error = new Error(result?.message || "We couldn't save your details. Please try again.");
    error.code = result?.code || "UNKNOWN";
    error.retryable = result?.retryable ?? true;
    throw error;
  }
  identifyLead(result.submissionId);
  return result;
}
