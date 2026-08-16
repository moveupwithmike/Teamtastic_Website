# Phase 0 — System Discovery & Architecture Map

Part of the [Code Review Plan](../CODE_REVIEW_PLAN.md), covering CODE_REVIEW_PROMPT.md §1. This
document establishes ground truth for Phases 1–5; it makes no quality judgments.

## 1. What this repository actually is

This is **not** a single application — it's three things sharing one Supabase project:

1. **Public marketing site** (Next.js 16, App Router) — SEO/landing pages, a lead-gen quiz, Stripe
   checkout, and a booking system.
2. **"Office" ops dashboard** (`src/app/office/**`) — a single-operator internal tool (one hardcoded
   allowed email, magic-link auth) for running a semi-automated B2B sales/growth pipeline: lead
   scoring, outreach approval, incident/SLA monitoring, launch readiness, revenue attribution.
3. **Supabase backend** (Postgres + 14 Deno Edge Functions) — shared by both of the above, and also
   by a **separate live-game product hosted at `teamtastic.games`** that has no frontend code in
   this repo at all (see §5 below — this is the key correction to the plan's original "real-time"
   framing).

An existing [ARCHITECTURE.md](../../ARCHITECTURE.md) already documents some conventions (JS/TS
language boundary, error-ownership rules, audit-ownership rules, shared timezone utility). Phase 1
should check actual code against these documented rules, not just against the review prompt's
generic criteria — deviation from the team's own stated conventions is a stronger finding than
deviation from a generic checklist.

## 2. Component inventory

| Component | Location | Language | Responsibility |
|---|---|---|---|
| Marketing/SEO pages | `src/app/{page.js, blog/**, use-cases/**, virtual-*/**, why-teamtastic, team-experiences, resources/**}` | JS (Server Components) | Static/SSR content, ~30 SEO landing + blog pages |
| Lead-gen quiz | `src/components/GameQuiz.js` + `src/lib/game-handoff.js` | JS (Client) | Collects team size/vibe/occasion, captures lead, redirects to `https://teamtastic.games` (external app) with query-param handoff |
| Games catalog | `src/app/games/**`, `src/components/GamesCatalog.js`, `src/lib/gamesData.json` | JS | Static catalog browsing (SEO), not gameplay |
| Booking system | `src/app/api/bookings/**`, `src/app/book/**`, `src/lib/server/{booking-manage,booking-cleanup,booking-time,availability-access,google-calendar,zoom}.js` | JS | Availability, confirm/cancel/reschedule, Google Calendar + Zoom integration |
| Payments | `src/app/api/stripe/**`, `src/lib/stripe.js` | JS | Stripe Checkout sessions + webhook handling |
| Lead capture / funnel tracking | `src/app/api/leads`, `src/app/api/funnel-events`, `src/lib/lead-client.js`, `src/components/FunnelIntentTracker.js` | JS | First-party intent/funnel event ingestion |
| Email | `src/app/api/resend/webhook` | JS | Resend delivery-event webhook (svix-verified) |
| Bot protection | `src/lib/server/turnstile.js`, `src/components/TurnstileWidget.js` | JS | Cloudflare Turnstile verification on forms |
| Analytics | `src/lib/analytics.js`, `src/lib/server/posthog.js`, `src/components/PostHogProvider.js`, `next.config.mjs` rewrites | JS | PostHog, proxied through `/ingest/*` to avoid ad-blockers |
| Office dashboard | `src/app/office/**` (root + `(private)/*` route group, 17 pages) | JS (Server Components + `"use server"` actions) | Read-mostly dashboards over growth-engine SQL views, plus a handful of mutating server actions (`src/app/office/actions.js`) |
| Office auth | `src/lib/server/office-auth.js`, `src/proxy.js` | JS | Single-allowed-email gate; `proxy.js` matches `/office/:path*` and only refreshes the Supabase auth cookie — actual authorization check happens per-page via `requireOfficeUser()`, not in the proxy |
| Supabase server client | `src/lib/supabase/server.js`, `src/lib/server/supabase-admin.js` | JS | Cookie-scoped client (RLS-bound) vs. service-role admin client — worth confirming in Phase 1 that admin client usage is properly scoped to office/webhook code only |
| Supabase Edge Functions | `supabase/functions/*` (14 functions) | TypeScript (Deno) | Async growth-automation pipeline: Apollo prospect discovery/enrichment, outreach drafting/sending, Gmail reply ingestion, nurture emails, booking reminders, daily sales report, conversion-page auditing, organic-signal collection |
| Shared Edge Function runtime | `supabase/functions/_shared/runtime.ts` | TypeScript | Per ARCHITECTURE.md: webhook auth, service-role client construction, error normalization |
| Database | `supabase/migrations/*` (40 files, Aug 9–15 2026) | SQL | Growth-engine schema (deals, prospects, campaigns, experiments, incidents, SLA), **and** the live-game schema (`events`, `round_states`, buzzer/scoring RPCs) — the latter has no owning application code in this repo |
| DB tests | `supabase/tests/milestone1_deal_pipeline.sql` | SQL (pgTAP-style, transactional) | Single test file for the deal pipeline; no equivalent for the game RPCs despite those being the most recently security-hardened surface |

