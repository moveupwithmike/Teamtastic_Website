# Architecture Overview — v3

> Snapshot date: 2026-07-23. Supersedes [00-Overview.md](00-Overview.md) (2026-07-03).
>
> **Why a v3 pass:** the 2026-07-03 docs (`01`–`09`) describe this repo as a marketing storefront with a lead funnel and a Stripe webhook. That's still true, but it's no longer the whole system. In the three weeks since, this repo grew a second, much larger subsystem: an autonomous outbound B2B sales engine (Apollo prospecting → enrichment → scoring → cold outreach → reply handling → sequence follow-ups) plus a private internal sales CRM ("the office") and a fully native booking system (Zoom/Google Calendar, holds, reschedule, no-show). Docs `01`–`06` are still directionally correct for what they cover (marketing pages, game catalog, the original lead funnel, PostHog, Stripe) but say nothing about any of that. This pass adds the missing half and re-verifies the parts that changed underneath it.
>
> **Explicitly out of scope:** the actual game engine (host/broadcast/player runtime, live game sessions) lives on the separate `teamtastic.games` product/domain and is not in this repository. Nothing below documents that engine — only the marketing catalog data and the URL handoff to it.

## What this system actually is now

Two systems sharing one Next.js app and one Supabase project:

1. **The storefront** (unchanged in kind, documented in `01`–`06`/`10`): public marketing pages, a game catalog, three lead-capture UIs, a native booking scheduler, and Stripe-deposit checkout — all feeding a `leads`/`bookings` pipeline.
2. **The sales engine** (new, documented in `12`–`14`): a private internal CRM (`/office`, allow-listed single admin) sitting on top of a `deals`/`proposals` pipeline, plus a fully autonomous outbound pipeline — Apollo discovery → enrichment → GDELT signal collection → JS-side lead scoring → templated cold-outreach drafting → human-in-the-loop approval → send → Gmail reply ingestion/classification → sequence follow-ups — built entirely as Supabase Edge Functions + `pg_cron` + Postgres triggers, with almost no Next.js involvement beyond the office UI.

Both systems share the same Postgres project, the same `system_config` singleton row (feature flags/kill-switches), the same `reserve_email_send`/`record_email_send_result` RPC pair (the central per-recipient, per-type daily-cap + suppression gate every sender in the repo goes through), and the same `agent_log` audit table.

```
                    ┌───────────────────────────── teamtastic.events (THIS REPO) ─────────────────────────────┐
                    │                                                                                          │
                    │   STOREFRONT                              │   SALES ENGINE (private, /office)           │
                    │   ───────────                             │   ─────────────────────────────             │
  Visitor ──────────┼──▶ Marketing pages, game catalog          │   Michael ──▶ /office (single allow-listed  │
                    │      │                                    │      email, magic-link auth)                │
                    │      ▼                                    │      │                                      │
                    │   Lead-capture UIs (quiz/demo/concierge)   │      ▼                                      │
                    │      │                                    │   Dashboard: call outcomes, proposal        │
                    │      ▼                                    │   approvals, outreach-draft review,         │
                    │   POST /api/leads ──────────────────────┐ │   deal pipeline, prospect timeline           │
                    │                                          │ │      ▲                                     │
                    │   Booking: BookingScheduler/Manage       │ │      │ (deals/prospects/outreach_drafts)     │
                    │      │                                   │ │      │                                     │
                    │      ▼                                   ▼ ▼      │                                     │
                    │   /api/bookings/{confirm,cancel,reschedule} ──▶ Postgres (Supabase, shared project)      │
                    │      │  (Zoom + Google Calendar + native hold/exclusion-constraint slot locking)         │
                    │      ▼                                                       ▲                          │
                    │   Stripe deposit link (flat $200/$100, NOT price-aware) ─▶ /api/stripe/webhook           │
                    │                                                              │                          │
                    │                                              Postgres triggers/pg_cron ──▶ Edge Fns:    │
                    │                                              Apollo discover/enrich, GDELT signals,      │
                    │                                              phase3 score+draft, sequence follow-ups,    │
                    │                                              send-approved-outreach, Gmail reply ingest, │
                    │                                              nurture emails, daily sales report,         │
                    │                                              booking reminders, lead notify              │
                    │                                                              │                          │
                    └──────────────────────────────────────────────────────────────┼──────────────────────────┘
                                                                                    ▼
                                                          Resend (all outbound email) · PostHog · Google/Zoom/Apollo/GDELT APIs

  External, not owned by this repo: teamtastic.games (game engine), Calendly (legacy fallback link only)
```

## Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 16.2.6 (App Router) | `src/app`, plain JS (no TypeScript in the Next app) |
| UI | React 19, Tailwind v4, Framer Motion, lucide-react, sonner | Dark theme forced globally |
| DB | Supabase Postgres, single shared project (also used by `teamtastic.games`) | 26 migrations as of this snapshot; RLS enabled everywhere, `anon`/`authenticated` revoked on nearly every business table — `service_role` (server/Edge-Function-only) is the real access boundary, not RLS policy nuance |
| Scheduled/background work | Supabase Edge Functions (Deno/TypeScript) + `pg_cron` + `pg_net` | 12 functions; **only 2 of ~12 outbound-pipeline cron jobs are active** — see [13](13-Outbound-Automation-Pipeline.md) |
| Bot defense | Cloudflare Turnstile | Used by bookings + `/api/leads`; **not** used by `/api/bookings/availability` (gap) |
| Rate limiting | In-memory, per-process `Map`, resets on deploy (accepted tradeoff) | `src/lib/server/rate-limit.js`; `/api/leads` has its own byte-identical but structurally separate copy |
| Analytics | PostHog (client `/ingest` proxy + `posthog-node` server-side) | Consent-gated (real gate, not cosmetic) but PostHog defaults closer to opt-out than opt-in — see [17](17-Analytics-and-Consent.md) |
| Email | Resend, exclusively | Every sender in both systems (booking, office proposals, nurture, cold outreach, daily report, reminders) goes through the same `reserve_email_send`/Resend pattern |
| Payments | Stripe **Payment Links only** — no Checkout Session/PaymentIntent creation anywhere in the repo | Flat $200 (or $100 family) deposit regardless of quoted/estimated price — a repo-wide gap, not office-specific, see [16](16-Payments-and-Stripe.md) |
| Video/Calendar | Zoom Server-to-Server OAuth, Google Calendar OAuth refresh-token | Used by native booking only |
| External data | Apollo.io (prospecting/enrichment), GDELT (free news signals), Gmail API (OAuth, polling, not push) | All outbound-pipeline only |
| Hosting | Vercel (implied) | No CI pipeline in repo |

## Component map

**Prior pass (2026-07-03), still directionally accurate for what they cover:**

| # | Doc | Covers |
|---|---|---|
| 01 | [01-Marketing-Site.md](01-Marketing-Site.md) | Routes, layout, SEO surface |
| 02 | [02-Game-Catalog.md](02-Game-Catalog.md) | `gamesData.json`, catalog/detail pages |
| 03 | [03-Lead-Funnel.md](03-Lead-Funnel.md) | Original three lead-capture UIs, `/api/leads` |
| 04 | [04-Backend-Services.md](04-Backend-Services.md) | Original Supabase schema, `notify-new-lead` |
| 05 | [05-Analytics.md](05-Analytics.md) | PostHog init (partially superseded — `PostHogProvider.js` is now a no-op stub, see [17](17-Analytics-and-Consent.md)) |
| 06 | [06-Payments-and-Booking.md](06-Payments-and-Booking.md) | `PAYMENT_CONFIG`, Calendly/Stripe deposit (booking has since gone fully native — see [11](11-Booking-System.md)) |
| 07–09 | Gap analysis / modernization plan | Written before the office/automation build-out; treat as historical |

**This pass (v3), new or fully re-verified:**

| # | Doc | Covers |
|---|---|---|
| 10 | [10-Marketing-Site-and-Lead-Funnel.md](10-Marketing-Site-and-Lead-Funnel.md) | Re-verified: game catalog (53 games, 8 original/45 imported), quiz/demo/concierge flows, the price-quote-vs-flat-deposit pattern |
| 11 | [11-Booking-System.md](11-Booking-System.md) | Native booking: hold/confirm/cancel/reschedule, Zoom+Calendar integration, reminders |
| 12 | [12-Private-Sales-Office.md](12-Private-Sales-Office.md) | `/office` CRM: auth model, dashboard, deal pipeline, proposals, prospects |
| 13 | [13-Outbound-Automation-Pipeline.md](13-Outbound-Automation-Pipeline.md) | Apollo/GDELT/scoring/drafting/sending/reply-ingestion pipeline, full cron inventory |
| 14 | [14-Lifecycle-Emails-and-Deliverability.md](14-Lifecycle-Emails-and-Deliverability.md) | Lead-notify, nurture drip, daily sales report, Resend webhook/auto-pause |
| 15 | [15-Database-Schema-Map.md](15-Database-Schema-Map.md) | Cross-cutting table/migration map, orphaned tables/columns, `system_config` flag inventory |
| 16 | [16-Payments-and-Stripe.md](16-Payments-and-Stripe.md) | Stripe Payment Links, webhook, product classification, the price-mismatch gap |
| 17 | [17-Analytics-and-Consent.md](17-Analytics-and-Consent.md) | PostHog/Meta/GA4, consent gating (real vs. cosmetic), event taxonomy |
| 18 | [18-Security-Auth-and-Rate-Limiting.md](18-Security-Auth-and-Rate-Limiting.md) | Office auth, capability-token booking auth, Turnstile/rate-limit usage and gaps |
| 19 | [19-Gaps-Unfinished-Wiring-and-Coding-Standards.md](19-Gaps-Unfinished-Wiring-and-Coding-Standards.md) | Consolidated, ranked gap list across every subsystem above |

