# 17 — Analytics & Consent

Refreshes [05-Analytics.md](05-Analytics.md). Headline change since that pass: `PostHogProvider.js` is now an explicit no-op stub — initialization moved to `src/instrumentation-client.js` per the newer Next.js pattern. If anything downstream still assumes `PostHogProvider.js` does the init, that's stale.

## Client-side tracking (`src/lib/analytics.js`)

`track()` no-ops on the server and no-ops if stored consent is explicitly `"denied"` — a real gate. Strips PII keys (`name`, `email`, `phone`, `message`, `turnstileToken`) from every payload before sending anywhere. Always forwards to PostHog once consent isn't explicitly denied; only forwards to ad platforms (Meta Pixel, GA4, Google Ads conversion) for a fixed allowlist (`lead_captured` only) and only when consent is explicitly `"granted"` — a stricter bar than PostHog's.

Client-fired events, all confirmed live (none orphaned): `booking_call_clicked`, `concierge_modal_opened`, `demo_question_answered`, `deposit_cta_clicked`, `free_game_clicked`, `lead_capture_failed`, `lead_captured`, `lead_submit_attempted`, `pricing_cta_clicked`, `quiz_started`, `quiz_step_completed`.

**`lead_captured` fires twice per conversion** — client-side via `track()` in all four lead-capture components, *and* server-side via `captureServerEvent()` in `/api/leads`. These use different distinct-ID schemes (PostHog's own client ID vs. the server-generated `submissionId`) with no explicit alias/link between them — a likely duplicate-count / unmerged-person issue in PostHog reporting, not simply a stale event.

## Server-side (`src/lib/server/posthog.js`)

Singleton `posthog-node` client, flushes immediately (`flushAt: 1, flushInterval: 0`, no batching). Used in exactly two places: the Stripe webhook (fires one of 4 product-specific `analyticsEvent` values — these are **server-only events**, never fired from `track()`, easy to miss if only scanning client code) and `/api/leads` (a reliability backstop for the client-side `lead_captured`, contributing to the double-count above).

## Consent gating — real, with one asymmetry worth flagging

`src/lib/consent.js` uses the browser's IANA timezone as a geo heuristic (`Europe/*` and a few Atlantic/Nordic zones) to decide opt-in-by-default (GDPR-style) vs. opt-out-by-default regions, failing toward the *stricter* opt-in behavior if timezone detection throws.

- **Ad pixels (`AdPixels.js`)**: a genuine conditional gate — both Meta Pixel and gtag.js/Google Ads init only fire `if (effectiveConsent() === "granted")`. Confirmed not cosmetic.
- **PostHog (`instrumentation-client.js`)**: initializes `if (stored !== "denied" ...)` — i.e. it fires for anyone who **hasn't explicitly declined**, including opt-in-region visitors who haven't yet answered the banner. Persistence is downgraded to in-memory-only (no cookie/localStorage) until consent resolves to granted, but the SDK does still boot and can capture pageview/autocapture events into memory pre-consent even in GDPR-flagged regions. This is closer to **opt-out** behavior than the opt-in behavior the timezone heuristic is nominally trying to implement for those regions — arguably the real compliance gap here, not "the banner is cosmetic" (it isn't; both pixels and PostHog demonstrably read consent state).
- `ConsentBanner.js` deliberately reloads the page on any decision, since both `instrumentation-client.js` and `AdPixels.js` only read consent at boot time — a same-session accept/decline without reload would not take effect. Confirmed intentional via an in-code comment, not an oversight.

## PostHog client init (`instrumentation-client.js`)

`api_host: "/ingest"` (proxied to PostHog via `next.config.js` rewrites), `person_profiles: "identified_only"`, `respect_dnt: true`, a dated `defaults` preset (`"2026-01-30"`) that implicitly governs autocapture/session-recording/pageview behavior. **No explicit `autocapture`/`session_recording` flags are set anywhere in the repo** — whether session recording is actually on is entirely a function of the installed SDK version's dated-defaults bundle and/or the PostHog project dashboard's own toggle, not something determinable from source. Also worth restating from the prior pass: **`posthog.identify()` is never called anywhere** — with `person_profiles: "identified_only"`, this means no event in this app is ever tied to an identified person profile at the PostHog level; all events remain anonymous-device events, so per-lead/cross-device funnels aren't wired at the analytics layer (identity stitching, if any, would have to happen by joining on `submission_id`/email in Postgres instead).

## Gaps (ranked)

1. **`lead_captured` double-fires (client + server) with no identity link between the two distinct-ID schemes** — likely inflates conversion counts / creates unmerged person profiles in PostHog.
2. **PostHog initializes for anyone who hasn't explicitly declined, including opt-in-region visitors who haven't yet seen/answered the banner** — functionally opt-out behavior in a context the code's own geo-heuristic is trying to treat as opt-in.
3. **No `posthog.identify()` call anywhere** — all events are anonymous-device-scoped; no analytics-layer identity resolution across devices/sessions for a given lead.
4. Whether session recording/autocapture is actually active isn't determinable from source — depends on the SDK's dated-defaults bundle and/or an out-of-repo dashboard toggle. Not a defect, just a documentation blind spot worth resolving by checking the PostHog project settings directly if it matters.
