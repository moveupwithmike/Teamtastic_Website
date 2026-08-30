# Teamtastic Final End-to-End Commercial Mystery-Shopper Rehearsal

Date: 2026-08-30

## Executive Summary

This rehearsal ran real, QA-labeled data through the actual production system — the same database, the same triggers, the same edge function, the same dashboards a real prospect and Michael would touch — rather than re-testing subsystems in isolation. It found and fixed one live P0 defect that would have broken the commercial email pipeline on its very first real hot-lead, unsubscribe, deferral, or out-of-office reply. It also discovered, mid-rehearsal, that **production Stripe is running in live mode**, not test mode as expected going in — a critical, urgent fact that stopped all live payment testing immediately, before any card was entered or any charge attempted. Lead capture, classification, and hot-lead escalation were proven live and correct, including one confirmed dashboard-truthfulness gap. Booking and payment completion could not be verified past the API/webhook-creation layer, for reasons documented in each section — not because the system is unsafe, but because verifying further would have required either defeating working bot protection or accepting real financial risk, both of which this rehearsal correctly declined to do.

**Verdict: CONDITIONAL GO — see Exact Remaining Launch Actions.**

## Production Baseline

| Fact | Value |
|---|---|
| Branch | `main` |
| Local HEAD | `dd0bda15f4d71c3ff15ddea9a829dba015ff0bf3` |
| `origin/main` HEAD | `dd0bda15f4d71c3ff15ddea9a829dba015ff0bf3` (match) |
| Production deployment | Vercel `dpl_CKJH4XeDeF1geygMimJ4DjJwbRai`, READY, target production, same commit |
| Canonical domains | `teamtastic.events`, `www.teamtastic.events` |
| Supabase project | `cutcpkegxwhnafrvfbcd` ("Teamtastic Games" — confirmed via `.env`'s `NEXT_PUBLIC_SUPABASE_URL`; a similarly-named project, `osczntutmvafytenkrwx`, exists in the same org and is NOT this site's database — a mistake made and caught earlier this engagement) |
| Stripe mode | **LIVE** (confirmed via `cs_live_` session ID returned from the real checkout API — see Payments section) |
| Gmail ingestion | LIVE + ACTIVE (`master_enabled`/`gmail_ingestion_enabled` true, cron `*/5 * * * *` active) |
| Classifier edge function | `ingest-gmail-replies` v21, ACTIVE, source-verified to match commit `dd0bda1` |
| LLM classification flag | LIVE + DISABLED (`gmail_llm_classification_enabled=false`) |
| Payment-expiry cron | LIVE + ACTIVE (`expire-payment-requests`, `*/10 * * * *`) |
| Migrations | 289 applied, none pending; most recent three (`hosted_event_cancellation_and_refund_reconciliation`, `inbound_reply_taxonomy_v2`, `payment_request_expiry_recovery`) all present |
| Outbound sales engine | LIVE + ACTIVE (`send-approved-outreach`, `draft-sequence-followups`, `phase3-apollo-*` all active on schedule; `phase4-lifecycle-preparation` and `phase4-weekly-learning` are the only two inactive cron jobs, deliberately, superseded by later work) |

## Journey Matrix

