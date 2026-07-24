import posthog from "posthog-js";
import { effectiveConsent } from "@/lib/consent";

// In opt-in regions effectiveConsent() remains denied until the visitor
// explicitly accepts. In opt-out regions it resolves to granted by default.
if (typeof window !== "undefined"
    && effectiveConsent() === "granted"
    && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: "/ingest",
    ui_host: "https://us.posthog.com",
    defaults: "2026-01-30",
    capture_exceptions: true,
    persistence: "localStorage+cookie",
    person_profiles: "identified_only",
    respect_dnt: true,
    debug: process.env.NODE_ENV === "development",
  });
}
