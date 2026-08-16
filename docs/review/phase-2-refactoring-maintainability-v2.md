# Phase 2 — Refactoring Opportunities & Maintainability (Pass 2)

Covers prompt §4 (Refactoring Opportunities) and §5 (Maintainability). Builds on
[phase-0-architecture-map-v2.md](phase-0-architecture-map-v2.md) and
[phase-1-architecture-layers-v2.md](phase-1-architecture-layers-v2.md).

## Ranked findings

### 1. JS `sendViaResend()`'s optional `idempotencyKey` lets 4 of 7 call sites silently skip it — the Deno side closed this exact gap, the JS side didn't

**Finding**: `src/lib/server/email.js`'s `sendViaResend()` treats `idempotencyKey` as optional
(`idempotencyKey?: string` at `email.js:16`; only sets the header `if (idempotencyKey)` at
`email.js:39`). The Deno equivalent, `supabase/functions/_shared/email.ts`'s `sendViaResend()`,
makes it a required parameter and fails closed if it's missing or blank
(`email.ts:21` types it as `string` not `string | undefined`; `email.ts:39-41` returns
`idempotency_key_required` before even attempting a reservation if it's empty). Same function
name, same purpose, same module family — different safety guarantee.

**Evidence**: grepped every JS call site of `sendViaResend(`:
- `src/app/api/bookings/cancel/route.js:33-38` — no `idempotencyKey`
- `src/app/api/bookings/confirm/route.js:80-85` — no `idempotencyKey`
- `src/app/api/bookings/reschedule/route.js:62-67` — no `idempotencyKey`
- `src/app/api/stripe/webhook/route.js:24-29` — no `idempotencyKey`
- `src/lib/server/office/authentication.js:53-60` — has `idempotencyKey` (`office-magic-link/${tokenHash}`)
- `src/lib/server/office/proposals.js:162-168` — has `idempotencyKey` (`proposal/${id}`)
- `src/lib/server/office/sales-response.js:93-99` — has `idempotencyKey` (`sales-response/${id}`)

The 4 missing are exactly the booking-lifecycle and Stripe-webhook notification emails — the
call sites most likely to be retried (a booking API route can be hit again by a flaky client;
Stripe webhooks are retried by Stripe itself on non-2xx). This is the same class of bug the Aug 15
review's #1 finding described (drift in which copies of the send-email pattern remembered the
idempotency key) — the *mechanism* got centralized into one function, but *usage* of that
function's optional parameter still drifted, and the Deno port of the same helper (written after
the JS one, per the file timestamps) fixed it there by making the parameter required rather than
optional, without the fix being carried back to JS.

**Impact**: a duplicate booking-cancellation, booking-confirmation, booking-reschedule, or
Stripe-deposit-alert email is possible on any retry (client-side double-submit, Next.js route
re-invocation, Stripe's own webhook retry policy). Not a data-integrity risk — `reserve_email_send`
still rate-limits — but a real double-send-to-customer risk, which is exactly what an idempotency
key at the provider level is for.

**Recommendation**: make `idempotencyKey` required in `src/lib/server/email.js`'s
`sendViaResend()`, mirroring the Deno contract (fail closed with a clear reason rather than
silently sending without one), and add a key to the 4 call sites above — a natural key already
exists at each site (booking id + action type, Stripe session id).

**Priority**: High. **Effort**: Small (one signature change + 4 one-line additions; the pattern to
copy already exists in the other 3 call sites and in the Deno version).

### 2. Dead, broken duplicate test file: `supabase/tests/email-test 2.ts`

**Finding**: `supabase/tests/email-test 2.ts` (note the literal space in the filename) imports
`sendResendEmail` from `../functions/_shared/email.ts` — a function that doesn't exist there; the
module exports `sendViaResend`. First flagged during Phase 0's repo-hygiene pass; elaborated here
since it's squarely a refactoring/dead-code item.

**Evidence**: `supabase/tests/email-test 2.ts:1` (`import { sendResendEmail } from ...`) vs.
`supabase/functions/_shared/email.ts`'s actual export (`sendViaResend`). The file's name doesn't
match `test:edge`'s glob (`supabase/tests/*-test.ts` requires the name to end exactly in
`-test.ts`; `email-test 2.ts` ends in ` 2.ts`), so CI never runs it and never catches that it's
broken — it would fail `deno check` immediately if it ever were included.

**Impact**: pure discoverability/confusion cost — a future contributor grepping for "email test"
finds two files, one of them silently broken and testing an API that no longer exists.

**Recommendation**: delete `supabase/tests/email-test 2.ts`. `email-test.ts` already covers the
current `sendViaResend()` contract (including the idempotency-required behavior — see Finding 1).

**Priority**: Low. **Effort**: Small (delete one file).

### 3. Inconsistent naming for the same "thin Server-Action wrapper" pattern

**Finding**: `growth.js` (wraps `growth-experiments.js`) and `sales-response-actions.js` (wraps
`sales-response.js`) implement the identical pattern — noted in Phase 1 §5 — but only one of them
signals that in its name.

**Evidence**: `src/lib/server/office/growth.js` vs. `src/lib/server/office/sales-response-actions.js`
+ `sales-response.js`. A reader scanning the directory listing would correctly guess
`sales-response-actions.js` is a wrapper from its name alone, but would have no such signal for
`growth.js` without opening it.

**Impact**: minor discoverability friction in a 19-file directory — low cost today, but the kind of
inconsistency that compounds if the pattern gets reused a third time with a third naming scheme.

**Recommendation**: rename `growth.js` → `growth-actions.js` (or rename
`sales-response-actions.js` → `sales-response.js`'s wrapper to drop the `-actions` suffix,
whichever direction the team prefers) so the two instances of the same pattern share one
convention. Update the single import site (`src/app/office/actions.js`) accordingly.

**Priority**: Low. **Effort**: Small (rename + one import update).

## What did *not* turn up a finding

- **No duplicated business rules**: `src/lib/pricing.js` (client-safe display copy) and
  `src/lib/server/pricing.js` (server-side `calculateHostedPrice()`/`fixedDepositPrice()`) have
  distinct, non-overlapping responsibilities, confirmed by reading both — not the same duplication
  the Aug 15 review would have flagged if it existed.
- **No magic-value problem**: spot-checked repeated string literals (`message_type` values like
  `"booking"`, `"internal_notification"`) across `office/*` and `email.js` — these are database
  enum values written at a handful of call sites each, not scattered configuration thresholds; no
  evidence of drift-prone duplication.
- **No raw `AbortSignal.timeout(N)` regressions**: the Aug 15 `HTTP_TIMEOUT_MS` constant fix holds
  — zero raw timeout literals found anywhere in `src/`.
- **No dead exports**: every `office/*` export is reachable from `actions.js`; every Deno
  `_shared/*` export is used by at least one Edge Function.
- **File sizes are unremarkable**: largest is `office/proposals.js` at 256 lines (money + email
  side effects, previously identified as the module most worth testing — Phase 3's job, not a
  refactor-size problem here).

---

**Priority order for this phase's findings**: #1 (idempotency contract) first — it's the one with
real user-facing consequence. #2 and #3 are cheap cleanup, worth batching into the same small PR.
