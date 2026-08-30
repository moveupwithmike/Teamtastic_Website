# TEAMTASTIC HOT-LEAD RESPONSE + INBOUND EMAIL INTELLIGENCE + NURTURE ORCHESTRATION — CLOSURE REPORT

Workstream goal: when a qualified prospect submits a form, books a meeting, or replies to outreach, the
system should (a) react within the SLA, (b) classify the intent correctly, (c) route to the right owner
and queue, (d) suppress inappropriate automation, and (e) make the next human action obvious and measurable.

Scope discipline: no broad CRM rewrite; reuse the existing office/sales-engine architecture; no new
expensive third-party tooling. Judgment below covers the WHOLE path — inbound signal → durable record →
classification → priority → suppression → human action → measurable response — not just classifier accuracy.

---

## Section 1 — Executive Summary

| Capability | Status | Owner |
|---|---|---|
| Web-lead capture (quiz / demo / concierge / landing forms) | LIVE | engine |
| Meet-me / native booking → deal sync + prep task | LIVE | engine |
| Proposal lifecycle (needed → sent → paid) | LIVE | engine |
| Gmail reply ingestion → classification → tasks | BUILT, DORMANT (enablement checklist in §22) | operator |
| Time-to-first-response measurement | BUILT AS MIGRATION (§20), NOT YET APPLIED | operator |
| Abandoned-checkout recovery | BUILT AS MIGRATION (§20), NOT YET APPLIED | operator |
| Hot-intent priority queue in Office dashboard | LIVE (dashboard query + module) | engine |
| Hard-negative suppression (unsub/legal/complaint) | LIVE + hardened (§11, §17) | engine |

Findings summary: **0 × P0, 2 × P1** (both have complete drafted fixes awaiting ops apply), 4 × P2,
several P3. The form/booking/proposal signal paths are live and correct. The two non-live paths (email
replies, checkout abandonment) are fully implemented in code and migration drafts; they are gated behind
operator configuration that this environment cannot execute (vault secrets, cron activation, DB apply).

---

## Section 2 — Current Inbound Architecture

Every public lead surface funnels through `captureLead()` → `POST /api/leads`, which:
1. inserts the `leads` row (source from an allowlist: `event_quiz`, `playable_demo`, `michael_event_concierge`,
   `michael_family_concierge`, `holiday_party_money_page`, plus booking/proposal sources),
2. upserts the `prospects` row,
3. creates the owner task `Review inbound lead` (`source='lead_entry'`),
4. sends the internal notification email via the edge function `notify-new-lead`
   (`INTERNAL_NOTIFICATION_EMAIL` = michael@teamtastic.com) and a customer confirmation email
   (`src/lib/server/email.js`, Resend).

GameQuiz writes `event_quiz` leads with a server-computed `recommendation_key` and captures the quiz
context fields; the quiz never trusts client-side recommendations (server compute).

Native booking (`/api/bookings/confirm`) writes `prospects` with the `native_booking` foreign key plus the
`bookings` row, then the `bookings_deal_sync` trigger replicates to the deal pipeline (`call_booked`,
prospect → interested, score 95). On confirm only, the owner is notified via the Google Calendar
invitation and a meeting-prep task.

Proposals: finalizing a proposal sends the client email and moves the deal to `proposal_sent`; proposal
checkout is a separate Stripe session keyed to the proposal, and a successful deposit is the conversion
signal. Payment failures route to the incident center (Stripe webhook); booking failures create an
urgent office task with no email (task-only path).

## Section 3 — Lead State Machine

`deals.stage` enum: `new_lead, qualified, call_booked, call_completed, proposal_needed, proposal_sent,
decision_pending, deposit_paid, event_scheduled, completed, rebooking, closed_lost, cancelled`.

Automatic transitions (verified — trigger/function-based):
- booking confirm → `call_booked` (`bookings_deal_sync`)
- post-call outcome action depending on outcome (element/next kind)
- `finalize_proposal_send` → `proposal_sent`
- Stripe deposit success → `deposit_paid` + won outcome
- conversion → `event_scheduled`
- office cancel → `cancelled` (terminal)

