"use client";

import posthog from "posthog-js";

const PII_KEYS = new Set(["name", "email", "phone", "message", "turnstileToken"]);

export function track(event, properties = {}) {
  if (typeof window !== "undefined" && window.localStorage.getItem("teamtastic_analytics_consent") === "denied") return;
  const safe = Object.fromEntries(
    Object.entries(properties).filter(([key]) => !PII_KEYS.has(key))
  );
  posthog.capture(event, safe);
}
