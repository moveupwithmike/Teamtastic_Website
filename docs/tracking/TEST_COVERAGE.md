# Test Coverage Report

Generated 2026-08-16 from `npm run test:coverage` (Vitest + `@vitest/coverage-v8`). Source: `coverage/coverage-summary.json` / `coverage/index.html`, regenerate with:

```bash
npm run test:coverage
```

This report covers only the files in scope per `vitest.config.mjs` — `src/lib/**/*.js` and `src/app/api/**/*.js` (server-side logic: routes, `lib/server`, office actions). UI components are excluded; see [Scope note](#scope-note) below. It complements, and does not replace, the risk-based gap list in [`docs/review/phase-3-testing.md`](docs/review/phase-3-testing.md) — that document says what's worth testing and why; this one says what the suite currently measures.

## Overall

165 tests passing across 25 test files.

| Metric | Coverage |
|---|---|
| Statements | **46.43%** (789/1699) |
| Branches | **40.28%** (680/1688) |
| Functions | **48.34%** (102/211) |
| Lines | **50.89%** (710/1395) |

No threshold is enforced (`npm run check` does not gate on this report) — see the comment in `vitest.config.mjs`.

## Zero coverage (28 files)

Files in scope with no executing test at all.

| File | Statements | Branches | Functions | Lines |
|---|---|---|---|---|
| `src/lib/server/office/certification.js` | 0.0% (0/96) | 0.0% (0/88) | 0.0% (0/22) | 0.0% (0/43) |
| `src/lib/server/office/organic.js` | 0.0% (0/64) | 0.0% (0/49) | 0.0% (0/7) | 0.0% (0/56) |
| `src/lib/server/office/growth.js` | 0.0% (0/62) | 0.0% (0/66) | 0.0% (0/7) | 0.0% (0/45) |
| `src/lib/server/office/capacity.js` | 0.0% (0/52) | 0.0% (0/50) | 0.0% (0/5) | 0.0% (0/40) |
| `src/lib/server/office/relationship-signals.js` | 0.0% (0/40) | 0.0% (0/51) | 0.0% (0/3) | 0.0% (0/19) |
| `src/lib/server/google-calendar.js` | 0.0% (0/36) | 0.0% (0/26) | 0.0% (0/6) | 0.0% (0/27) |
| `src/lib/analytics.js` | 0.0% (0/35) | 0.0% (0/27) | 0.0% (0/5) | 0.0% (0/28) |
| `src/app/api/resend/webhook/route.js` | 0.0% (0/30) | 0.0% (0/30) | 0.0% (0/1) | 0.0% (0/29) |
| `src/app/api/stripe/proposal-checkout/route.js` | 0.0% (0/27) | 0.0% (0/30) | 0.0% (0/1) | 0.0% (0/24) |
| `src/lib/server/office/incidents.js` | 0.0% (0/27) | 0.0% (0/30) | 0.0% (0/2) | 0.0% (0/24) |
| `src/lib/server/zoom.js` | 0.0% (0/26) | 0.0% (0/19) | 0.0% (0/4) | 0.0% (0/20) |
| `src/lib/server/office/configuration.js` | 0.0% (0/21) | 0.0% (0/36) | 0.0% (0/1) | 0.0% (0/19) |
| `src/lib/server/organic-intent.js` | 0.0% (0/18) | 0.0% (0/10) | 0.0% (0/3) | 0.0% (0/16) |
| `src/lib/server/office/sla.js` | 0.0% (0/18) | 0.0% (0/13) | 0.0% (0/2) | 0.0% (0/17) |
| `src/lib/server/office/deliverability.js` | 0.0% (0/16) | 0.0% (0/10) | 0.0% (0/2) | 0.0% (0/13) |
| `src/lib/lead-client.js` | 0.0% (0/15) | 0.0% (0/14) | 0.0% (0/4) | 0.0% (0/13) |
| `src/lib/server/posthog.js` | 0.0% (0/15) | 0.0% (0/11) | 0.0% (0/2) | 0.0% (0/12) |
| `src/lib/server/office/outreach.js` | 0.0% (0/14) | 0.0% (0/17) | 0.0% (0/1) | 0.0% (0/12) |
| `src/lib/server/office/sales-response-actions.js` | 0.0% (0/14) | 0.0% (0/4) | 0.0% (0/2) | 0.0% (0/12) |
| `src/lib/server/office/intelligence.js` | 0.0% (0/13) | 0.0% (0/8) | 0.0% (0/2) | 0.0% (0/13) |
| `src/lib/consent.js` | 0.0% (0/12) | 0.0% (0/8) | 0.0% (0/3) | 0.0% (0/11) |
| `src/app/api/bookings/config/route.js` | 0.0% (0/10) | 0.0% (0/20) | 0.0% (0/1) | 0.0% (0/9) |
| `src/lib/supabase/server.js` | 0.0% (0/10) | 0.0% (0/6) | 0.0% (0/4) | 0.0% (0/8) |
| `src/lib/holiday-campaign.js` | 0.0% (0/8) | 0.0% (0/5) | 0.0% (0/2) | 0.0% (0/8) |
| `src/lib/server/supabase-admin.js` | 0.0% (0/5) | 0.0% (0/4) | 0.0% (0/1) | 0.0% (0/4) |
| `src/lib/server/office-errors.js` | 0.0% (0/2) | 0.0% (0/4) | 0.0% (0/1) | 0.0% (0/2) |
| `src/lib/corporate-faqs.js` | 0.0% (0/1) | 100.0% (0/0) | 100.0% (0/0) | 0.0% (0/1) |
| `src/lib/stripe.js` | 0.0% (0/1) | 0.0% (0/10) | 100.0% (0/0) | 0.0% (0/1) |

## Low coverage — under 50% statements (2 files)

| File | Statements | Branches | Functions | Lines |
|---|---|---|---|---|
| `src/lib/server/turnstile.js` | 27.3% (3/11) | 50.0% (3/6) | 100.0% (1/1) | 22.2% (2/9) |
| `src/lib/server/office/proposals.js` | 27.8% (30/108) | 19.0% (23/121) | 25.0% (1/4) | 30.9% (30/97) |

## Partial coverage — 50-89% statements (12 files)

| File | Statements | Branches | Functions | Lines |
|---|---|---|---|---|
| `src/lib/server/office/distribution.js` | 58.8% (20/34) | 36.7% (11/30) | 100.0% (2/2) | 71.4% (10/14) |
| `src/lib/server/office/growth-experiments.js` | 59.1% (13/22) | 66.7% (16/24) | 50.0% (2/4) | 57.1% (12/21) |
| `src/lib/products.js` | 60.0% (12/20) | 54.2% (13/24) | 100.0% (2/2) | 84.6% (11/13) |
| `src/lib/server/office/shared.js` | 60.0% (3/5) | 63.6% (7/11) | 66.7% (2/3) | 60.0% (3/5) |
| `src/lib/server/office/authentication.js` | 69.4% (25/36) | 56.7% (17/30) | 50.0% (1/2) | 75.0% (24/32) |
| `src/app/api/stripe/checkout/route.js` | 71.4% (45/63) | 51.8% (29/56) | 75.0% (3/4) | 79.2% (42/53) |
| `src/app/api/stripe/webhook/route.js` | 80.5% (66/82) | 68.9% (93/135) | 100.0% (3/3) | 81.8% (63/77) |
| `src/app/api/bookings/reschedule/route.js` | 82.3% (79/96) | 57.5% (46/80) | 81.8% (9/11) | 84.9% (73/86) |
| `src/app/api/leads/route.js` | 83.0% (39/47) | 84.1% (69/82) | 100.0% (4/4) | 88.6% (39/44) |
| `src/app/api/bookings/availability-access/route.js` | 84.6% (11/13) | 75.0% (6/8) | 50.0% (1/2) | 91.7% (11/12) |
| `src/app/api/bookings/cancel/route.js` | 85.4% (41/48) | 67.6% (25/37) | 83.3% (5/6) | 85.0% (34/40) |
| `src/lib/server/office/sales-response.js` | 88.7% (55/62) | 74.6% (50/67) | 100.0% (3/3) | 92.8% (52/56) |

## High coverage — 90%+ statements (18 files)

| File | Statements | Branches | Functions | Lines |
|---|---|---|---|---|
| `src/app/api/bookings/confirm/route.js` | 90.1% (82/91) | 65.4% (53/81) | 81.8% (9/11) | 92.9% (79/85) |
| `src/app/api/funnel-events/route.js` | 91.7% (22/24) | 82.3% (28/34) | 100.0% (5/5) | 100.0% (14/14) |
| `src/lib/server/availability-access.js` | 92.8% (13/14) | 88.9% (16/18) | 100.0% (3/3) | 100.0% (12/12) |
| `src/app/api/bookings/availability/route.js` | 93.7% (59/63) | 72.7% (40/55) | 100.0% (5/5) | 100.0% (46/46) |
| `src/lib/server/email.js` | 95.2% (20/21) | 88.5% (23/26) | 50.0% (1/2) | 100.0% (18/18) |
| `src/lib/server/booking-time.js` | 100.0% (35/35) | 75.0% (3/4) | 100.0% (13/13) | 100.0% (29/29) |
| `src/lib/server/pricing.js` | 100.0% (24/24) | 100.0% (15/15) | 100.0% (8/8) | 100.0% (24/24) |
| `src/lib/recommendations.js` | 100.0% (18/18) | 100.0% (28/28) | 100.0% (3/3) | 100.0% (18/18) |
| `src/lib/server/booking-manage.js` | 100.0% (18/18) | 100.0% (16/16) | 100.0% (1/1) | 100.0% (13/13) |
| `src/lib/server/office-auth.js` | 100.0% (16/16) | 100.0% (15/15) | 100.0% (6/6) | 100.0% (13/13) |
| `src/lib/server/office/launch.js` | 100.0% (16/16) | 71.4% (10/14) | 100.0% (1/1) | 100.0% (15/15) |
| `src/lib/server/rate-limit.js` | 100.0% (9/9) | 100.0% (5/5) | 100.0% (3/3) | 100.0% (8/8) |
| `src/lib/server/booking-cleanup.js` | 100.0% (8/8) | 100.0% (11/11) | 100.0% (2/2) | 100.0% (8/8) |
| `src/lib/game-handoff.js` | 100.0% (3/3) | 100.0% (6/6) | 100.0% (1/1) | 100.0% (3/3) |
| `src/lib/pricing.js` | 100.0% (2/2) | 100.0% (0/0) | 100.0% (1/1) | 100.0% (2/2) |
| `src/lib/server/http.js` | 100.0% (1/1) | 100.0% (0/0) | 100.0% (0/0) | 100.0% (1/1) |
| `src/lib/server/validation.js` | 100.0% (1/1) | 100.0% (3/3) | 100.0% (1/1) | 100.0% (1/1) |
| `src/lib/gamesData.json` | 100.0% (0/0) | 100.0% (0/0) | 100.0% (0/0) | 100.0% (0/0) |

## Reading this against the risk list

Cross-referencing against [`phase-3-testing.md`](docs/review/phase-3-testing.md)'s prioritized list:

- **Closed since that report was written**: `lib/server/pricing.js` (100%), `lib/server/office-auth.js` (100%), `lib/server/booking-time.js` (100% statements), `lib/server/turnstile.js` (27.3% — test exists but thin), `lib/server/office/authentication.js` (69.4%) all now have tests where the phase-3 doc found none.
- **Still open, and still high-risk by that doc's framing**:
  - `src/lib/server/office-errors.js` — 0%, feeds error handling across the office surface
  - `src/lib/server/organic-intent.js` — 0%, item 7 on the prioritized list, still untouched
  - `src/lib/server/rate-limit.js` shows 100% here but `turnstile.js` sits at 27.3% — the Turnstile half of item 5 is still mostly open
  - `src/app/api/resend/webhook/route.js` — 0%, item 4 on the prioritized list (idempotent-webhook logic, same shape as the well-tested Stripe webhook) — not yet started
  - `src/app/api/stripe/proposal-checkout/route.js` and `src/app/api/bookings/config/route.js` — 0%, not called out in phase-3 (routes may postdate that review) but same route-testing pattern applies directly
  - The `office/*` domain modules split out since phase-3 was written (`capacity.js`, `certification.js`, `configuration.js`, `deliverability.js`, `growth.js`, `incidents.js`, `intelligence.js`, `organic.js`, `outreach.js`, `sales-response-actions.js`, `sla.js`) are uniformly at 0% — these are the pieces `office/actions.js` was decomposed into (Phase 1 Finding 6), and the decomposition made them independently testable, but tests haven't been written yet
  - `src/lib/server/office/proposals.js` (27.8%) and `src/lib/server/office/distribution.js` (58.8%) have partial coverage but meaningful gaps remain

## Scope note

Coverage is intentionally not measured for:
- Edge Functions (`supabase/functions/`) — covered by a separate Deno test runner (`npm run test:edge`) with no coverage reporting wired up
- React UI components (`.js` files containing JSX outside `lib/`/`api/`) — the V8 coverage remapper can't parse JSX without a `.jsx` extension; `@testing-library/react` is installed but zero component tests exist (noted as an open item in phase-3-testing.md)
