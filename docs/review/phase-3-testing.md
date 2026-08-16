# Phase 3 — Testability & Test Coverage

Part of the [Code Review Plan](../CODE_REVIEW_PLAN.md), covering CODE_REVIEW_PROMPT.md §6
(Testability) and §7 (Test Coverage). Builds on [Phase 0](phase-0-architecture-map.md)'s test
inventory. No code was modified.

## What's working well (read this before the gaps below)

The existing suite is genuinely good, not just present. `src/app/api/stripe/webhook/route.test.js`
is representative: it invokes the real `POST` handler with a real `Request` object and only mocks
at the actual infrastructure boundary (`getSupabaseAdmin`, the `stripe` SDK's `constructEvent`,
`fetch`, PostHog capture) via a purpose-built `createSupabaseAdminMock()`
(`src/test/supabase-admin-mock.js`) that fakes the Supabase query-builder chain rather than
stubbing out application code. Assertions target behavior — response status/body and which RPC was
called with what arguments — not internal implementation. It covers real business scenarios that
matter: duplicate-event replay (`:160-191`), a payment-amount mismatch held for manual review
instead of silently accepted (`:193-229`), and every alert channel failing returning `503` so
Stripe retries (`:231-260`). This is the right shape of test for this codebase, and the mocking
boundary is exactly where the prompt's §6 guidance says a seam is worth having (at the real
external dependency, not sprinkled through application logic). Whoever wrote these should be the
template for filling the gaps below, not a pattern that needs correcting.

## Coverage map by domain and risk

