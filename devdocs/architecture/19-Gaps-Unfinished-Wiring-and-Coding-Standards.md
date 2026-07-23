# 19 — Consolidated Gaps, Unfinished Wiring & Coding Standards

Every finding from docs 10–18 in one ranked list, plus repo-wide coding-standards patterns that don't fit neatly into any single subsystem doc. If you only read one doc from this pass, read this one alongside [00-Overview-v3.md](00-Overview-v3.md).

## Tier 1 — Repo-wide, cross-cutting

**G1. Quoted/computed prices never affect what's actually charged.** Every surface that shows a customer or the sales rep a specific dollar figure — `Pricing.js`'s calculator, `GameQuiz.js`'s result screen, `CorporateLeadForm.js`/`TalkToMichaelModal.js`'s subtitles, and the office's `createProposal` — ultimately links to one of two flat Stripe Payment Links ($200 or $100). There is no Checkout Session or PaymentIntent creation anywhere in the codebase. This is the single broadest gap in the system: same root cause, four independent surfaces. See [16](16-Payments-and-Stripe.md).

**G2. The autonomous outbound pipeline isn't actually autonomous yet.** Of 7 pipeline-stage cron jobs, only Apollo enrichment is active — and its own upstream (discovery) is inactive, so it has nothing new to draw on without a manual trigger. Scoring, drafting, sending, reply ingestion, and sequence follow-ups all require hand-invocation as shipped. This looks like deliberate staged rollout (confirmed by an explicit in-migration comment on the send-worker job) rather than an oversight, but "the system prospects/drafts/sends on its own" is not true end-to-end today. See [13](13-Outbound-Automation-Pipeline.md), full cron table in [15](15-Database-Schema-Map.md).

**G3. The deliverability safety net has real coverage holes.** `reserve_email_send` only suppression-checks `nurture`/`prospecting` — lead-confirmation and internal-notification sends bypass suppression entirely. `outbound_auto_paused` only ever gates cold outreach, never nurture or lead-confirmation. The Resend webhook that's supposed to auto-pause on bounce/complaint spikes shows no evidence of being registered on Resend's side yet (blank secret placeholder, untracked files, no ops-doc mention of the dashboard step) — meaning that whole half of the safety net may currently be inert. See [14](14-Lifecycle-Emails-and-Deliverability.md).

**G4. Two independent implementations of prospect scoring exist**, one live (TypeScript, in the edge function) and one dead (SQL RPC, fully built and granted but never called) — a silent-drift risk if either is ever tuned without the other. See [13](13-Outbound-Automation-Pipeline.md).

## Tier 2 — Subsystem-specific, real but contained

**G5.** SoloDemo's success copy ("confirmation sent," "free-game link is ready") overpromises relative to the actual generic email sent — flagged in the prior doc pass, still open. [10](10-Marketing-Site-and-Lead-Funnel.md)

**G6.** `bookings/availability` (GET, live Google Calendar call) has neither rate limiting nor Turnstile, unlike its three sibling routes. [11](11-Booking-System.md), [18](18-Security-Auth-and-Rate-Limiting.md)

**G7.** Booking cancel/reschedule silently swallow Zoom/Calendar cleanup failures with no task/log fallback, inconsistent with `confirm`'s pattern of filing an urgent task on the equivalent failure. [11](11-Booking-System.md)

**G8.** Reschedule's new manage-token and the `rescheduled_to_id` forward-link both exist in data but aren't surfaced in the UI — recoverable today only via the emailed link. [11](11-Booking-System.md)

**G9.** Booking cancellation `reason` is accepted end-to-end by the API/schema but never sent by the UI — a half-built field. [11](11-Booking-System.md)

**G10.** No office UI to control `proposal_email_enabled`/`daily_proposal_cap` — DB-only, can silently block the dashboard's own proposal-send workflow with no explanatory UI. [12](12-Private-Sales-Office.md), [15](15-Database-Schema-Map.md)

**G11.** A narrow partial-failure window in `approveAndSendProposal` can leave `proposals.status='failed'` while `messages` already shows the send succeeded. [12](12-Private-Sales-Office.md)

**G12.** `sequence_steps` table exists, is granted, and is claimed-populated by a migration's own comment, but is empty — cadence/copy live as two different hardcoded constants (3-day vs. 4-day) in two separate files instead. [13](13-Outbound-Automation-Pipeline.md)