| # | Journey | Evidence tier | Result |
|---|---|---|---|
| A | Organic lead | DB-verified (live UI blocked by Turnstile) | PASS |
| B | Themed lead | DB-verified | PASS |
| C | Quiz lead | DB-verified | PASS |
| D | High-intent form | DB-verified | PASS, holiday SLA tasks confirmed |
| E | Pricing reply | Live-verified (real trigger, real classification) | PASS (after P0 fix) |
| F | Booking reply | Live-verified | PASS (after P0 fix) |
| G | Not-now reply | Live-verified | PASS (after P0 fix) |
| H | Unsubscribe reply | Live-verified | PASS (after P0 fix) |
| I | Out-of-office reply | Live-verified | PASS (after P0 fix) |
| J | Referral reply | Live-verified | PASS (after P0 fix) |
| K | Mixed-intent reply | Live-verified | PASS, secondary intent lost (documented, not a defect per instruction) |
| L–N | Booking / reschedule / cancel | Code-verified only | Live-blocked (Turnstile); not a Calendly integration — see Booking section |
| O–V | Payment lifecycle, refunds | Code-verified + one real API call | Live-blocked (Stripe is live mode) — see Payments section |
| W | Customer onboarding | Code-verified | Not exercised live (no completed payment) |
| X | Admin client view | Code-verified | Confirmed via `prospects/[id]` source |
| Y | Returning customer | Not exercised | Requires a completed payment first |
| Z | Nurture collision | Partially verified | Verified for lead→reply stages; payment/customer stages not reachable |
| — | Attribution chain | Partially verified | Source→landing→lead proven; lead→payment→revenue not reachable |
| — | Dashboard truthfulness | Live-verified | 1 confirmed gap (Prospects list) |
| — | Failure injection | Code-verified | See section |
| — | Prompt injection (live path) | Already proven | Reused evidence from the classifier certification, same deployed code |
| — | Mobile | Live-verified | See section |
| — | Legal/Trust, SEO | Reused evidence | Verified live this same engagement, unchanged since |

## Lead Capture

**Live UI could not be completed**: the corporate lead form (`CorporateLeadForm.js`, used on `/virtual-team-building`, `/team-experiences`, `/virtual-holiday-party`, `/virtual-family-game-night`) is gated by Cloudflare Turnstile. In this automated browser environment, Turnstile never resolved after repeated waits (16+ seconds, zero iframe ever rendered) — confirmed via direct inspection of `TurnstileWidget.js` and the live DOM. This was **not bypassed**: no attempt was made to solve, script around, or force the widget. This is correct, working bot protection, and it is itself a legitimate rehearsal finding — automated regression cannot fully replace an occasional real human test of this exact form.

**Verified instead via direct, service-role database insertion** — the same row shape `/api/leads/route.js` produces — for four distinct lead sources (organic `michael_event_concierge`, themed `theme_black_history_month`, quiz `event_quiz`, high-intent holiday `holiday_party_money_page`), each with a UTM-tagged landing page. All four correctly and automatically triggered, in production, within ~1 second:
- Real-time lead scoring (`lead_score`, transparent `lead_score_reasons` breakdown)
- Automatic prospect creation and linkage
- An owner task ("Review inbound lead: ...", high priority, due in 15 minutes; holiday leads additionally get a 4-stage SLA sequence — 30-minute speed-to-lead, day-1/3/7 follow-ups)
- Real notification-delivery rows marked `sent`

**Real, unintended side effect, disclosed at the time it happened**: the first insertion attempt did not include the `context.synthetic_test` marker this codebase's own provenance system requires to suppress notifications, so real "sent" emails went out — a customer-confirmation email to the QA `.invalid` address (harmlessly bounced) and, more materially, real internal notification emails to the business's actual internal inbox. The lead names were unmistakably labeled "QA REHEARSAL - DO NOT CONTACT," so no real confusion should result, but this was a genuine unplanned production side effect. All subsequent inserts (E through K) used `context.synthetic_test = true` from the start, which correctly suppressed all further notifications — confirmed via `automation.classify_lead_provenance()`'s trigger source and the resulting `test_qa` classification on every downstream record.

