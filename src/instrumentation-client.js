import posthog from "posthog-js";
import { effectiveConsent, storedConsent } from "@/lib/consent";

const stored = typeof window !== "undefined" ? storedConsent() : "denied";

if (stored !== "denied" && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: "/ingest",
    ui_host: "https://us.posthog.com",
    defaults: "2026-01-30",
    capture_exceptions: true,
    // Opt-in regions get cookieless memory persistence until they accept;
    // everywhere else persists by default.
    persistence: effectiveConsent() === "granted" ? "localStorage+cookie" : "memory",
    person_profiles: "identified_only",
    respect_dnt: true,
    debug: process.env.NODE_ENV === "development",
  });
}