**G13.** `collect-phase3-signals` silently clamps to 3 companies/run regardless of a configured value up to 25 — the schema advertises a range the code doesn't honor. [13](13-Outbound-Automation-Pipeline.md)

**G14.** `send-nurture-emails`' "already converted" check and the real paid-conversion RPC disagree on what counts as a conversion — a lead can be cut off from nurture without having actually paid. [14](14-Lifecycle-Emails-and-Deliverability.md)

## Tier 3 — Low-severity / worth knowing, not urgent

- `lead_captured` double-fires client+server with no identity link between the two distinct-ID schemes (PostHog double-count risk). [17](17-Analytics-and-Consent.md)
- PostHog initializes for anyone who hasn't explicitly declined (closer to opt-out than the opt-in behavior the geo-heuristic is nominally implementing for GDPR regions). [17](17-Analytics-and-Consent.md)
- `/api/leads` duplicates rather than imports the shared rate-limit/Turnstile helpers (no drift yet, a maintenance risk). [10](10-Marketing-Site-and-Lead-Funnel.md), [14](14-Lifecycle-Emails-and-Deliverability.md), [18](18-Security-Auth-and-Rate-Limiting.md)
- Soft race condition in the office magic-link rate limiter (no advisory lock). [12](12-Private-Sales-Office.md), [18](18-Security-Auth-and-Rate-Limiting.md)
- `deal_stage_history` and `proposals.metadata` are populated/defined and never read. [12](12-Private-Sales-Office.md), [15](15-Database-Schema-Map.md)
- The `teamtastic.games` query-param handoff (both from the Event Quiz and SoloDemo) is an implicit, unvalidated contract with no shared param naming between the two flows. [10](10-Marketing-Site-and-Lead-Funnel.md)
- 45 of 53 catalog games share boilerplate players/time ranges and a `howToPlay.desc` that just repeats the title — a content-depth gap, not a code defect. [10](10-Marketing-Site-and-Lead-Funnel.md)

## Coding-standards observations (repo-wide patterns, not single bugs)

**Error-surfacing pattern is consistent but leaky.** Nearly every server action in `office/actions.js`, and several Edge Functions, redirect or return raw Postgres/Resend error strings directly to the caller (`?error=${encodeURIComponent(error.message)}`) rather than mapping to a user-safe message set. Consistent throughout — so at least it's not arbitrary — but it means internal schema/constraint names can leak into a browser URL bar. Low severity given `/office` has exactly one allowed viewer, but worth deciding deliberately rather than by accretion if the office ever gets a second user.

**Self-contained Edge Functions duplicate boilerplate instead of sharing a module.** All 8 outbound-pipeline functions (and the lifecycle ones) are single-file `index.ts` with no shared `lib/` directory between them — each reimplements its own webhook-secret check, Supabase client construction, and error-handling shape. Functional today, but any shared-pattern fix (e.g. adding structured logging, or standardizing the blanket-vs-scoped rollback behavior in `process-apollo-enrichment`) has to be applied N times by hand.

**Two different "days between sequence steps" constants** (`send-approved-outreach`'s 3-day first-step delay, `draft-sequence-followups`'s 4-day subsequent-step delay) are hardcoded in two separate files with no shared config or constant — a small but real drift risk if either is ever tuned.

**`audit()` helper usage is inconsistent** in `office/actions.js` — most mutating actions call the local JS `audit()` helper explicitly; `recordCallOutcome` relies entirely on the underlying RPC's own `agent_log` insert instead. Not a bug (both paths do log), but an inconsistent pattern within one file.

**Mixed language/runtime split**: the Next.js app is plain JavaScript throughout (no TypeScript), while every Supabase Edge Function is TypeScript/Deno. Not inherently a problem, but it means type-level guarantees exist only on the automation half of the system, not the half most exposed to end users.

**Hand-rolled timezone math appears twice independently** — the office dashboard's Eastern-day-window calculation and `booking-time.js`'s wall-clock↔UTC conversion are both from-scratch implementations (parsing `Intl.DateTimeFormat` offset strings / iterative correction passes) rather than a shared timezone library, in two unrelated parts of the codebase.

## How to use this list

Tier 1 items are the ones worth discussing before doing more feature work in their area — they're broad enough to affect multiple future changes. Tier 2 items are safe to fix opportunistically, one at a time, without needing to understand the rest of the system. Tier 3 items are worth a mention in planning but not worth interrupting other work for.