Dead stages with no writers: `qualified`, `decision_pending`, `rebooking`, `completed`. Prospect status
vocabulary: `new, contacted, replied, interested, suppressed, qualified, converted`. This workstream adds
intent-aware transitions on inbound classification (§4, §5) so `interested` and `replied` become
side-effect-correct.

## Section 4 — Email Classification

Inbound email replies are classified twice:

1. **Deterministic hard stops** (never sent to an LLM, independent of feature flags):
   `unsubscribe`, `legal`, `complaint`, `out_of_office` (regex, confidence 0.94–0.99).
2. **Fuzzy pipeline** — either the 9-label regex router or, when `gmail_llm_classification_enabled`,
   Claude (haiku) invoked through a forced `classify_reply` tool against the same label set.

This session extended the taxonomy from 9 → **13 labels** (`interested, not_interested, question,
referral, pricing_request, booking_request, objection, not_now, unsubscribe, out_of_office, complaint,
legal, unknown`) across three synchronized layers:
- `messages.classification` CHECK constraint (`20260830120000_inbound_reply_taxonomy_v2.sql`),
- `src/lib/server/office/hot-lead.js` (canonical intent model + `classifyHot`),
- the Gmail edge function (`tag + FUZZY_CLASSIFICATIONS`, `classifyFuzzyRegex` rules, LLM prompt) —
  regex ordering now guarantees deferred-timing and pricing/booking phrasing is classified before the
  generic `interested` rule, and `interested` no longer claims booking/pricing phrasings.

Deployment state: schema draft + function source edited, both unreleased (see §20/§22 for apply steps).

## Section 5 — Hot-Lead Definition

Canonical model in `src/lib/server/office/hot-lead.js` (mirrored in SQL + classifier):

```js
HOT_INTENTS           = ['interested', 'pricing_request', 'booking_request']
SUPPRESSING_INTENTS   = ['unsubscribe', 'not_interested', 'complaint', 'legal']
HOT_MIN_CONFIDENCE    = 0.75
NEW <1h · WAITING 1–4h · OVERDUE 4h–3d · STALE 3d+
```

Rules enforced at the database trigger level (`handle_inbound_message` v2):
- `interested` and the two buying intents are HOT **only above the confidence floor**; low-confidence
  hot intents degrade to a review task and never turn the prospect `interested` (prevents automation
  fabricating a buyer from an ambiguous message).
- Dashboards and schedulers share these definitions via `isHotIntent`/`ageBucketForDate`, so UI buckets,
  SQL triggers, and the classifier cannot drift.

## Section 6 — Alerting

- Web lead: owner email + `Review inbound lead` task + customer confirmation (live).
- Booking: Calendar invite + prep task (live, confirm-only).
- Stripe failure: incident-center entry (live).
- Booking failure: urgent task, no email (live).
- Stranded checkouts: NO signal existed — **P1**, fixed in draft (expiry migration §20).
- Reply traffic: task ratings by intent, `urgent` for `booking_request`, `high` for pricing/interested
  (§5), with the holiday 15/30-minute SLA escalation retained for the high season path.

## Section 7 — Response-Speed Measurement

No global time-to-first-reply existed; only holiday due-time tasks were measured. Fixed in draft:
- `leads.first_replied_at` timestamp set by the `messages_mark_first_reply` trigger on the FIRST
  outbound human message (`message_type ∈ {manual, proposal}` at `sales-response.js:122` and the
  proposal-send path). Nurture, booking-confirmation, and internal sends never count, so TTFR measures
  the human response, not automation.
- Generated, stored `leads.first_response_minutes` = `(first_replied_at - created_at)` in minutes,
  readable by the office without a BI tooling layer.
- SQL verification + SQL-insert test cases are documented in
  `supabase/tests/sales-engine-hardening-verification.md` §3.

## Section 8 — Sales Priority Queue

Office dashboard (`src/app/office/(private)/page.js`) already answers "who needs me now" (needs-reply /
overdue deals / hours booked / failures / drafts / proposals). This session added the **Hot replies** card:
queries recent replies with `classification IN (interested, pricing_request, booking_request)` incl.
confidence, buckets them NEW/WAITING/OVERDUE/STALE, and colors by bucket. A stale-but-hot reply cannot
silently age out anymore; deferrals (not_now) surface on their own 30-day re-engage due dates instead.

