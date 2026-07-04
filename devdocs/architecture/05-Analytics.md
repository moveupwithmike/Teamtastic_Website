# 05 — Analytics (PostHog)

## Initialization

- **Client:** [src/instrumentation-client.js](../../src/instrumentation-client.js) (Next 15.3+ pattern; runs before hydration). Consent-gated: skipped entirely if `localStorage.teamtastic_analytics_consent === "denied"`. Config: `api_host: "/ingest"` (reverse proxy below), `persistence` is cookie-backed only when consent is explicitly `granted`, otherwise **memory** (no identifiers persisted); `person_profiles: "identified_only"`, `respect_dnt`, `capture_exceptions`, `defaults: "2026-01-30"`.
- **Reverse proxy:** [next.config.mjs](../../next.config.mjs) rewrites `/ingest/*` → `us.i.posthog.com` (+ static assets), defeating ad-blocker domain lists. `skipTrailingSlashRedirect` is set as PostHog requires.
- **Server:** [src/lib/server/posthog.js](../../src/lib/server/posthog.js) — `posthog-node` singleton, `flushAt: 1` (immediate flush per event; correct for serverless), no-op when the key is unset.
- [PostHogProvider.js](../../src/components/PostHogProvider.js) is a **documented no-op** kept for backwards compatibility and still rendered in `layout.js` — dead code, safe to delete both sides.

## The `track()` wrapper — [src/lib/analytics.js](../../src/lib/analytics.js)

All client events go through `track(event, properties)`, which (a) drops everything if consent is denied, and (b) strips a PII deny-list (`name`, `email`, `phone`, `message`, `turnstileToken`) from properties. Server events go through `captureServerEvent(event, distinctId, props)` with `submissionId` as the distinct ID.

## Event taxonomy (current)

| Event | Fired from | Properties |
|---|---|---|
| `quiz_started` | GameQuiz (step-0 select), SoloDemo (`startQuiz`) | source |
| `quiz_step_completed` | GameQuiz | source, step, selected value |
| `demo_question_answered` | SoloDemo | question_index, is_correct |
| `lead_submit_attempted` | all three lead components | source, teamSize/vibe/occasion |
| `lead_captured` (client) | all three lead components | source + segmentation |
| `lead_captured` (server) | /api/leads | source, team_size, vibe, occasion, recommendation_key |
| `lead_capture_failed` | all three | source, code, retryable |
| `deposit_cta_clicked` | GameQuiz result | segmentation + recommendation |
| `free_game_clicked` | GameQuiz result | segmentation + recommendation |
| `concierge_modal_opened` | both CTA banners | source: cta_banner / footer_banner |
| `pricing_cta_clicked` | Pricing tier cards | tier_name, tier_cta |
| `deposit_completed` | Stripe webhook (server) | matched, amount, currency, source |

Wizard-built dashboard + funnel insights are linked in [posthog-setup-report.md](../../posthog-setup-report.md) (project 496937).

## Gaps

1. **`lead_captured` is double-counted.** It fires client-side in each component *and* server-side in `/api/leads` under the same event name, but with **different distinct IDs** (client: PostHog anonymous device ID; server: `submissionId`). Any count of `lead_captured` is ~2× reality, and the wizard's "Lead Conversion Funnel" (quiz_started → lead_submit_attempted → lead_captured) will match the client copy only. Pick one: keep the server event as the source of truth and rename it (`lead_recorded`) or drop the client one.
2. **Client and server events can never be joined.** No `posthog.identify()` call exists anywhere, and the server uses `submissionId` as its distinct ID while the client uses the anonymous ID. Even `deposit_completed` (keyed by submissionId) can't be stitched to the on-site journey that produced it. Fix options, in privacy-ascending order: pass the client's `posthog.get_distinct_id()` to `/api/leads` and use it server-side; or `posthog.alias(submissionId)` at capture time. (Full email-based `identify()` would conflict with the current strip-PII posture — a deliberate product decision, see LEAD_FUNNEL_OPERATIONS verification item "no names/emails in PostHog".)
3. **Property naming is inconsistent** — camelCase from client (`teamSize`), snake_case from server (`team_size`) and from `demo_question_answered` (`question_index`). Breakdowns must know which spelling each event uses. Standardize (PostHog convention is snake_case).
4. **`quiz_started` over-fires on the event quiz** (doc 03, flow 1) — funnel entry inflated.
5. **Untracked steps/CTAs:** quiz secondary $99/mo CTA; game-detail "Launch Free Game Lobby"; SoloDemo results-screen view; pricing estimator interactions (players/add-ons — arguably the strongest intent signal on the pricing page); `/#quiz` "Book Your Event" banner clicks (only the modal-open half of each banner is tracked).
6. **No consent UI exists.** The code honors `teamtastic_analytics_consent`, but nothing on the site ever *sets* it — there is no cookie/consent banner component. Today every visitor is tracked in cookieless-memory mode (defensible in many jurisdictions, and no PII is sent), but the `granted` persistence branch is unreachable and, if EU traffic matters, a consent banner is missing wiring.
7. **Error tracking is half-wired:** `capture_exceptions: true` is on, but source maps aren't uploaded anywhere (no CI — see wizard checklist item 4), so production stack traces will be minified.