## Core data flows (updated)

**Lead capture** (unchanged in shape): UI → `captureLead()` → `POST /api/leads` (validate → rate-limit → Turnstile → idempotent insert on `submission_id`) → `leads_notify_after_insert` trigger → `notify-new-lead` Edge Function → Resend, **and** `syncLeadToCrm` upserts a `prospects` row — this is the seam where the storefront hands off into the sales-engine schema.

**Booking** (now fully native, no Calendly in the primary path): `BookingScheduler` → `GET /api/bookings/availability` (Google Calendar freeBusy, **no rate limit/Turnstile**) → `POST /api/bookings/confirm` → RPC `hold_booking_slot` (exclusion-constraint slot locking) → Zoom + Google Calendar provisioning → confirm. Self-service manage via a SHA-256-hashed capability token (`/book/manage/[token]`) — cancel/reschedule require only possession of the emailed link, no account.

**Deal creation** (new): a confirmed booking or a completed Stripe payment fires a DB trigger (`automation.sync_booking_deal`/`sync_stripe_deal`) that creates/advances a `deals` row — **no office server action ever creates a deal**; the office layer only *advances* stage via call-outcome/proposal actions.

**Outbound sales pipeline** (new, and mostly dormant by design): `discover-apollo-candidates` → `process-apollo-enrichment` → `process-phase3-pipeline` (JS-side scoring + templated drafting, no LLM) → human approves in `/office` → `send-approved-outreach` (gated by `reserve_email_send` + a 14-day same-company cooldown + a 9am–5pm ET sending window) → `ingest-gmail-replies` (regex/keyword classification, not ML) → `draft-sequence-followups`. **Only the Apollo-enrichment cron job is active**; every other stage requires manual invocation as shipped — see [13](13-Outbound-Automation-Pipeline.md) for the full activation checklist.

**Deliverability safety net** (new): every sender — booking, proposal, nurture, cold outreach, lead-confirmation, daily report — reserves through `reserve_email_send` (checks `system_config.master_enabled`, a per-type enable flag, and a per-type daily cap). Only `nurture`/`prospecting` sends are also checked against `suppression_list`; **lead-confirmation and internal-notification sends are never suppression-gated**. The Resend-webhook-driven auto-pause (`outbound_auto_paused`) only watches cold-outreach bounce/complaint rates and appears not yet registered on Resend's side — see [14](14-Lifecycle-Emails-and-Deliverability.md).

## Trust boundaries (updated)

- **Storefront → DB**: browser never touches Supabase directly (no anon key in the client bundle); all writes go through validated API routes using the service-role key.
- **Office auth**: a single hardcoded allow-listed email (`OFFICE_ALLOWED_EMAIL`), magic-link via Supabase Auth, enforced once in `(private)/layout.js` — a structural (directory-placement) boundary, not a per-page or middleware-enforced one. No roles table; not designed for a second operator.
- **Booking auth**: capability-URL pattern (256-bit token, SHA-256-hashed at rest) — same trust model as Calendly, not account-based. Anyone with the emailed link can cancel/reschedule.
- **Edge Functions**: none use Supabase JWT verification (`verify_jwt = false` everywhere); each checks a static `x-webhook-secret` header instead. This is the only auth layer for 12 publicly-reachable HTTP endpoints.
- **RLS**: enabled on essentially every business table, but `anon`/`authenticated` are revoked outright rather than given row-scoped policies — RLS here is a wall against a hypothetical browser-side Supabase call, not a fine-grained authorization layer. The actual authorization boundary is "does the caller have the service-role key," full stop.

## How to read the rest of this doc set

Start with [15-Database-Schema-Map.md](15-Database-Schema-Map.md) if you want the shared-state picture (which tables everything reads/writes) before diving into any one subsystem — nearly every component doc below references `system_config`, `agent_log`, `reserve_email_send`, or `prospects`/`deals`, and it's easier to follow each subsystem doc with that map in hand. Then [19-Gaps-Unfinished-Wiring-and-Coding-Standards.md](19-Gaps-Unfinished-Wiring-and-Coding-Standards.md) is the single consolidated punch list if you just want "what's broken/unfinished," ranked.
