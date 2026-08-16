# Phase 0 — System Discovery & Architecture Map (Pass 2)

Ground-truth inventory only — no verdicts. Re-derived from the current repo state, not diffed
against the Aug 15 version. See [phase-0-architecture-map.md](phase-0-architecture-map.md) for the
original if you want to compare.

## 1. What this system is

A Next.js 16 (App Router) marketing site for Teamtastic — live-hosted virtual team-building games —
plus an internal sales/growth operations tool ("Office") and a Supabase-backed lead-gen/outreach
automation pipeline. It is **not** a real-time multiplayer backend; the "real-time" framing in
`CODE_REVIEW_PROMPT.md` gets reinterpreted in Phase 4 as: webhook idempotency, async Edge Function
pipeline reliability, and client-side game/session state, per the plan's scope note.

## 2. Major components

| Component | Location | Role |
|---|---|---|
| Public marketing site | `src/app/{page.js, blog, games, pricing, use-cases, virtual-*, why-teamtastic, resources, team-experiences, activities}` | Static/SSG-heavy content, ~40 page routes |
| Booking flow | `src/app/book/**`, `src/app/api/bookings/*` | Public booking widget + 6 API routes (availability, availability-access, confirm, cancel, reschedule, config) |
| Payments | `src/app/api/stripe/{checkout,proposal-checkout,webhook}` | Stripe Checkout session creation + webhook handling |
| Lead capture | `src/app/api/{leads,funnel-events}` | Public lead intake, funnel analytics events |
| Inbound email | `src/app/api/resend/webhook` | Resend delivery-event webhook |
| Office (internal tool) | `src/app/office/**` + `src/lib/server/office/**` | Auth-gated sales/growth command center, 22 private dashboard pages |
| Auth | `src/lib/server/office-auth.js`, `src/app/auth/callback/route.js`, `src/proxy.js` | Supabase magic-link auth, scoped to `/office/*` only |
| Server-side shared libs | `src/lib/server/*.js` (17 files, excluding `office/`) | Cross-cutting: email, rate-limit, pricing, validation, Zoom/Google Calendar, Turnstile, Supabase admin client |
| Client-side shared libs | `src/lib/*.js` (top-level, 12 files) | Pricing copy, recommendations, analytics, consent, Stripe client, game handoff |
| UI components | `src/components/*.js` (24 files) | Shared React components (booking, quiz, checkout, nav, forms) |
| Supabase Edge Functions | `supabase/functions/*` (14 functions + `_shared/`) | Async outreach/lead-gen automation, cron-triggered |
| Database | `supabase/migrations/*` (79 files) | Postgres schema, RPCs, RLS policies |
| Tests | `src/**/*.test.js` (34 files) + `supabase/tests/*-test.ts` (5 files) + 1 pgTAP SQL test | Vitest (JS) + Deno test (Edge Functions) + pgTAP (DB) |

## 3. Entry points