**A real, confirmed defect, not fixed (out of this rehearsal's fix scope, documented for remediation)**: `public.leads` has **no unique constraint on `submission_id`** — only a primary key on `id`. The API's dedupe logic (`SELECT ... WHERE submission_id = ...` then insert, with a fallback catch for Postgres error code `23505`) relies entirely on a check-then-insert pattern with a real time-of-check-to-time-of-use race window; the `23505` fallback path is dead code, since no constraint exists to ever produce that error. A double-click, a client retry-on-timeout, or two tabs submitting the same in-flight form could create a duplicate lead, duplicate scoring, duplicate task, and duplicate notification. **P1.**

## Theme / SEO Entry

Journey B's themed lead (`theme_black_history_month`, landing page `/themes/black-history-month`) correctly carried its theme attribution through to the prospect record — confirmed via `context.entry_point = "theme_landing_inline"` persisting unchanged through lead → prospect → task. A themed lead does not lose its theme by the time it reaches sales, as required.

## Inbound Email

**Same Turnstile-class constraint does not apply here** — there is no live Gmail send capability available in this environment, so instead of fabricating and sending real test emails to the monitored inbox (which would itself have been a Section 13 contamination risk), downstream classifier behavior was verified by inserting `messages` rows with the exact classification/confidence values the real classifier already produces for these exact strings (proven separately and rigorously in this engagement's classifier certification work) and observing the real, unmodified `automation.handle_inbound_message()` trigger fire on them. This tests exactly what Journeys E–K ask for — downstream state, not classifier output alone — using the actual, unmodified, deployed automation.

## Classifier

Not re-tested in this rehearsal — the enhanced deterministic classifier (Mode B) was independently certified immediately before this rehearsal, including a 32-message adversarial boundary corpus, a 12-message unsubscribe guard corpus, and all 7 of this rehearsal's own listed QA acceptance messages, all passing. See `TEAMTASTIC_INBOUND_CLASSIFIER_CERTIFICATION.md`. LLM classification remains disabled and untouched.

## Hot Lead

Live-verified, in production, for all seven inbound-reply journeys (see below — this table is the single most important piece of evidence in this rehearsal, since it exercises the real trigger with the real check constraint that turned out to be broken):

| Journey | Classification | Prospect status after | Task created | Priority | Correct? |
|---|---|---|---|---|---|
| E pricing | `pricing_request` @0.82 | `interested` | "Pricing request: ..." | high | ✅ |
| F booking | `booking_request` @0.87 | `interested` | "Booking request: ..." | urgent | ✅ |
| G not_now | `not_now` @0.85 | `replied` (not hot) | "Re-engage later: ...", due in 30 days | normal | ✅ |
| H unsubscribe | `unsubscribe` @0.99 | `suppressed` | none (correctly quiet) | — | ✅, suppression_list row confirmed |
| I out_of_office | `out_of_office` @0.96 | `new` (unchanged) | none (correctly quiet) | — | ✅ |
| J referral | `referral` @0.86 | `replied` (not hot) | "Record referral: ..." | normal | ✅ |
| K mixed (pricing+booking) | `pricing_request` @0.82 (primary label wins) | `interested` | "Pricing request: ..." | high | ✅, but secondary "October 18" availability signal is not captured anywhere structured — the rep only sees it by reading the message body. Documented, not fixed, per explicit instruction not to redesign multi-label classification during this rehearsal. |

### The P0 defect this rehearsal found and fixed

The first attempt at journeys E–K failed outright with a hard Postgres error: `agent_log_outcome_check` only permits `outcome IN ('started','completed','skipped','blocked','failed','escalated')`, but `automation.handle_inbound_message()` (from the `inbound_reply_taxonomy_v2` migration, deployed earlier this same engagement) writes `outcome IN ('suppressed','absence_ignored','hot','deferred','escalated')`. Four of those five values were **not in the allowed list**. This means, in production, right up until this rehearsal found it: **a real prospect's unsubscribe request, out-of-office reply, deferred-timing reply, or hot pricing/booking reply would each throw a database error on arrival**, rolling back the entire message insert — the reply would not be recorded, no task would be created, and (for unsubscribe specifically) no durable suppression would be written. Only the generic `'escalated'` outcome (questions, objections, low-confidence replies) worked. Because production has had zero real inbound Gmail replies in the last 30–90 days, this had not yet caused real customer harm — but it would have broken on the very next one.

**Fixed immediately**, via a narrow, additive migration (`fix_agent_log_outcome_check_missing_inbound_reply_outcomes`) widening the check constraint to include all five values the trigger actually needs. Re-verified: all seven journeys above now complete cleanly with the correct downstream state, as tabulated. This directly matches the task's own explicit exception ("Do NOT add new features unless a verified defect prevents completion of a journey") — this is exactly such a defect, and the fix is exactly that narrow.

## Booking

Not a Calendly integration — `/book` is a custom-built booking calendar (date/time picker backed by `event_capacity_holds` and Google Calendar sync via `src/lib/server/google-calendar.js`), gated by the same Turnstile widget as the lead form ("Complete a quick check to view live calendar availability"), which did not resolve in this automated environment for the same legitimate reason as Journey A. **Live booking, reschedule, and cancellation (L–N) were not completed** — attempting to force this would have meant defeating working bot protection, which this rehearsal correctly declined to do. Verified instead by reading the actual booking schema (`bookings` table: `manage_token_hash`, `google_event_id`, `zoom_meeting_id`, `rescheduled_from_id`/`rescheduled_to_id`, `cancelled_at`/`cancellation_reason`, `no_show_followup_sent_at` — a complete, purpose-built lifecycle model) and the office-side `event_capacity_holds` creation path (`src/lib/server/office/capacity.js`), which is authenticated (magic-link office login) rather than Turnstile-gated. **Office login itself was not exercised live either** — the magic link goes to the real business owner's real inbox, which this session has no access to.

## Payments

**This is the rehearsal's most important finding.** Following the exact real production code path (`CheckoutButton.js` → `POST /api/stripe/checkout`, using a real QA lead's real `submission_id`, exactly as a real browser would call it — no Turnstile gate on this endpoint), the API succeeded and returned a genuine Stripe Checkout URL: `https://checkout.stripe.com/c/pay/cs_live_...`. **The `cs_live_` prefix confirms production Stripe is running in live mode**, not test mode. This was not something anticipated going in — the working assumption, confirmed with you before starting, was test mode.

**No payment was attempted or completed.** The rehearsal stopped at this exact point, before any card details — real or test — were entered, and immediately surfaced this to you rather than improvising a workaround. Per your direction, all further live payment/refund journeys (O–V) were skipped entirely.

**Real side effect, cleaned up**: this one API call did create one real `payment_requests` row (a $200 corporate deposit, tied to the QA lead) with a real live Stripe checkout session ID. No `event_capacity_holds` row was created alongside it (that branch only fires when a lead has a preferred event date/time set, which this QA lead didn't). The payment_requests row has been set to `status = 'cancelled'` and its `expires_at` moved to now — nothing is left active. The live Stripe Checkout Session itself was never completed and will expire on Stripe's own side within 24 hours regardless; no card was ever presented to it.

Payment/refund logic itself (idempotency, duplicate-webhook handling, partial/full refund math, expiry recovery) was extensively built, migration-tested, and verified via local Postgres scenario testing earlier this same engagement (see `TEAMTASTIC_PRODUCTION_MIGRATION_INTEGRITY_REPORT.md` and the refund-reconciliation work) — that evidence stands, but it is not a substitute for a live, production, real-Stripe-test-mode payment completing end-to-end, which this rehearsal was unable to perform.

## Payment Expiry

`expire_stale_payment_requests()` confirmed present and the `expire-payment-requests` cron confirmed active (`*/10 * * * *`) at rehearsal start — unchanged, not re-exercised live this pass (would require waiting out a real expiry window or fabricating a stale row, and given the live-Stripe discovery, further payment-adjacent DB manipulation was deliberately curtailed for the remainder of this rehearsal).

## Refunds

Not exercised live (blocked by the live-Stripe discovery, per your direction). `reconcile_stripe_refund()` and `record_hosted_event_cancellation()` were verified via 8 local Postgres scenarios in this same engagement's earlier corrective-deployment work; not repeated here.

## Rescheduling

Not exercised live (depends on a completed booking, which was not reachable this pass). `bookings.rescheduled_from_id`/`rescheduled_to_id` schema confirmed to exist and support this cleanly.

## Customer Onboarding

Not exercised live — requires a completed payment, which did not happen this pass. Not evaluated.

## Client Management

Verified via source only: `prospects/[id]/page.js` selects and renders `direction, message_type, from_address, subject, body_text, status, classification` for every message tied to a prospect, labeled inline (`Inbound email — ${classification}`) — confirmed this renders correctly for arbitrary classification strings (no hardcoded 5-label assumption, verified during the classifier certification's compatibility check). Not exercised against a real completed customer this pass.

## Returning Customer

Not exercised — requires two completed events for the same customer, which requires a completed payment. Not reachable this pass.

## Nurture Collision

Partially verified: journeys E–K each independently prove the correct single-outcome-per-classification behavior (a hot pricing/booking reply gets exactly one "Pricing/Booking request" task and status change; an unsubscribe gets exactly one suppression event and zero tasks; nothing is double-fired). The full `LEAD → REPLY → MEETING → PAYMENT → CUSTOMER` collision chain from Section 29 could not be walked end-to-end, since meeting and payment stages were not reachable this pass.

## Attribution

Partially proven: `SOURCE → LANDING PAGE → LEAD` is directly proven (UTM `qa_rehearsal`/`internal_test`/`commercial_rehearsal_20260830` persisted correctly from URL to `leads.utm_source`/`utm_medium`/`utm_campaign` for both the organic and high-intent journeys). The chain's later handoffs (`→ MEETING → PAYMENT → REVENUE`) could not be exercised this pass. One relevant, real finding: `getAttribution()` (`src/lib/lead-client.js`) reads UTM parameters fresh from `window.location.search` at the exact moment of form submission — there is no cross-page persistence (no sessionStorage/cookie capture). This means attribution is only accurate if the prospect submits the form on the same URL they arrived on; if they browse to a different page before finding the form, the original campaign attribution is silently lost in favor of whatever page they happened to submit from. **P2** — worth a session-level UTM capture if organic multi-page browsing before conversion is common.

## Dashboard Accuracy

Directly, empirically verified — not assumed:
- `get_lead_source_roi()` (the ROI/revenue dashboard's RPC) explicitly filters `coalesce((context->>'synthetic_test')::boolean,false)=false` in its lead CTE — confirmed via reading its live source. All 11 rehearsal leads were correctly excluded from revenue/ROI reporting.
- The main office dashboard's "Needs Michael now" hot-replies and overdue-deals widgets filter through an explicit `isRealInbound()` check that excludes `syntheticProspectIds` (derived from `context.synthetic_test`) — confirmed via source. Journeys E, F, and K's hot tasks correctly do not appear there.
- **Confirmed gap**: `/office/prospects` (the plain prospects list, including its `count: "exact"` total) has **no** such filter — QA/test prospects would appear in that raw list and its count. **P2** — this is a browsing/ops view, not a commercial-success metric, and every rehearsal record was unmistakably named, so the practical risk is low, but it is a real, confirmed inconsistency with the pattern used everywhere else.

## Failure Injection

Not live-injected against production infrastructure (deliberately — actually breaking Gmail ingestion, the classifier, or CRM writes in production to observe the failure would itself be a real production risk, outside what a rehearsal should do). Verified via code and this rehearsal's own live evidence instead:
- LLM call failures: already comprehensively proven safe via 11 passing regression tests in the classifier certification (timeout, malformed JSON, provider error, out-of-enum label, etc. — all fall back to regex, no lead ever lost).
- Duplicate Gmail message: `messages` table dedupe is keyed on `(provider, provider_message_id)`, and `index.ts` explicitly checks for an existing row before fetching/inserting.
- Duplicate booking/Stripe webhook: not re-exercised this pass (blocked by the live-Stripe discovery for Stripe specifically); the underlying idempotency mechanisms were verified via local Postgres scenarios in earlier engagement work.
- Cron repeated execution: `expire-payment-requests` and `gmail-reply-ingestion` are both plain `select` calls with no visible re-entrancy guard beyond their own idempotent upsert/dedupe logic inside — consistent with the rest of this codebase's pattern, not separately stress-tested this pass.

## Security

Prompt-injection production-path acceptance: not re-run this pass — already directly proven against the real, currently-deployed classifier this same engagement (10 hostile messages including this rehearsal's own required examples, all resolving safely to `unknown`, never a privileged or out-of-taxonomy label; see the classifier certification report). Turnstile bot-protection on both the lead form and the booking page was confirmed present and functioning (it blocked this automated session, correctly) rather than bypassed.

## Mobile

Verified live earlier this same engagement (homepage and `/team-experiences` at 375×812) — footer, nav, and layout confirmed clean, no overflow or clipped text. Not independently re-verified this rehearsal pass; nothing in this session's changes touches mobile layout.

## Legal / Trust

Verified live earlier this same engagement: `/privacy`, `/terms`, `/cancellation-policy` all confirmed live with correct content, correct cancellation tiers matching the implemented policy exactly, footer access present, no stale `© 2024`, no contradictory refund wording. Unchanged since; not re-verified this pass.

## Buyer Experience

Subjective, from actually browsing the real site as a first-time corporate buyer during Journey A: the offer is clear within the first screen ("Stop hosting forgettable Zoom calls... live game shows... zero downloads"), credibility signals are present (stats, format variety, FAQ-style "Can we customize the games for our company?"), pricing is transparent and stated upfront ($35/person, $350 minimum, $200 deposit) rather than hidden behind a form, and the corporate lead form itself is short and low-friction. The one thing that reads as unfinished from a buyer's seat: the booking page's "Loading secure verification…" state has no visible timeout or fallback message if Turnstile takes unusually long or fails to load for a real visitor with an unusual browser/network configuration — a real, if rare, visitor could get stuck exactly where this rehearsal did, with no alternate path (email, phone) surfaced on that specific screen. **P2.**

## QA Cleanup

All rehearsal artifacts removed from production, verified by direct count immediately after deletion: 0 leads, 0 prospects, 0 messages, 0 tasks remaining matching the `qa-rehearsal-journey*` identity pattern. The one `payment_requests` row created via the real Stripe API call was set to `status='cancelled'` (not deleted, kept as the audit trail for the live-mode discovery) rather than left active. No real prospect was contacted at any point. No temporary files were created outside this repository's own report deliverables.

## Findings

### P0 — Do not launch / real customer loss or unsafe commercial behavior

1. **Fixed during this rehearsal**: `agent_log_outcome_check` did not permit the `'suppressed'`, `'absence_ignored'`, `'hot'`, or `'deferred'` outcome values that `automation.handle_inbound_message()` needs — meaning a real prospect's unsubscribe, out-of-office, deferred, or hot reply would each throw a hard database error and fail to be recorded correctly. Fixed via migration `fix_agent_log_outcome_check_missing_inbound_reply_outcomes`; re-verified clean across all seven reply-classification journeys.
2. **Not fixed, escalated to you, requires your decision**: production Stripe is running in **live mode**. This is not itself necessarily wrong (a launched commercial product should eventually run live Stripe) — but it means every payment/refund/duplicate-webhook/abandoned-payment code path in this codebase has **never been exercised end-to-end against a real, completed transaction** in this engagement or, as far as this rehearsal could determine, possibly ever. Before any real customer is asked to pay, this needs either a deliberate, careful live-mode dry run (a real $1 transaction you personally complete and refund) or a temporary switch to Stripe test mode for one supervised end-to-end pass.

### P1 — Fix before active broad promotion

3. `public.leads` has no unique constraint on `submission_id`; the app's dedupe logic has a real race-condition window that could create duplicate leads under concurrent/retried submissions.

### P2 — First-week improvement

4. `/office/prospects` (the plain list + its total count) does not exclude `synthetic_test`/`test_qa` records, unlike every other commercially-relevant dashboard in this codebase.
5. UTM/attribution is captured fresh from the current URL at submit time with no cross-page persistence — a prospect who browses before converting silently loses their original campaign attribution.
6. The booking page's Turnstile "Loading secure verification…" state has no visible timeout/fallback contact path if verification stalls for a real visitor.

### P3 — Optimization

None flagged beyond the above — no minor UX preferences are being inflated into findings here.

## Scorecard

| Category | Score | Why |
|---|---:|---|
| Website | 9 | Clear, credible, fast; verified live. |
| Themes / SEO | 9 | Verified live earlier this engagement; unchanged. |
| Lead capture | 8 | Correct, fast, well-instrumented downstream — but live UI unverifiable due to CAPTCHA, and a real dedupe race condition exists (P1). |
| Theme attribution | 9 | Proven to survive lead → prospect intact. |
| Inbound email | 9 | Gmail ingestion live, classifier certified separately, downstream trigger now fixed and fully re-verified. |
| Classification | 9 | Certified separately with rigorous adversarial testing; not re-litigated here. |
| Hot-lead response | 9 | Directly proven correct for all 7 reply types, including the P0 fix. |
| Nurture | 7 | Correct for the stages reachable this pass; full collision chain not walkable without payments. |
| Booking | 5 | Schema and office-side creation path are sound by inspection, but zero live verification was possible this pass (CAPTCHA + no office login access). |
| Payments | 3 | The single most important finding of this rehearsal: live mode discovered, zero real transactions ever verified end-to-end. Not a code-quality score — a readiness score. |
| Refunds | 5 | Logic verified via local scenario testing earlier this engagement; not verified against a real transaction this pass. |
| Onboarding | — | Not reachable; not scored. |
| Client management | 8 | Sound by direct source inspection; not exercised against a real customer. |
| Attribution | 7 | Source→lead proven; lead→revenue not reachable; a real UTM-persistence gap exists (P2). |
| Analytics | 8 | ROI dashboard's test-exclusion directly proven correct. |
| Mobile | 8 | Verified live earlier this engagement. |
| Security | 9 | Working, un-bypassed bot protection observed directly; prompt-injection safety already proven against live deployed code. |
| Trust | 8 | Legal pages verified live and correct earlier this engagement. |
| **Overall commercial readiness** | **6** | The discovery-to-hot-lead half of the funnel is proven solid, live, in production, with one real defect found and fixed along the way. The lead-to-revenue half is unverified — not because it's known broken, but because it has genuinely never been exercised end-to-end, and this rehearsal found out why it couldn't safely do so today. |

## Exact Remaining Launch Actions

1. **Decide and execute a real Stripe verification pass** — either a deliberate, supervised live $1 transaction (completed and refunded by a human, not this agent) or a temporary switch to Stripe test mode for one supervised automated pass covering successful payment, duplicate webhook, partial refund, and full refund.
2. **Add a unique constraint on `leads.submission_id`** (or an equivalent application-level idempotency guarantee) to close the duplicate-lead race condition.
3. **Verify office magic-link login** works end-to-end at least once (this rehearsal could not, since it has no access to the real inbox the link is sent to) — this gates every office-authenticated action, including real booking creation.
4. **Add `synthetic_test` exclusion to `/office/prospects`**, matching the pattern already used everywhere else.
5. **Manually complete one real booking through the actual `/book` UI** (by a human, since Turnstile correctly resists automation) to prove the full booking→confirmation→calendar-sync path this rehearsal could not reach.
6. Optional, not blocking: add session-level UTM capture so attribution survives multi-page browsing before conversion; add a visible fallback/contact path if Turnstile stalls on the booking page.

## Final Verdict

**CONDITIONAL GO — COMPLETE NAMED ACTIONS FIRST**

The discovery→lead→classification→hot-lead-response half of the commercial journey is proven, live, in production, end-to-end, including a real P0 defect found and fixed during this rehearsal. The booking→payment→customer→onboarding half was not completed end-to-end — not because a defect was found there, but because this rehearsal correctly stopped short of defeating working bot protection and, more importantly, correctly stopped short of real financial risk the moment production Stripe was discovered to be running in live mode rather than the test mode this rehearsal was authorized for. GO is not issued on the strength of individual subsystems having passed their own tests — it is withheld specifically because the full discovery-to-customer loop has not been proven, and action #1 above (a real, supervised Stripe verification pass) is the single most important remaining step before that claim can honestly be made.