## 3. Entry points

- **HTTP page routes**: ~50 `page.js` files under `src/app` (marketing, blog, office dashboard, booking management by token — `src/app/book/manage/[token]/page.js`).
- **API routes**: `src/app/api/{bookings/{availability,availability-access,cancel,confirm,config,reschedule}, funnel-events, leads, resend/webhook, stripe/{checkout,proposal-checkout,webhook}}/route.js`.
- **Auth callback**: `src/app/auth/callback/route.js` (Supabase magic-link exchange, feeds office auth).
- **Middleware**: `src/proxy.js`, scoped only to `/office/:path*` — not global. It refreshes the Supabase session cookie; it does not itself gate access.
- **Server actions**: `src/app/office/actions.js` (`"use server"`), invoked from office dashboard pages — the main mutation path for the growth-ops tool.
- **Supabase Edge Functions**: 14 independently-invoked HTTP entry points (`supabase/functions/*/index.ts`), triggered by Supabase Cron/webhooks, not by this Next.js app directly as far as observed.

## 4. External dependencies

| Dependency | Used for | Where |
|---|---|---|
| Supabase (Postgres + Auth + Edge Functions) | Primary datastore, office auth, background automation | Throughout |
| Stripe | Checkout, payments, webhook events | `src/lib/stripe.js`, `src/app/api/stripe/**` |
| Resend | Transactional email + delivery webhooks (svix-verified) | `src/app/api/resend/webhook`, Edge Functions (`send-nurture-emails`, `send-booking-reminders`, `send-daily-sales-report`) |
| Cloudflare Turnstile | Bot protection on public forms | `src/lib/server/turnstile.js` |
| PostHog | Product analytics | `src/lib/server/posthog.js`, `posthog-js`/`posthog-node`, proxied via `next.config.mjs` |
| Google Calendar | Booking scheduling | `src/lib/server/google-calendar.js` |
| Zoom | Meeting link generation for bookings | `src/lib/server/zoom.js` |
| Apollo.io | Prospect discovery/enrichment (B2B outreach) | Edge Functions only (`discover-apollo-candidates`, `process-apollo-enrichment`, `test-apollo-connection`) — no Apollo SDK dependency in `package.json`, implies raw HTTP calls from Deno |
| `teamtastic.games` (external app, not in this repo) | The actual live/buzzer game experience | Linked via `src/lib/game-handoff.js` only |

No message broker, no cache layer (e.g. Redis), no dedicated background-job runner beyond Supabase Edge Functions + presumably `pg_cron`/Supabase Scheduled Functions (config not inspected in this phase).

## 5. Correction to the plan's "real-time" framing

The [Code Review Plan](../CODE_REVIEW_PLAN.md) flagged this as needing verification. Confirmed:

- The most recently touched migrations (2026-08-15, currently untracked in git status) harden RPCs
  like `clear_buzzers`, `increment_ai_credits`, and answer-submission/scoring functions, operating
  on `events`, `round_states`, and buzzer-queue state — this is unmistakably a **live, host-driven
  buzzer game's backend**.
- There is **no client code for that game anywhere in this repository**. `grep` for
  realtime/channel usage (`supabase.channel`, `.rpc('submit_answer'...)`, etc.) across `src`
  returns nothing. `src/components/GameQuiz.js` is a lead-gen questionnaire, not gameplay, and
  `src/lib/game-handoff.js` confirms the actual game lives at `https://teamtastic.games`, an
  external product this repo only redirects to.
