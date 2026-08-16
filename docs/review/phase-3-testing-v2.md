# Phase 3 — Testability & Test Coverage (Pass 2)

Covers prompt §6 (Testability) and §7 (Test Coverage). Builds on
[phase-0-architecture-map-v2.md](phase-0-architecture-map-v2.md).

## 1. Current test inventory (recounted, not assumed)

- **34 Vitest files** under `src/`: 12 API-route tests, 8 `office/*` tests, 14 other
  `src/lib/**` tests.
- **5 Deno test files** under `supabase/tests/*-test.ts`: `runtime-test.ts`, `email-test.ts`,
  `nurture-test.ts`, `outreach-test.ts`, `booking-reminders-test.ts` — all test `_shared/*` helper
  modules, not any Edge Function's `index.ts` directly.
- **1 pgTAP SQL test** (`game_rpc_hardening.sql`), CI-wired via the `database-regression` job.
- `vitest.config.mjs` coverage scope (`include: ["src/lib/**/*.js", "src/app/api/**/*.js"]`)
  correctly covers the current code layout, including all 19 `office/*` modules via the
  `src/lib/**` glob — no stale-path issue.

## 2. Office module coverage — corrected from a naive file-name check

A same-named-file check (`capacity.js` → does `capacity.test.js` exist?) undercounts real
coverage here. **`src/lib/server/office/coverage-actions.test.js`** is a single 96-line file that,
via `await import("./capacity")` etc., exercises 12 of the modules that have no dedicated test
file: `growth`, `capacity`, `relationship-signals`, `incidents`, `sla`, `intelligence`,
`configuration`, `deliverability`, `outreach`, `sales-response-actions`, `certification`,
`organic` — plus `office-errors.js`'s message mapping. Combined with the 7 modules that do have
dedicated files (`authentication`, `distribution`, `growth-experiments`, `launch`, `proposals`,
`sales-response`, `shared`), **all 19 `office/*` modules have at least some test coverage** — zero
are completely untested.

That said, the *kind* of coverage differs a lot by module, which matters more than the binary
covered/uncovered split the plan doc anticipated:

| Coverage depth | Modules | What's actually tested |
|---|---|---|
| **Deep** (dedicated file, multiple scenarios incl. success paths) | `authentication` (6 cases), `sales-response` (9 cases), `proposals` (5 cases) | Auth issuance, draft creation, approval+send, provider failure handling |
| **Moderate** (dedicated file, few cases) | `distribution` (3), `launch` (2), `growth-experiments`, `shared` | Core happy-path + one or two error branches |
| **Shallow** (grab-bag file, validation-only) | `growth`, `capacity`, `relationship-signals`, `incidents`, `sla`, `intelligence`, `configuration`, `deliverability`, `outreach`, `sales-response-actions`, `certification`, `organic` | Every `coverage-actions.test.js` case (read directly, not inferred) asserts that **invalid/empty form input redirects with the expected error code** — none of them assert what happens on a *successful* write (e.g., a valid capacity hold actually being created, a certification actually being signed off, the resulting DB payload shape) |

The "shallow" column is real coverage — it locks in the validation contract, which has genuine
value (a regression that stops rejecting bad input would be caught) — but it's not
behavior-complete, and 12 of 19 modules currently have *only* this level.

## 3. A test actively asserts the wrong contract — direct link to Phase 2 Finding 1

`src/lib/server/email.test.js:52` explicitly tests:
```
headers: expect.not.objectContaining({ "Idempotency-Key": expect.anything() }),
```
i.e., the suite locks in "no `idempotencyKey` supplied → no header sent" as *correct* behavior.
This is the same optional-vs-required contract gap Phase 2 Finding 1 flagged between JS and Deno
`sendViaResend()`. It means fixing that finding isn't just a code change — this specific test will
need to be rewritten (not just supplemented), since as written it would fail against the
Deno-equivalent fail-closed behavior. Flagging here so the two aren't fixed independently and left
inconsistent again.

## 4. High-risk areas — coverage confirmed strong

- **Booking lifecycle** (`availability`, `availability-access`, `cancel`, `confirm`, `reschedule`,
  `config`): all 6 routes have `route.test.js`.
- **Stripe webhook signature verification**: `stripe/webhook/route.test.js:91-97` explicitly tests
  that an invalid signature is rejected (mocked `constructEvent` throwing → "Invalid signature").
- **Resend webhook signature verification**: `resend/webhook/route.test.js:12-20` tests the same
  for svix's `verify()`.
- **Office auth allow-list** (`office-auth.test.js`): covers the multi-admin
  `officeAllowedEmails()`/`isOfficeAllowedEmail()` logic added since Aug 15, including the
  case-insensitivity and empty-env-var edge cases.

No regressions or gaps found in what was already the strongest-covered surface at the Aug 15
review.

## 5. Confirmed gap, unchanged since Aug 15: no Edge Function integration tests

All 5 Deno test files test extracted `_shared/*` helpers in isolation. **Zero test files reference
any Edge Function's `index.ts` directly** — confirmed by grepping `supabase/tests/*.ts` for any of
the 14 function names or `index.ts`. This means the actual orchestration in, e.g.,
`send-nurture-emails/index.ts` (query leads → check paid conversion → pick next step → call
`sendViaResend` → update `notification_deliveries`/`messages`) has no test exercising it end-to-end
with a mocked Supabase client — only its individual pieces (`nextNurtureStep()`,
`buildNurtureEmail()`, `sendViaResend()`) are verified separately. A bug in how those pieces are
wired together in `index.ts` itself wouldn't be caught by the current suite.

## 6. Prioritized list of highest-value tests to add

Ranked by (business/technical risk) × (current coverage gap), not by file count:

1. **Fix + extend `email.test.js` for the idempotency contract** (once Phase 2 Finding 1 lands) —
   Unit test. Must change before/alongside the code fix, not after — see §3.
2. **`office/proposals.js` success-path coverage** — Unit test. It's the largest office module
   (256 lines), generates real Stripe-adjacent payment links and sends real email, and its 5
   existing test cases don't cover every branch of a 256-line file. Highest money-risk module with
   the thinnest tests relative to its size.
3. **One Edge Function integration test end-to-end** (recommend `send-nurture-emails`, since it has
   the most branching: age-gating, paid-conversion short-circuit, step-sequencing, reservation
   blocking) — Integration test with a mocked Supabase client, verifying the full
   query→decide→send→record flow, not just its extracted pieces. Establishes the pattern; the other
   13 functions can follow it incrementally as they're touched.
4. **Success-path cases for the 12 `coverage-actions.test.js`-only modules**, prioritized by risk:
   `certification` (signs off B2B certification — a compliance-adjacent action) and `configuration`
   (`updateSystemConfig` — controls `master_enabled`/outbound pause flags, i.e. can turn sending on
   or off system-wide) first; the remaining 10 (capacity, relationship-signals, incidents, sla,
   intelligence, deliverability, outreach, sales-response-actions, organic, growth) can follow as
   lower-urgency backlog — their validation-only coverage is a real gap but not a money/compliance
   one.

Not recommended: adding DI/interfaces to unlock testing anywhere in `office/*` — the existing
`vi.mock()`-based approach (mocking `@/lib/server/supabase-admin`, `next/navigation`, `./shared`)
already gets full behavioral coverage without needing new seams, as the "deep" and "moderate"
tier modules demonstrate.