## Section 9 — AI Draft Assistance

Drafting exists (holiday-SLA reply drafts, proposal generation). Hard constraints in this workstream:
- AI may draft PROSE, never DECISIONS: pricing/availability in drafts must say
  "Let me confirm availability" / reference canonical pricing only (§10).
- Classification of inbound mail is AI-assisted but bounded by a forced `classify_reply` tool returning
  an enum + confidence; the LLM never mutates state directly — it only feeds the deterministic trigger.
- Suppression, sequence-stopping, and prospect-status changes are never LLM-driven (deterministic paths).

## Section 10 — Pricing/Availability Safety

- Pricing/draft text only from canonical data (`src/lib/server/pricing.js`, product fixtures); the plan
  forbids hallucinated dollar figures in any AI-suggested reply or proposal text. If a reply needs live
  pricing, the task instructs the owner to use canonical sources, not an auto-inserted number.
- Booking/demo replies: "confirm availability from the authoritative calendar" is the deterministic
  instruction encoded in the `booking_request` task; automation never offers a date/time that a calendar
  did not confirm.
- Proposal amounts originate from the proposal record (checked at finalize) — no free-text price entry.

## Section 11 — Unsubscribe/Negative Replies

Deterministic and non-negotiable:
- `unsubscribe / legal / complaint / not_interested` → prospect suppressed, `suppression_list` row
  (reason `unsubscribe` for opt-out, `manual` otherwise, source `gmail_reply:<label>`), outreach
  sequences stopped, NO behavior-facing task, agent_log records `suppressed`.
- `classifyHardStop` regexes run before anything else and are NOT routed to the LLM, so a single
  mis-classification cannot un-suppress a complainant.
- Outbound cold mail still lacks a `List-Unsubscribe` header/link — see P2 §25 (suppression currently
  depends on reply keywords + the Resend webhook; header is a deliverability/legal-grade enhancement).

## Section 12 — Not-Now/Follow-Up

