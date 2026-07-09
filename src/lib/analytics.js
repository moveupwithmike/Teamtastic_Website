"use client";

import posthog from "posthog-js";

const PII_KEYS = new Set(["name", "email", "phone", "message", "turnstileToken"]);
const CONSENT_KEY = "teamtastic_analytics_consent";

// Ad platform conversions (Meta, Google) share signals with a third party,
// so they only fire on explicit "granted" consent — stricter than PostHog,
// which runs by default unless the visitor declines.
const AD_CONVERSION_EVENTS = new Set(["lead_captured"]);

export function track(event, properties = {}) {
  if (typeof window === "undefined") return;
  const consent = window.localStorage.getItem(CONSENT_KEY);
  if (consent === "denied") return;

  const safe = Object.fromEntries(
    Object.entries(properties).filter(([key]) => !PII_KEYS.has(key))
  );
  posthog.capture(event, safe);

  if (consent === "granted" && AD_CONVERSION_EVENTS.has(event)) {
    window.fbq?.("track", "Lead", safe);
    const conversionId = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;
    const conversionLabel = process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL;
    if (conversionId && conversionLabel) {
      window.gtag?.("event", "conversion", { send_to: `${conversionId}/${conversionLabel}` });
    }
  }
}