**Page routes** (~65 total): public marketing pages, `/book`, `/book/manage/[token]`, `/office/login`,
22 pages under `/office/(private)/*` (auth-gated by the route group's `layout.js`).

**API routes** (12, all under `src/app/api/`): `bookings/{availability,availability-access,cancel,
config,confirm,reschedule}`, `funnel-events`, `leads`, `resend/webhook`, `stripe/{checkout,
proposal-checkout,webhook}`.

**Server Actions** (41 exported from `src/app/office/actions.js`, a pure re-export shim — see §5):
the entire Office UI's write path. No Server Actions exist outside the office domain.

**Supabase Edge Functions** (14, listed in §6).

**Middleware**: `src/proxy.js`, matcher `["/office/:path*"]` — refreshes the Supabase session
cookie only; does **not** authorize (that's `requireOfficeUser()` in
`src/app/office/(private)/layout.js:8`, called on every private page render).

## 4. External dependencies

| Dependency | Used for | Where |
|---|---|---|
| Supabase (Postgres + Auth + Edge Functions) | Primary datastore, auth, async automation | Everywhere; `@supabase/supabase-js`, `@supabase/ssr` |
| Stripe | Deposit/checkout payments | `src/lib/stripe.js`, `api/stripe/*`, `office/proposals.js` |
| Resend | Transactional + outreach email | `src/lib/server/email.js` (JS), `supabase/functions/_shared/email.ts` (Deno) |
| Apollo | B2B contact enrichment/outreach | `discover-apollo-candidates`, `process-apollo-enrichment`, `test-apollo-connection` Edge Functions |
| Cloudflare Turnstile | Bot protection on public forms | `src/lib/server/turnstile.js` |
| Zoom / Google Calendar | Booking meeting creation | `src/lib/server/{zoom,google-calendar}.js` |
| PostHog | Product analytics | `src/lib/server/posthog.js`, `src/components/PostHogProvider.js` |
| Deno (Supabase Edge runtime) | Execution environment for `supabase/functions/*` | separate TypeScript/runtime from the Next.js app |

## 5. Where business logic actually lives

- **Public-site logic** (pricing copy, game recommendations, quiz scoring): `src/lib/*.js`
  (client-safe, no `"server-only"` boundary needed since it's presentation logic).
- **Server-only cross-cutting logic**: `src/lib/server/*.js` — email sending (`email.js`,
  centralizing the reserve→send→record Resend pattern), rate limiting, pricing calculation, HTTP
  timeout constants, Supabase admin client construction, office auth/allow-list.
- **Office domain logic**: `src/lib/server/office/` — **19 files**, not 17 as the plan doc
  estimated. 18 are domain modules (authentication, capacity, certification, configuration,
  deliverability, distribution, growth, growth-experiments, incidents, intelligence, launch,
  organic, outreach, proposals, relationship-signals, sales-response, sales-response-actions, sla);
  the 19th, `shared.js`, holds the common `clean()`/`money()`/`audit()` helpers every domain module
  imports. `src/app/office/actions.js` (59 lines, 41 one-line exports) is a pure re-export shim with
  zero logic — confirmed by direct inspection, not just naming.
  - Two modules (`growth.js` → `growth-experiments.js`, `sales-response-actions.js` →
    `sales-response.js`) follow a two-layer split: a thin Server-Action wrapper (auth check +
    `redirect`/`revalidatePath`) delegating to a pure, directly-testable logic module. This is not
    duplication — `growth.js`'s 4 shared function names are genuine one-line delegations, verified
    by reading the implementation, not just the export list.
- **Edge Function logic**: `supabase/functions/*/index.ts`, with mechanical/deterministic pieces
  (email-send primitives, copy templates, window/domain math) factored into
  `supabase/functions/_shared/*.ts`. Map of which function imports which shared module:

  | Function | `_shared` imports |
  |---|---|
  | notify-new-lead | runtime, email |
  | send-approved-outreach | runtime, email, outreach |
  | send-booking-reminders | runtime, email, booking-reminders |
  | send-daily-sales-report | runtime, email |
  | send-nurture-emails | runtime, email, nurture |
  | (other 8 functions) | runtime only |

- **Data/rules logic**: `supabase/migrations/*` — RPCs like `try_claim_magic_link_send`,
  `reserve_email_send`/`record_email_send_result`, RLS policies, and the Aug 15 game-RPC hardening
  migrations.

## 6. Supabase Edge Functions (14, confirmed via directory listing)

`audit-conversion-pages`, `collect-organic-opportunities`, `collect-phase3-signals`,
`discover-apollo-candidates`, `draft-sequence-followups`, `ingest-gmail-replies`,
`notify-new-lead`, `process-apollo-enrichment`, `process-phase3-pipeline`,
`send-approved-outreach`, `send-booking-reminders`, `send-daily-sales-report`,
`send-nurture-emails`, `test-apollo-connection` — matches what's currently deployed (verified
during this session's deploy work).

## 7. CI / quality gates (grew since Aug 15)

`.github/workflows/ci.yml` now has **three** jobs, not one:
1. `check` — `npm run check` (lint + typecheck + vitest + `npm audit`) + `typecheck:strict`
   (scoped strict-null-checks gate) + an informational, non-blocking coverage report.
2. `edge-functions-typecheck` — `deno check` per function directory, then `npm run test:edge`
   (Deno unit tests over `supabase/tests/*-test.ts`).
3. `database-regression` — spins up an ephemeral local Supabase instance (`supabase db start`) and
   runs `supabase/tests/game_rpc_hardening.sql` (pgTAP) against it. This is the only path that ever
   executes that test — it is deliberately never run against the live/shared project.

## 8. Repo hygiene — confirmed and one new item

- Root-level scraping scripts (`extract_activities*.js`, `process_games.js`, `bundle.js`, etc.)
  flagged in the Aug 15 review are confirmed gone — root now only has config files, docs
  (`.md`), and `html_structure.txt`/`original_activities.html`/`teamtastic_website_mockup.png`
  (design-reference artifacts, not scripts).
- **New since Aug 15**: `supabase/tests/email-test 2.ts` — a stale, broken duplicate of
  `email-test.ts`. It imports `sendResendEmail` from `_shared/email.ts`, a function that no longer
  exists there (the module now exports `sendViaResend`); the file would fail to type-check if
  anything ever ran it. Its filename (`email-test 2.ts`, with a literal space) doesn't match the
  `test:edge` script's glob (`supabase/tests/*-test.ts` requires the name to end exactly in
  `-test.ts`), so CI silently never touches it — it's just dead, broken weight sitting in the repo.
  Flagged here for Phase 2 to size as a refactor item.

## 9. Test surface (recount from Aug 15)

- 34 Vitest files under `src/` (was ~3 at the Aug 15 review — the growth is almost entirely new
  coverage for `office/*` modules and previously-untested server libs).
- 5 Deno test files under `supabase/tests/*-test.ts` (all new since Aug 15).
- 1 pgTAP SQL test (`game_rpc_hardening.sql`), CI-wired since Aug 15.
- 1 stale/dead test file (`email-test 2.ts`, see §8) not counted above since it doesn't run.

---

This map is ground truth for Phases 1–5. It does not render verdicts — sizing, risk-ranking, and
recommendations happen in the later phases, which should reference specific line numbers here
rather than re-deriving the inventory.