| Domain | Tested | Untested | Risk if it breaks |
|---|---|---|---|
| Booking mutation routes (cancel/confirm/reschedule/availability/availability-access) | Yes — `route.test.js` per route | — | Covered |
| Booking domain logic (`booking-manage.js`, `booking-cleanup.js`) | Yes | — | Covered |
| Stripe checkout + webhook | Yes | — | Covered |
| Lead/funnel ingestion (`leads`, `funnel-events` routes) | Yes | — | Covered |
| Client-safe pricing copy (`lib/pricing.js`) | Yes | — | Covered |
| **Authoritative price calculation** (`lib/server/pricing.js`) | No | `calculateHostedPrice()`, `fixedDepositPrice()` | **High** — this is the function that determines the dollar amount charged; the existing `pricing.test.js` only covers the client-facing copy string, not the calculation itself |
| **Office authorization gate** (`lib/server/office-auth.js`) | No | `getOfficeUser()`, `requireOfficeUser()` | **High** — this is the single security boundary for the entire internal dashboard (see [Phase 1 Finding 1](phase-1-architecture-layers.md)); small, cheap to test, currently unverified |
| **Timezone/wall-clock conversion** (`lib/server/booking-time.js`) | No | all exports | **High** — ARCHITECTURE.md names this the one canonical source for calendar-day and wall-clock logic repo-wide; a bug here corrupts booking times or day-boundary math everywhere it's used, and nothing currently proves it's correct |
| Resend delivery webhook (`api/resend/webhook/route.js`) | No | signature verification, idempotency-by-unique-constraint, suppression-list write on bounce/complaint | **Medium-High** — the Stripe webhook test suite already proves this team knows how to test exactly this kind of idempotent-webhook logic; this route has none |
| Bot/abuse protection (`turnstile.js`, `rate-limit.js`) | No | verification call, rate-limit window/threshold logic | **Medium** — shared by nearly every public POST route; a silent regression disables protection sitewide rather than in one place |
| Lead-scoring (`organic-intent.js`) | No | `scoreOrganicIntent`, `organicFingerprint`, `createHelpfulDraft` | **Medium** — small surface (38 lines, 3 functions), feeds sales prioritization |
| `office/actions.js` (814 lines, ~15 domains) | No | everything | **Medium** — see [Phase 1 Finding 6](phase-1-architecture-layers.md); high risk in principle, but it's an internal single-operator tool, which caps the blast radius of a bug relative to customer-facing code |
| Supabase Edge Functions (14 functions, Apollo/outreach/email automation) | No | everything | **Medium** — external-facing outbound communications (`send-approved-outreach`, `send-nurture-emails`) and paid-API usage (`process-apollo-enrichment`) run unattended on a schedule with nothing catching a regression before it emails a real prospect or burns Apollo credits |
| Game RPC authorization (Aug 9-15 migrations: `harden_high_risk_game_rpcs`, `harden_submit_answer_grading`, `revoke_anon_host_scoring_resolvers`) | No | the security-definer authorization checks themselves | **Medium** — these are the most recently changed authorization logic in the repo (see [Phase 0 §5](phase-0-architecture-map.md#5-correction-to-the-plans-real-time-framing)); `supabase/tests/` has exactly one file, for an unrelated deal-pipeline flow, so there's no regression test proving an unauthorized caller is actually rejected |
| React client components (`GameQuiz.js`, `BookingScheduler.js`, etc.) | No | all interaction logic | **Low-Medium** — `@testing-library/react`, `jest-dom`, and `user-event` are installed as devDependencies but zero `.test.jsx` files exist anywhere in the repo; either the tooling is aspirational and unused, or component tests were planned and never written |

No coverage-measurement tool (`@vitest/coverage-v8` or similar) is installed, so none of the above
is derived from a report — it's a direct diff between source files and their colocated
`*.test.js`. Phase 5 will address adding coverage reporting as tooling; this phase is about what to
point it at first.

## Testability observations (§6)

- **Hidden/global dependencies**: minimal. The one instance of module-level mutable state
  (`rate-limit.js`'s in-memory `Map`) is small, explicitly commented as an accepted tradeoff, and
  doesn't block testing — see [Phase 2](phase-2-refactoring-maintainability.md#explicitly-not-findings-preserve-as-is).
  No other static/global state was found in the server-side logic surveyed.
- **The Supabase-client seam is the right level of abstraction for testing**, and it's already
  built (`createSupabaseAdminMock`). The gaps above aren't testability problems — the same seam
  used for booking and Stripe tests works identically for `office-auth.js`, `pricing.js`, and the
  Resend webhook. This is a coverage gap, not an architecture gap; no new seams need to be
  introduced to close it. Recommend against adding dependency injection or interfaces anywhere as
  part of closing these gaps — the existing mock-the-client pattern already provides it.
- **Time and randomness**: `booking-time.js` does timezone/wall-clock math from real `Date`
  objects; none of the existing tests demonstrate a pattern for controlling time (e.g. `vi.setSystemTime`),
  so whoever writes its first test will need to establish that convention. Worth doing once, well,
  since booking logic elsewhere will likely need the same technique.
- **Edge Functions are harder to test in-repo** than the Next.js side: they're Deno modules with no
  equivalent to `vitest`/`supabase-admin-mock.js` set up for that runtime. Establishing even one
  Edge Function test will require picking a Deno test approach first — this is a small setup cost,
  not a large one (Deno's built-in test runner plus a hand-rolled fetch/service-client mock, mirroring
  the pattern already proven on the JS side, is enough).

## Prioritized list: highest-value tests to add first

1. **`lib/server/pricing.js` — `calculateHostedPrice()`** (unit). Cover: core vs. premium per-person
   rates, the `HOSTED_PRICING.minimum` floor kicking in for small groups, each add-on, invalid
   player count/package throwing. Highest priority — direct financial-correctness risk, pure
   function, no mocking needed at all.
2. **`lib/server/office-auth.js` — `requireOfficeUser()`** (unit, mock `createSupabaseServerClient`
   the same way route tests mock `getSupabaseAdmin`). Cover: no user → redirect, wrong email →
   redirect, matching email (case-insensitivity per `:12`) → returns user. Security-critical,
   cheap.
3. **`lib/server/booking-time.js`** (unit). Cover the wall-clock/day-boundary conversions
   ARCHITECTURE.md calls the canonical source for; establish the time-mocking convention here since
   nothing else in the suite needs it yet.
4. **`api/resend/webhook/route.js`** (API/integration, same shape as the Stripe webhook test).
   Cover: invalid signature → 400, duplicate `svix_id` (unique-constraint conflict) → short-circuit,
   hard bounce/complaint → suppression-list upsert + `check_outbound_deliverability` RPC called,
   soft bounce → no suppression.
5. **`lib/server/turnstile.js` + `lib/server/rate-limit.js`** (unit). Turnstile: verification
   success/failure/timeout handling. Rate-limit: window expiry and the `max` threshold boundary.
6. **One SQL test for the Aug 15 game-RPC hardening migrations** (DB/integration, pgTAP-style like
   `supabase/tests/milestone1_deal_pipeline.sql`), proving an unauthorized caller is rejected by at
   least `clear_buzzers` and the submit-answer/grading RPCs — these are the newest and most
   security-sensitive functions in the schema and currently have zero regression protection.
7. **`lib/server/organic-intent.js`** (unit, pure functions, no mocking needed).
8. **One Edge Function** — start with `send-approved-outreach` or `process-apollo-enrichment`
   (external-facing/paid-API risk) to establish the Deno testing pattern, then extend to the rest
   opportunistically.

Deliberately not in the top tier: `office/actions.js` (real risk, but contained by its
single-operator, internal-only blast radius — better addressed by the Finding 6 decomposition in
Phase 1 first, since splitting it into `lib/server/office/*` modules will make it testable the same
way booking logic already is, rather than writing tests against the current 814-line shape) and
component/UI tests (worth doing, but every server-side item above protects money, security, or
deliverability directly, which component interaction tests don't).

## Summary for Phase 6

- Existing tests are high quality and should be held up as the model, not flagged as a problem.
- The three **High**-risk gaps (pricing calculation, office auth, timezone conversion) are all
  small, cheap, pure-function-or-near-pure-function tests with no new infrastructure required —
  disproportionately high value for the effort.
- No coverage tool is installed; Phase 5 should recommend one, but this phase's risk-based list
  should drive what gets covered first regardless of what a coverage percentage would say.
- `@testing-library/react` is installed and entirely unused — either write the first component test
  or remove the dependency; leaving it half-adopted is its own small maintainability smell.