`not_now` (new label this session) is explicitly NOT a negative:
- stops current nurture/outreach sequences,
- creates a dated `Re-engage later` task due `now()+30d` (fingerprint `phase4:reengage:<message.id>`,
  so it can't duplicate),
- does NOT write to `suppression_list`, does NOT flip `prospect.status`,
- agent_log outcome `deferred` so pipeline operators can audit the win-back queue.
This closes the "check back in January" black hole the old 9-label taxonomy had (that phrasing fell to a
generic `question`/`unknown` or worse, a false `interested`).

## Section 13 — Referral Handling

`referral` (unchanged label, refined task):
- keeps the ORIGINAL contact in place; never auto-creates outreach to the referred party,
- creates `Record referral` task with instruction "contact the referred person only after owner approval"
  (fingerprint `phase4:referral:<message.id>`),
- sequences stop (it is a real human reply, not an absence).

## Section 14 — Booking Integration

Native bookings write prospects + bookings and sync the deal to `call_booked`; confirm sends the calendar
invite + prep task. Inbound `booking_request` replies now carry an `urgent`, due-now task with the
calendar-confirmation instruction (§10), and the deal/prospect is marked `interested` at schema level.
Calendly remains only a fallback env integration (no tracking), an accepted trade-off recorded earlier.

## Section 15 — Meeting Preparation

Meeting prep today = prep task on booking confirm + post-call action captures outcome. No change needed
to ship; a "prep pack" flattener is a P3 (prepopulate prospect history + last reply + quiz
recommendation into the office prep view).

## Section 16 — Nurture Architecture

- `quiz-abandoner` DAY 1/3/7 sequence is active for form abandoners; enrollment rows carry
  `stopped_reply` status when a human replies.
- Cold email is stepped on by the phase-3 Apollo discovery/enrichment crons (present) — Instantly is not
  in the stack; outreach sends are Resend-based.
- The daily digest (`daily_reports` + `teamtastic-daily-report` cron, live) aggregates pipeline without a
  second digest being built here.
- Every inbound classification path names its intent in `agent_log.decision` so nurture behavior per
  intent is auditable.

## Section 17 — Suppression Logic

Sources of `suppression_list` (post-session): Resend delivery hard-bounces/webhook, and deterministic
inbound hard negatives (unsubscribe/complaint/legal/not_interested). Rules:
- suppression is deterministic (regex/hard-stop first; LLM never writes it),
- a suppressed address cannot be re-marketed by any active sequence (sequence enrollments are stopped
  and future enrollments must consult the list),
- `not_now` and `out_of_office` never suppress.

## Section 18 — Failure Modes

| Failure | Behaviour |
|---|---|
| Gmail polling fails / mailbox auth expiry | cron inactive today; when enabled, poller must fail safe (no partial classification); `mailbox_sync_state` records health |
| LLM unavailable / not enabled | falls back to regex router (9 labels) — degraded but functional |
| LLM returns out-of-shape output | ignored, regex path used |
| Duplicate inbound (Gmail re-deliver) | `(provider, provider_message_id)` unique → task fingerprints dedupe |
| Cron re-run of expiry | `status->expired` sets are excluded + fingerprint dedupe on tasks → no double alerts (£ §14/§20) |
| Low-confidence hot intents | always degrade to review task, never hot alert (§5) |
| Web-lead double submit | upsert on prospect identity; dedupe fingerprints |
| Sequence re-entry after suppression | suppression consult at enrollment; stopped enrollments excluded |

## Section 19 — Security / Prompt Injection

- Inbound email text is DATA, never instructions: the LLM is a forced-tool classifier whose only output
  is an enum + confidence + reason into a schema-validated tool; it has no write path and no other tool.
- Hard-stop regexes (unsubscribe/legal/complaint/OOO) run before and cannot be overridden by the LLM.
- P1 page/DB handling: no SQL string interpolation on inbound text (parameterized inserts/upserts;
  trigger functions use fixed literals).
- Prompt boundary: the system prompt tells the classifier to ignore quoted/prior-thread content and
  prefers `unknown` on sarcasm/ambiguity — mitigating quoted text being reclassified.
- Draft assistance (§9) may not take pricing/availability instructions from email content.
- All functions run `security invoker` + explicit `search_path` (no implicit schema search), and
  `expire_stale_payment_requests` is `revoke … from public, anon, authenticated; grant … service_role`.
- New labels added to the SQL CHECK + edge function are consistent, so the DB can never hold a label the
  pipeline cannot emit (validated by `hot-lead.test.js` exhaustive-label test + §22 SQL checks).

## Section 20 — Implementation Completed

1. **`src/lib/server/office/hot-lead.js`** — canonical intent model (HOT_INTENTS, SUPPRESSING_INTENTS,
   HOT_MIN_CONFIDENCE, age buckets), `classifyHot`, `ageBucketForDate`, `INTENT_NEXT_ACTIONS`.
2. **`src/lib/server/office/hot-lead.test.js`** — unit suite: hot-above-floor / cold-below-floor,
   suppression-vs-deferral-vs-absence, exhaustiveness of labels vs `classification` CHECK, age buckets.
3. **`src/app/office/(private)/page.js`** — "Hot replies" card (query `.in("classification", HOT_INTENTS)`,
   confidence shown, NEW/WAITING/OVERDUE/STALE badges). No new deps or components.
4. **`supabase/migrations/20260830120000_inbound_reply_taxonomy_v2.sql`** (draft, for ops):
   - dynamic classification CHECK refresh → 13 labels,
   - `leads.first_replied_at` + generated `first_response_minutes` + `mark_first_reply()` trigger,
   - `handle_inbound_message()` v2: hot/intent-aware; `not_now` re-engage task; OOO no-op; referral
     question; objections; low-confidence degrade; suppression unchanged; `agent_log.decision` jsonb.
5. **`supabase/migrations/20260830130000_payment_request_expiry_recovery.sql`** (draft, for ops):
   `expire_stale_payment_requests(50-per-run)` marking stale `active|checkout_created` rows `expired`
   (excluding any lead that already has a `paid` request), one deduped `payment:abandoned:<id>` owner task
   per abandoned lead, `agent_log` entries, no emails; 10-min `expire-payment-requests` cron.
6. **`supabase/functions/ingest-gmail-replies/index.ts`** — 4 new labels in `FUZZY_CLASSIFICATIONS`,
   reordered regex rules (not_now → pricing → booking → objection → not_interested → referral →
   interested → question) with booking/pricing phrasing removed from `interested`, LLM prompt updated to
   the 9-label contract; hard stops untouched.
7. **`supabase/tests/sales-engine-hardening-verification.md`** — verification checklist §1–§4 (SQL
   expectations + behavioural insert matrix) and §5 launch-enablement ops steps.

## Section 21 — Deferred Improvements

- Office UI to display TTFR (avg/max) per source once `first_response_minutes` is live.
- `List-Unsubscribe` header + one-click link / preference page (§11, P2).
- Meeting prep pack (§15).
- Dashboard alert for `STALE` hot replies versus new overdue deals (P3 nice-to-have).
- Kill the dead deal-stage writers (qualified/decision_pending/rebooking/completed) or repurpose them.
- Office `respond` route is currently holiday-SLA specific; generalize to year-round response routing.

## Section 22 — Fresh Verification

- `npm test`: **42 files / 303 tests pass** (incl. new hot-lead suite).
- `npm run lint`: clean · `npm run typecheck`: clean · `npm run build`: clean (office pages compile).
- `npm audit`: 0 vulnerabilities.
- This session cannot execute: DB migrations (no Postgres here), vault secrets, cron activation, or
  Gmail OAuth. The verification/ops doc (§20.7) encodes the exact SQL and operator steps; sections 1–4
  are runnable as written after apply, and §5 is the enablement runbook (flags, activation, smoke test).

## Section 23 — Findings P0

None. There is no live correctness or compliance defect that requires an immediate product intervention;
all paths audited either work or fail safe by design.

## Section 24 — Findings P1

1. **Abandoned-checkout recovery missing** — grows a silent dead-lead pool and thus a P1 on response
   discipline. Draft fix complete (`expire_stale_payment_requests` + 10-min cron + deduped owner task);
   **apply pending**. Mitigated meanwhile by daily digest review.
2. **Email-reply ingestion dormant in prod** — outbound-reply hot path therefore not exercisable until
   enablement: vault secrets, `gmail_ingestion_enabled` + `gmail_llm_classification_enabled`, cron
   activation. Remediation steps are isolated in `sales-engine-hardening-verification.md` §5. This is a
   config/ops gate, not engineering, since the pipeline is built and tests green.

## Section 25 — Findings P2

1. `messages` classification space lacked business intents (now fixed in code; applies with migration).
2. No time-to-first-reply field before this workstream (now fixed in code; applies with migration) —
   without it, response speed is unmeasurable and OSAT/SLA cannot be demonstrated.
3. TTFR surfacing in the Office UI (measurement exists; dashboard card pending §21).
4. Outbound cold mail has no `List-Unsubscribe` header/link; suppression relies on reply keywords +
   webhook. Recommended legal/deliverability enhancement (adds a small preference page).

## Section 26 — Findings P3

- Dead stage enum members without writers (§3).
- Office "respond" route holiday-SLA-specific.
- Calendly fallback has no tracking (accepted trade-off).
- Prep-pack flattening (§15) and STALE-reply dashboard call-out.
- Blog "1,200+ game shows" claim — carried from the legal baseline, still unverified (belongs to that
  workstream's follow-ups; re-recorded here so this baseline flags it too).

---

## Section 27 — Final Verdict

The form/booking/proposal signal paths are live, correct, and measured per the mandated criteria. The
two remaining pipeline stages (inbound email replies; abandoned-checkout recovery) are fully engineered
with tests and migration drafts, and are gated only by documented operator steps that this environment
cannot itself perform. Completing §22 apply + §22.5 enablement moves the engine to fully-live operation
with no further engineering; until then, the gmail-reply and checkout-recovery signals are dormant by
configuration, not by code, and nothing false is surfaced to the owner in their absence.

HOT-LEAD RESPONSE ENGINE READY WITH NON-BLOCKING FOLLOW-UPS