- **Consequence for Phase 4**: prompt §9's literal criteria (connection lifecycle, reconnect
  behavior, event ordering, horizontal scaling of stateful servers) apply to a system this repo
  doesn't contain the frontend for. Phase 4 should instead assess the real async-reliability
  surface that *is* in this repo: Stripe/Resend webhook idempotency, Edge Function retry/failure
  handling, booking-availability race conditions, and — separately, as a scoping/security question
  rather than a code-quality one — whether the game RPCs newly hardened in the untracked migrations
  are consistent with how the external game client is presumed to call them (unverifiable without
  access to that app's source, so Phase 4 should flag this as an **assumption**, not assert it).

## 6. Where business logic actually lives

- **Booking domain logic**: correctly centralized in `src/lib/server/*` (booking-manage,
  booking-cleanup, booking-time, availability-access), consumed by both API routes and office
  actions. This matches ARCHITECTURE.md's stated intent.
- **Pricing logic**: split across **two files** — `src/lib/pricing.js` (has its own test,
  presumably client-facing) and `src/lib/server/pricing.js` (server-facing, no colocated test seen
  in the file listing). Phase 2 should check whether this is a deliberate client/server split with
  a single source of truth, or duplicated business rules.
- **Growth/outreach logic**: lives predominantly in **SQL** (the 40 migrations define scoring,
  routing, and workflow functions directly in Postgres) and in the **Edge Functions** (TypeScript).
  The Next.js "office" pages are thin dashboards reading from views/RPCs rather than reimplementing
  logic — Phase 1 should confirm this holds throughout and isn't violated by some pages, and
  whether the SQL-as-business-logic pattern is appropriate or a testability liability (feeds Phase
  3).
- **Audit logging**: per ARCHITECTURE.md, office server actions own audit entries for user-
  initiated mutations (see `audit()` helper in `src/app/office/actions.js`); background triggers
  own their own. Phase 1 should spot-check this split is actually followed.

## 7. Test surface (corrects the plan's initial estimate)

The plan document under-counted this. Actual test inventory:

- `src/lib/{pricing,game-handoff,recommendations}.test.js`
- `src/lib/server/{booking-manage,booking-cleanup}.test.js`
- `src/app/api/{funnel-events,leads}/route.test.js`
- `src/app/api/bookings/{cancel,confirm,availability,reschedule,availability-access}/route.test.js`
- `src/app/api/stripe/{webhook,checkout}/route.test.js`
- `src/test/supabase-admin-mock.js` — shared mock helper
- `supabase/tests/milestone1_deal_pipeline.sql` — one pgTAP-style transactional SQL test

Vitest (`vitest.config.mjs`) runs `src/**/*.test.{js,jsx}` in `jsdom`. Notably: **no test file for
`src/app/api/resend/webhook`**, **no test for the 14 Edge Functions**, and **no SQL test for the
Aug 15 game-RPC security migrations** — those are candidates for Phase 3's risk-based prioritization
given they're the newest and most security-sensitive surface in the repo.

## 8. Tooling / CI surface (ground truth for Phase 5)

- No `.github/workflows` directory — **no CI configuration exists in this repo.**
- `package.json` scripts: `lint` (ESLint), `typecheck` (`tsc --noEmit`), `test` (vitest run),
  composite `check` = lint + typecheck + test.
- `eslint.config.mjs` extends only `eslint-config-next/core-web-vitals`.
- `supabase/config.toml` present (local Supabase CLI config) — local dev stack is set up even
  without CI wiring it in.

## 9. Text diagram

```
                         ┌─────────────────────────┐
                         │   teamtastic.games       │  (separate app, not in this repo)
                         │   live buzzer game UI    │
                         └────────────┬─────────────┘
                                      │ redirected to by
                                      │ game-handoff.js (query params)
┌──────────────────────────────────────────────────────────────────────┐
│  Next.js app (this repo)                                             │
│                                                                        │
│  Marketing/SEO pages ─┐                                              │
│  GameQuiz (lead funnel)├─► src/lib/lead-client.js ─┐                 │
│  Booking UI            │                            │                 │
│  Office dashboard ◄────┘  src/lib/server/office-auth.js               │
│       │ "use server" actions (office/actions.js)     ▼                │
│       │                                    ┌───────────────────┐      │
│  API routes ───────────────────────────────►  Supabase Postgres │      │
│  (bookings, leads, funnel-events,          │  (40 migrations:   │      │
│   stripe, resend webhooks)                  │   growth-engine +  │      │
│                                              │   game RPCs)       │      │
└──────────────────────────────────────────────┴────────┬──────────┘      │
                                                          │                │
                     ┌────────────────────────────────────┘                │
                     ▼                                                     │
        Supabase Edge Functions (Deno, 14 fns)                             │
        Apollo discovery/enrichment, outreach send,                        │
        Gmail reply ingest, nurture/reminder emails,                       │
        daily sales report, conversion audit                               │
                     │                                                     │
                     ▼                                                     │
        External: Apollo.io, Resend, Google Calendar, Zoom,                │
        Stripe, Cloudflare Turnstile, PostHog ───────────────────────────┘
```

## 10. Open items for later phases

- **Phase 1**: verify office admin-client vs. RLS-scoped client boundary is respected everywhere;
  confirm SQL-as-business-logic pattern is consistent; check `proxy.js` matcher-only auth pattern
  isn't a false sense of security (per-page `requireOfficeUser()` is the real gate — confirm every
  private office page actually calls it).
- **Phase 2**: resolve whether `src/lib/pricing.js` vs. `src/lib/server/pricing.js` is duplication.
- **Phase 3**: the untested surfaces called out in §7 (Resend webhook, Edge Functions, game-RPC SQL)
  are the risk-prioritized starting list.
- **Phase 4**: reinterpret real-time criteria per §5; investigate webhook idempotency (Stripe/Resend)
  and Edge Function retry semantics concretely rather than assuming.
- **Phase 5**: no CI exists at all — this is itself a Phase 5 finding, not just a gap to fill in.
