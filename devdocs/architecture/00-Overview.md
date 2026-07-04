# Architecture Overview

> Snapshot date: 2026-07-03. Reflects the working tree including the (uncommitted) lead-funnel + PostHog integration.

## What this system is

The **Teamtastic marketing storefront** at `teamtastic.events`. It sells live, emcee-hosted virtual team-building game shows. The actual game engine lives on a **separate product domain, `teamtastic.games`** — this repo never runs games; it markets them, captures leads, routes bookings/payments, and reports analytics.

```
                        ┌──────────────────────────────────────────────┐
                        │  teamtastic.events (THIS REPO)               │
                        │  Next.js 16 App Router · React 19 · JS only  │
                        │                                              │
  Visitor ──────────────▶  Marketing pages  ─▶ Lead-capture UIs        │
                        │  (SSG/static)        · Event Quiz            │
                        │                      · Playable Demo         │
                        │                      · Concierge Modal ×2    │
                        │                          │                   │
                        │                          ▼                   │
                        │                 POST /api/leads  ────────────┼──▶ Supabase (leads)
                        │                 POST /api/stripe/webhook ◀───┼─── Stripe (deposits)
                        └───────────┬──────────────┬───────────────────┘
                                    │              │
              PostHog (/ingest ────▶┘              └──▶ Resend (emails, via
              reverse proxy)                            Supabase Edge Function)
                                    
  External conversion surfaces (linked, not owned by this repo):
   · teamtastic.games      — free game lobbies / self-service arcade
   · Calendly + Stripe     — $200-deposit hosted-event booking
   · Stripe Payment Links  — $99/mo Pro subscription, custom-content add-on
```

## Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 16.2.6 (App Router, Turbopack) | `src/app` directory, JS (no TypeScript) |
| UI | React 19, Tailwind CSS v4, Framer Motion, lucide-react, sonner | Dark theme forced globally in [layout.js](../../src/app/layout.js) |
| Fonts | Outfit (sans), Caveat (script accent for "Celebrate.") | |
| DB | Supabase Postgres (shared project `cutcpkegxwhnafrvfbcd`, also used by teamtastic.games) | Server writes only via service-role key |
| Bot defense | Cloudflare Turnstile | Client widget + server siteverify |
| Analytics | PostHog (US cloud, project 496937) | Client via `/ingest` reverse proxy, server via `posthog-node` |
| Email | Resend | Sent from a Supabase Edge Function + the Stripe webhook route |
| Payments | Stripe Payment Links + Calendly (Stripe-backed deposit) | No in-app checkout |
| Hosting | Vercel (implied by `VERCEL_OIDC_TOKEN` in `.env.local`) | No CI pipeline in repo |

## Component map

| # | Doc | Covers |
|---|---|---|
| 01 | [01-Marketing-Site.md](01-Marketing-Site.md) | Routes, layout, SEO surface (sitemap/robots/metadata) |
| 02 | [02-Game-Catalog.md](02-Game-Catalog.md) | `gamesData.json`, game types, catalog + detail pages, per-game-flow issues |
| 03 | [03-Lead-Funnel.md](03-Lead-Funnel.md) | The three lead-capture experiences and their game flows, `/api/leads` |
| 04 | [04-Backend-Services.md](04-Backend-Services.md) | Supabase schema/migration, notification Edge Function, Stripe webhook |
| 05 | [05-Analytics.md](05-Analytics.md) | PostHog init, event taxonomy, consent & PII policy |
| 06 | [06-Payments-and-Booking.md](06-Payments-and-Booking.md) | PAYMENT_CONFIG, Calendly deposit flow, Stripe links |
| 07 | [07-Gaps-and-Unfinished-Wiring.md](07-Gaps-and-Unfinished-Wiring.md) | Consolidated gap analysis + unfinished-wiring checklist |
| 08 | [08-Modernization-Design.md](08-Modernization-Design.md) | Target architecture, modernization principles, phased roadmap, and acceptance criteria |
| 09 | [09-Modernization-Implementation-Plan.md](09-Modernization-Implementation-Plan.md) | Prioritized implementation tasks, dependencies, release gates, and definition of done |

