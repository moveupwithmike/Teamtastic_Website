# Phase 4 — Code Complexity & Async/Webhook Reliability (Pass 2)

Covers prompt §8 (Code Complexity) and §9 (Real-Time Application Concerns, reframed per the plan's
scope note — this repo has no persistent-connection/realtime-subscription layer, confirmed again
in this pass; the lens is webhook idempotency, async pipeline reliability, and concurrency safety
under Postgres-backed coordination). Builds on
[phase-1-architecture-layers-v2.md](phase-1-architecture-layers-v2.md) and
[phase-2-refactoring-maintainability-v2.md](phase-2-refactoring-maintainability-v2.md).

## 1. Complexity hotspots — measured, not impressionistic

Used a branching-density proxy (count of `if`/`else`/`??`/`?.`/`&&`/`||`/`catch`/`switch` per
file) alongside line count, since raw line count alone doesn't distinguish a long-but-linear file
from a genuinely branchy one:

| File | Lines | Branch/logic ops | Ops per 10 lines |
|---|---|---|---|
| `src/lib/server/office/proposals.js` | 256 | 73 | 2.9 |
| `supabase/functions/send-daily-sales-report/index.ts` | 197 | 51 | 2.6 |
| `src/app/api/bookings/reschedule/route.js` | 280 | 52 | 1.9 |
| `src/app/api/bookings/confirm/route.js` | 281 | 51 | 1.8 |
| `supabase/functions/process-phase3-pipeline/index.ts` | 254 | 40 | 1.6 |
| `src/lib/server/office/sales-response.js` | 130 | 37 | 2.8 |

`proposals.js` is the density leader, not just the line-count leader — its single largest function,
`approveAndSendProposal` (lines 125–216, 92 lines), is where that concentrates.

**Is it legitimate or accidental complexity?** Read in full: `approveAndSendProposal` implements a
claim → send → finalize saga — status-claim via `.update(...).in("status", [...])` to prevent a
double-send race, a Resend send with an idempotency key, and a `finalize_proposal_send` RPC call
that reconciles the CRM state. If the email sends but CRM finalization fails, it explicitly creates
an urgent reconciliation task (`fingerprint`-deduped upsert) rather than losing that fact silently.
This is structurally the *same pattern* as `bookings/confirm/route.js`'s
hold→Zoom→Calendar→confirm→email saga, assessed as legitimate orchestration in Phase 1 — both are
compensating-transaction flows over external systems (Resend/Stripe-adjacent money flow here, Zoom/
Calendar there), and both correctly avoid silently swallowing partial-failure states. **Verdict:
legitimate domain complexity**, consistently applied across the two highest-stakes flows in the
codebase, not a candidate for simplification — the branching *is* the compensating-transaction
logic the flow requires.

`send-daily-sales-report/index.ts`'s density comes from assembling a multi-section HTML report
(activity counts, replies-by-category, pipeline, tasks, "what the system chose not to do",
Monday-only deliverability section) — branchy because it's rendering several independent
conditional sections, not because of tangled control flow. Also legitimate.

No hotspot in this pass represents *accidental* complexity (poor structure, deep unnecessary
nesting, a god-function doing unrelated things) — everything above is domain complexity that
matches what the flow actually has to do.

## 2. Async/webhook reliability

### 2a. Deno `sendViaResend()` idempotency — confirmed sound, no regression

Re-verified every Edge Function call site against the function's own required-parameter contract
(Phase 2 Finding 1 established the Deno version fails closed without a key):

| Function | `sendViaResend()` calls | `idempotencyKey:` occurrences |
|---|---|---|
| notify-new-lead | 1 | 1 |
| send-approved-outreach | 1 | 1 |
| send-booking-reminders | 2 | 2 |
| send-daily-sales-report | 1 | 1 |
| send-nurture-emails | 1 | 1 |

