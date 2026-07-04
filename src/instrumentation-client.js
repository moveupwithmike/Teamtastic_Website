import posthog from "posthog-js";

const consent = typeof window !== "undefined"
  ? window.localStorage.getItem("teamtastic_analytics_consent")
  : null;

if (consent !== "denied" && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: "/ingest",
    ui_host: "https://us.posthog.com",
    defaults: "2026-01-30",
    capture_exceptions: true,
    persistence: consent === "granted" ? "localStorage+cookie" : "memory",
    person_profiles: "identified_only",
    respect_dnt: true,
    debug: process.env.NODE_ENV === "development",
  });
}