## Directory layout (signal only)

```
src/
  app/
    page.js                      Home (Hero → SoloDemo → GameQuiz → Pricing)
    games/page.js                Catalog (client component, 51 games)
    games/[slug]/page.js         SSG detail page per game
    activities/page.js           Alias that re-exports the catalog page
    pricing/ team-experiences/ virtual-team-building/
    virtual-family-game-night/   Light-theme B2C landing page
    use-cases/[slug]/ blog/ resources/ why-teamtastic/
    api/leads/route.js           Lead intake (validation, Turnstile, rate limit, insert)
    api/stripe/webhook/route.js  checkout.session.completed → record + alert
    sitemap.js  robots.js  layout.js
  components/                    Hero, GameQuiz, SoloDemo, TalkToMichaelModal,
                                 Pricing, TurnstileWidget, CTA banners, Navbar, Footer…
  lib/
    gamesData.json               51-game catalog (single source of truth)
    analytics.js                 track() wrapper (consent + PII strip)
    lead-client.js               captureLead() → /api/leads, attribution capture
    recommendations.js           vibe → package recommendation (server-shared)
    stripe.js                    PAYMENT_CONFIG (payment/booking links)
    server/supabase-admin.js     service-role client factory
    server/posthog.js            captureServerEvent()
  instrumentation-client.js      PostHog client init (Next 15.3+ pattern)
supabase/
  migrations/202607030001_reliable_lead_capture.sql
  functions/notify-new-lead/     Deno Edge Function → Resend emails
```

Root-level clutter (`bundle.js`, `fetch_*.js`, `extract_*.js`, `*_games.json`, `original_activities*`) is **one-time scraping tooling** used in May 2026 to build `gamesData.json`. It is not part of the running app and is excluded from ESLint via the `*.js` root ignore in [eslint.config.mjs](../../eslint.config.mjs).

## Core data flows

**Lead capture (all four UIs converge):**
UI → `captureLead()` ([lead-client.js](../../src/lib/lead-client.js), adds UTM/referrer attribution + client-generated `submissionId` UUID) → `POST /api/leads` (validate → rate-limit → Turnstile verify → idempotent insert) → Postgres trigger `leads_notify_after_insert` → `pg_net` HTTP post → `notify-new-lead` Edge Function → Resend (customer confirmation + internal alert), with delivery bookkeeping in `notification_deliveries`.

**Deposit revenue:**
Quiz result → Calendly (Stripe-backed $200 deposit) → Stripe fires `checkout.session.completed` → `/api/stripe/webhook` verifies signature → dedupe via `stripe_events` → match lead by `submission_id` then `email` → Resend internal alert + PostHog `deposit_completed`.

**Analytics:**
Client events via `track()` (consent-gated, PII-stripped) → `/ingest` rewrite → PostHog. Server events via `captureServerEvent()`. Identity note: **no `posthog.identify()` is ever called** — `person_profiles: "identified_only"` means all events remain anonymous-person events; funnels work per device, but cross-device/lead-level identity stitching is not wired (see doc 05).

## Trust boundaries

- Browser is untrusted: leads only enter through `/api/leads` (anon Supabase key was **removed** — `src/lib/supabase.js` deleted; `revoke insert...from anon` in the migration enforces this at the DB too).
- Server-only secrets: `SUPABASE_SERVICE_ROLE_KEY`, `TURNSTILE_SECRET_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY` — consumed exclusively in `src/lib/server/*`, the two API routes, and the Edge Function.
- Edge Function is public-URL but requires the `x-webhook-secret` header, whose value lives in Supabase Vault and is injected by the DB trigger.
