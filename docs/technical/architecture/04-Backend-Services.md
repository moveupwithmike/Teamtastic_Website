# 04 — Backend Services (Supabase, Notifications, Stripe Webhook)

## Supabase schema — [202607030001_reliable_lead_capture.sql](../../../supabase/migrations/202607030001_reliable_lead_capture.sql)

Shared project `cutcpkegxwhnafrvfbcd` ("Teamtastic Antigravity"), also used by teamtastic.games.

```
leads                     pre-existing table, extended with:
  submission_id uuid NOT NULL UNIQUE   ← client-generated idempotency key
  email_normalized text NOT NULL       ← lower(trim(email)), indexed w/ created_at
  phone, recommendation_key, landing_page, referrer, utm_* ×5
  context jsonb DEFAULT '{}', updated_at

notification_deliveries   one row per (lead_id, notification_type) — UNIQUE
  status pending|sent|failed, provider_message_id, attempts, last_error

stripe_events             one row per Stripe event — stripe_event_id UNIQUE,
  stripe_session_id UNIQUE, lead_id FK (nullable), matched bool,
  alert_status/attempts/error
```

Hardening in the same migration: RLS enabled on the two new tables; `REVOKE insert/update/delete ON leads FROM anon, authenticated` (browser writes are dead — all writes go through the service role via `/api/leads`).

**Notification trigger:** `leads_notify_after_insert` → `notify_new_lead()` (SECURITY DEFINER) reads `lead_notification_function_url` + `lead_notification_webhook_secret` from **Supabase Vault** and fires `pg_net.http_post({lead_id})` at the Edge Function. The migration also drops a legacy `on_lead_created` trigger to prevent duplicate customer emails.

## Edge Function — [notify-new-lead](../../../supabase/functions/notify-new-lead/index.ts)

Deno function, deployed with JWT verification off; authenticates via `x-webhook-secret` header. For a lead ID it sends up to two Resend emails — `customer_confirmation` (to the lead) and `internal_email` (lead summary to `INTERNAL_NOTIFICATION_EMAIL`) — with per-type idempotency: it skips types already `sent` in `notification_deliveries` and upserts status/attempts/error per attempt. HTML-escapes all lead-provided values.

**Operational reference:** deployment order, Vault secret names, env vars, verification checklist, and monitoring SQL live in [LEAD_FUNNEL_OPERATIONS.md](../../planning/LEAD_FUNNEL_OPERATIONS.md).

### Gaps

1. **`pg_net.http_post` is fire-and-forget.** If the HTTP call fails (function cold-start timeout, bad URL, expired secret), **no `notification_deliveries` row is ever created** — the monitoring query `where status='failed'` only sees failures the function itself recorded. Silent-loss detection requires the inverse query (leads with no delivery rows):
   `select l.* from leads l left join notification_deliveries d on d.lead_id = l.id where d.id is null and l.created_at < now() - interval '10 minutes';`
   Worth adding to LEAD_FUNNEL_OPERATIONS.md and/or a scheduled check.
2. **No automatic retry.** Failed deliveries stay `failed` until someone manually re-invokes the function with the lead ID. A pg_cron job that re-posts failed/missing deliveries would close the loop.
3. **Customer confirmation is generic** ("Michael's team will follow up") for *all four* sources — including the playable demo, which explicitly promised starter-lobby login credentials (doc 03, flow 2). The function receives `lead.lead_source` and could branch per source; it currently doesn't.
4. **`vault.decrypted_secrets` + `pg_net` coupling**: if Vault secrets are absent the trigger silently no-ops (by design, so inserts never fail). Same silent-loss caveat as #1 — the inverse query is the only detector.

## Stripe webhook — [/api/stripe/webhook](../../../src/app/api/stripe/webhook/route.js)

`checkout.session.completed` only. Pipeline: 503 if secrets unset → signature verification (`constructEvent`) → dedupe by `stripe_event_id` (replays return "Already processed", but **retry alert delivery** if the prior alert failed — nice touch) → lead matching: `session.metadata.submission_id` / `client_reference_id` first, else latest lead by `email_normalized` → insert `stripe_events` → in parallel: internal Resend alert + PostHog `deposit_completed`.

### Gaps

1. **The metadata match will essentially never hit for deposits.** The deposit checkout is created *by Calendly*, not by this app — Calendly won't set `metadata.submission_id` or `client_reference_id`. The quiz smuggles the submissionId into the Calendly booking-form `a1` answer field (GameQuiz.js:357), which lands in Calendly's booking data, **not** in the Stripe session. So real-world matching is email-only, and a payer using a different email than the lead form yields `matched=false` ("lead match needed" alerts). Options: reconcile via Calendly webhooks (`invitee.created` carries both the `a1` answer and payment info), or accept email-only matching and monitor the `matched=false` queue.
2. **Every checkout is labeled a "deposit".** The $99/mo Pro subscription and the custom-content add-on are Stripe Payment Links in the same account; their `checkout.session.completed` events will also flow through here, get recorded in `stripe_events`, alert "Deposit received", and fire `deposit_completed` analytics with the wrong semantics. Discriminate on `session.mode` (`subscription` vs `payment`) or line-item/payment-link ID, and emit `subscription_started` separately.
3. **Alert ≠ durable.** If both the insert succeeds and the alert fails, `alert_status='failed'` is recorded and the replay path can heal it — but only if Stripe retries (it retries on non-2xx; this route returns 200 after a failed alert). Practical effect: a failed alert is only retried when a *duplicate* event arrives, which Stripe won't send after a 200. Consider returning 503 when `alertSent === false` so Stripe's retry machinery drives the alert retry (idempotency already makes this safe).
4. `captureServerEvent` failure inside `Promise.allSettled` is swallowed — correct here (analytics must not block revenue recording).

## Env & secrets topology

| Where | Keys |
|---|---|
| Browser (`NEXT_PUBLIC_*`) | Supabase URL/anon (legacy—reads only, client lib deleted), Turnstile site key, PostHog key/host, Calendly URL, 2 Stripe links |
| Next.js server | `SUPABASE_SERVICE_ROLE_KEY`, `TURNSTILE_SECRET_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `INTERNAL_NOTIFICATION_EMAIL` |
| Supabase Vault | `lead_notification_function_url`, `lead_notification_webhook_secret` |
| Edge Function secrets | `LEAD_NOTIFICATION_WEBHOOK_SECRET`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `INTERNAL_NOTIFICATION_EMAIL` (+ auto-injected `SUPABASE_URL`/`SERVICE_ROLE_KEY`) |

`.env.example` documents all of these. Note `RESEND_API_KEY` etc. live in **two** places (Vercel and Supabase Edge secrets) — rotation must touch both.
