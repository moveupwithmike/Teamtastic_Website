"use client";

import posthog from "posthog-js";
import { effectiveConsent } from "@/lib/consent";

const PII_KEYS = new Set(["name", "email", "phone", "message", "turnstileToken"]);

// lead_captured is the single authoritative conversion event. It is emitted only
// by consent-aware client flows after /api/leads confirms persistence. The server
// separately emits lead_persisted for operational monitoring.
// Ad platform conversions (Meta, Google) share signals with a third party,
// so they require consent to resolve to "granted" — the regional default
// outside opt-in regions, or an explicit accept inside them. PostHog runs
// unless the visitor explicitly declines.
const AD_CONVERSION_EVENTS = new Set(["lead_captured"]);

export function track(event, properties = {}) {
  if (typeof window === "undefined") return;
  if (effectiveConsent() !== "granted") return;

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

export function identifyLead(submissionId) {
  if (typeof window === "undefined" || effectiveConsent() !== "granted") return;
  const id = String(submissionId || "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  posthog.identify(`lead:${id}`);
}