1:1 everywhere — no Deno call site has drifted since the fix. This is the Deno half of Phase 2
Finding 1; the JS half (`src/lib/server/email.js`, 4 of 7 call sites missing the key) is a real
reliability gap in this phase's terms too: **retriable JS routes can double-send**. Restating the
specific risk in reliability language rather than repeating the finding: `bookings/cancel`,
`bookings/confirm`, and `bookings/reschedule` are hit by a public-facing API that a flaky client or
browser back-button can resubmit, and `stripe/webhook` is retried by Stripe itself on any non-2xx
response — all four currently rely solely on `reserve_email_send`'s per-message-type rate window
for duplicate protection, not a request-level idempotency key. Not repeating the fix recommendation
here — see Phase 2 Finding 1 — but flagging that this is the one place in the async surface where a
concrete reliability consequence (duplicate customer-facing email) is live today, not hypothetical.

### 2b. `try_claim_magic_link_send` advisory-lock pattern — sound, and correctly scales

Re-read `supabase/migrations/20260723000700_office_magic_link_lock.sql` specifically for the class
of bug the plan calls out: "assumptions that work on a single server but may fail when multiple
application instances are running."

- Uses `pg_try_advisory_xact_lock(hashtextextended('office_magic_link:'||normalized_email, 0))` —
  a **transaction-scoped, non-blocking** lock keyed on the normalized email. Two concurrent calls
  for the *same* email: the second's `pg_try_advisory_xact_lock` call returns `false` immediately
  (it doesn't wait), so it exits early without checking the cooldown or inserting a claim row —
  correctly avoiding a race window between "check cooldown" and "insert claim."
- The lock lives in Postgres, not in application memory — this means it works correctly under
  Vercel's horizontally-scaled serverless functions (any number of concurrent Lambda instances
  calling this RPC coordinate through the same database lock) without any of the "worked on my
  single dev server, breaks in production" failure mode the prompt specifically warns about.
- The 60-second cooldown check (`agent_log` row with `action='office_magic_link_send_claim'`
  within the last 60s) happens *inside* the same lock-held transaction, so there's no TOCTOU gap
  between checking and claiming.

No finding here — this is a correctly-designed piece of concurrency-safe code, worth calling out
as a positive pattern (Phase 6 "What's Working Well" candidate).

### 2c. Booking-slot race protection — backed by a real DB constraint, not app-level check-then-act

`hold_booking_slot()` (`supabase/migrations/20260719050500_phase1_5_booking_zoom_gate.sql`) does
*not* prevent double-booking by querying for overlaps and then conditionally inserting (the classic
TOCTOU race under concurrency). It inserts unconditionally and relies on a Postgres **`EXCLUDE
USING gist`** constraint on the `bookings` table (defined in
`20260718232853_native_booking_foundation.sql:108`) to atomically reject an overlapping insert,
caught via `exception when exclusion_violation` and translated to a clean `slot_unavailable`
response. This is the correct way to solve this class of concurrency problem — verified the
constraint actually exists rather than assuming the exception handler is reachable. No finding;
another positive pattern.

### 2d. Apollo enrichment retry-scoping — confirmed intact

`process-apollo-enrichment/index.ts` tags each claimed item with `claimed_by_run_id: run.id`
(line 68) and scopes its failure-reset query to `request_payload->>claimed_by_run_id = run.id`
(line 137) — meaning a stuck/failed run only resets *its own* claimed items on retry, not items
concurrently claimed by an overlapping run. Confirmed unchanged since the Aug 15 fix.

### 2e. Webhook signature verification — confirmed present, cross-referencing Phase 3

Both Stripe (`constructEvent`) and Resend (svix `verify()`) webhook handlers reject invalid
signatures before processing — already evidenced with test coverage in Phase 3 §4, re-confirmed
here from the reliability angle: signature verification is the correct first gate before any
idempotency/processing logic runs, and it runs first in both handlers (checked the code path order,
not just that the check exists).

## Summary

No accidental complexity found — every hotspot identified maps to real domain complexity
(compensating-transaction sagas, multi-section report assembly) implemented consistently. Two
genuinely sound concurrency-safety patterns worth preserving as-is (`try_claim_magic_link_send`'s
DB-level advisory lock, `hold_booking_slot`'s exclusion-constraint-backed race protection). The one
live reliability gap in this phase — JS-side `sendViaResend()` missing idempotency keys on 4
retriable routes — is the same finding as Phase 2 Finding 1, restated here in reliability terms
because it's this phase's territory to confirm the *consequence*, not to re-derive the fix.
