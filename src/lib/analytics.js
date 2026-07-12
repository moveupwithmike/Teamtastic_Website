"use client";

import posthog from "posthog-js";
import { effectiveConsent, storedConsent } from "@/lib/consent";

const PII_KEYS = new Set(["name", "email", "phone", "message", "turnstileToken"]);

// Ad platform conversions (Meta, Google) share signals with a third party,
// so they require consent to resolve to "granted" — the regional default
// outside opt-in regions, or an explicit accept inside them. PostHog runs
// unless the visitor explicitly declines.
const AD_CONVERSION_EVENTS = new Set(["lead_captured"]);

export function track(event, properties = {}) {
  if (typeof window === "undefined") return;
  if (storedConsent() === "denied") return;

  const safe = Object.fromEntries(
    Object.entries(properties).filter(([key]) => !PII_KEYS.has(key))
  );
  posthog.capture(event, safe);

  if (effectiveConsent() === "granted" && AD_CONVERSION_EVENTS.has(event)) {
    window.fbq?.("track", "Lead", safe);
    window.gtag?.("event", event, safe); // GA4 custom event

    const conversionId = process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_ID;
    const conversionLabel = process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL;
    if (conversionId && conversionLabel) {
      window.gtag?.("event", "conversion", { send_to: `${conversionId}/${conversionLabel}` });
    }
  }
}
