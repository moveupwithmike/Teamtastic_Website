# 14 — Lifecycle Emails, Notifications & Deliverability

Covers the non-cold-outreach email surfaces (lead confirmation, nurture drip, daily ops report) and the deliverability safety net (`reserve_email_send`, suppression list, the Resend-webhook auto-pause). This is the layer that's supposed to keep every sender in the repo from becoming a spam problem — with some real cracks in coverage documented below.

## `notify-new-lead` — the lead-confirmation/internal-alert function

Not cron-driven — fired by a Postgres `AFTER INSERT` trigger on `leads` (`SECURITY DEFINER`, reads its target URL/secret from Supabase Vault, `pg_net`s to the function). A companion 5-minute cron (`retry-pending-lead-notifications`) re-fires for any stuck `notification_deliveries` row (up to 5 attempts, leads under 7 days old).

On invocation: `syncLeadToCrm` upserts a `prospects` row keyed by `email_normalized` (race-safe against `23505`) and back-fills `leads.prospect_id` — this is the seam where every storefront lead enters the sales-engine schema described in [12](12-Private-Sales-Office.md)/[13](13-Outbound-Automation-Pipeline.md). Sends two emails: a customer confirmation (copy varies by `lead_source`) and an internal summary to `INTERNAL_NOTIFICATION_EMAIL`. Both go through `reserve_email_send` and are idempotency-checked against `notification_deliveries` before sending.

## `send-nurture-emails` — the quiz-abandoner drip

A single 3-step sequence (day 1 / day 3 / day 7) targeting only `leads.lead_source = 'event_quiz'`, hourly cron. Strictly sequential (won't send day-3 until day-1 shows `sent`), with a 30-day max-age guard so a missed cron run can't "resurrect" a stale lead. Stop condition: skips any lead with **any** `stripe_events` row at all — see the mismatch below. This is a completely separate universe from the cold-outreach sequence system in [13](13-Outbound-Automation-Pipeline.md): different table (`notification_deliveries`/`leads` vs. `outreach_drafts`/`sequence_enrollments`), different trigger source, and — importantly — **`outbound_auto_paused` is never checked here**, only by `draft-sequence-followups`/`send-approved-outreach`.

**Mismatch found**: `send-nurture-emails`' "already converted, stop nurturing" check is just "does any `stripe_events` row exist for this lead," with no filter on `product_key` or `payment_status`. The actual paid-conversion pipeline (`process_paid_conversion`, phase4) requires `product_key = 'hosted_event_deposit' AND payment_status = 'paid'` specifically. Since Stripe's webhook stores whatever `payment_status` it reports (not necessarily `'paid'`) and `products.js` defines multiple product keys, a lead matched to *any* Stripe session — even an incomplete or unrelated-product one — permanently stops receiving nurture emails as "converted," while the actual conversion pipeline wouldn't consider that same event a real conversion at all. Two consumers of `stripe_events`, two different definitions of "did this person convert."

## `send-daily-sales-report` — the ops digest

Daily (12:30 UTC) email to `system_config.daily_report_recipient`: new-lead count, inbound replies by classification, outbound sends by type, open/overdue tasks ("what needs Michael"), `agent_log` entries where automation chose not to act (blocked/skipped/failed/escalated), and open deal pipeline value. On Mondays only, adds a deliverability section: 7-day reply rate plus the `outbound_auto_paused` status with explicit copy pointing back at `/office/settings`. Idempotent per calendar day via a `daily_reports` row; sent through `reserve_email_send` like everything else.

Also covers, scoped to the same trailing-24h window as everything else in the report: open production incidents at critical/high severity (from `production_incidents`), hot leads with an inbound-reply draft awaiting a decision (`sales_response_drafts` where `status='draft'`), a revenue rollup grouped by currency (`deal_payments.amount` where `paid_at` falls in the window), and cold-outreach drafts awaiting approval (`outreach_drafts` where `status='review'`). Every actionable item deep-links into the matching authenticated `/office/...` page (`/office/incidents`, `/office/respond`, `/office/prospects/{id}`) built from `NEXT_PUBLIC_SITE_URL` (falls back to `https://www.teamtastic.events`) — **this is a deliberate plain deep-link, not a one-click action link**: clicking opens the normal `requireOfficeUser()`-gated Sales Office, it does not execute any action itself. `NEXT_PUBLIC_SITE_URL` must be set as a Supabase Edge Function secret for this function's deployment (it's a Next.js env var elsewhere in the repo, but Edge Functions and Next.js don't share a secret store); the report still renders correctly without it, just falling back to the production domain.

## `generate-daily-voice-brief` — optional spoken version of the report

A separate Edge Function, cron-triggered ~5 minutes after `teamtastic-daily-report` (`daily-voice-brief`, `35 12 * * *`, shipped inactive), gated by its own `system_config.daily_report_voice_brief_enabled` (default `false`, alongside `master_enabled`) — deliberately decoupled from `send-daily-sales-report` so a failure here can never affect that function's reliable HTML email. It reads back the `daily_reports` row the report function just wrote (`body_html`, `summary`), and:

1. Generates a 60-90 second plain-English spoken script via an Anthropic model (`anthropic/claude-haiku-4.5`) called through Vercel AI Gateway's Anthropic-Messages-shaped REST endpoint (`https://ai-gateway.vercel.sh/v1/messages`), instructed to open with "Good morning, this is Eddie." (the assistant's persona name, chosen by the founder) and otherwise state only what's in the data, calling out gaps/staleness rather than inventing anything.
2. Converts that script to MP3 through Vercel's supported AI SDK speech interface (`gateway.speechModel("openai/tts-1")`, `voice: "fable"`). The function pins both SDK dependencies in its own `deno.json` so the Supabase deployment is isolated and reproducible.
3. Uploads the decoded audio to a private Supabase Storage bucket (`daily-report-audio`) and writes `daily_reports.audio_url`/`transcript`/`voice_brief_status: 'ready'`.

Every step is independently caught; any failure (missing `AI_GATEWAY_API_KEY`, a non-2xx/timeout from either Gateway call, an upload error) sets `voice_brief_status: 'unavailable'` + `voice_brief_error` and returns cleanly — it never throws, and never touches the columns `send-daily-sales-report` owns. Requires `AI_GATEWAY_API_KEY` as a Supabase Edge Function secret and Vercel AI Gateway speech-model access, which is in beta. Played back and read via `/office/morning-brief` (server-generated signed URL from the private bucket, never a public URL).

## `sync-marketing-performance` — read-only marketing platform data

Cron-triggered daily at 12:00 UTC (30 minutes before `teamtastic-daily-report`, shipped inactive), gated by `system_config.marketing_reporting_sync_enabled` (default `false`) alongside `master_enabled`. Pulls the trailing 7 days from four platforms independently — Google Analytics (GA4 Data API), Google Search Console, Google Ads, and Meta Ads — each wrapped in its own try/catch so one platform's failure or absent credentials never blocks the others. Writes one row per platform per day into `marketing_performance_snapshots` (`platform`, `snapshot_date`, `metrics` jsonb, `error`).

**Read-only by construction**: every request in this function is a report/query/search-style call (GA4 `runReport`, Search Console `searchAnalytics.query`, Google Ads `googleAds:search` via GAQL, Meta `insights`) — none of the four API calls can create, launch, pause, or fund a campaign. This matches `collectEddieContext()`'s existing `advertising_permissions` (`can_launch`/`can_pause`/`can_change_budget`/`can_spend` all `false`).

**Credentials, per platform** (all optional — a platform with unset env vars is silently skipped, not an error): Google Analytics/Search Console/Ads share one OAuth client and refresh token (`GOOGLE_MARKETING_CLIENT_ID`/`_CLIENT_SECRET`/`_REFRESH_TOKEN`, mirroring `src/lib/server/google-calendar.js`'s pattern exactly but as a *separate* OAuth client — Calendar's client is scoped to Calendar only), plus `GOOGLE_ANALYTICS_PROPERTY_ID`, `GOOGLE_SEARCH_CONSOLE_SITE_URL`, and `GOOGLE_ADS_CUSTOMER_ID`+`GOOGLE_ADS_DEVELOPER_TOKEN` (+ optional `GOOGLE_ADS_LOGIN_CUSTOMER_ID` for MCC-managed accounts) respectively. Meta Ads uses a long-lived System User token directly (`META_AD_ACCOUNT_ID`+`META_MARKETING_ACCESS_TOKEN`, no refresh flow). **Google Ads additionally requires a Developer Token approved by Google** (a separate, slower external process — historically 5–14+ business days) — expect this platform to lag the other three.

Both `generate-daily-voice-brief` and `send-daily-sales-report` read the latest snapshot per platform (deduped client-side, since the table can hold multiple days) and mention it in the report/spoken brief, explicitly saying "not connected yet" for a platform with no snapshot rather than omitting the topic silently. `collectEddieContext()` does the same for Eddie's live chat answers.

### Conversational Eddie and confirmed actions

`/office/morning-brief` also contains an authenticated conversational interface. The browser supports typed questions, browser speech recognition, and optional spoken replies; all sales-data access and AI calls remain server-side in `POST /api/office/eddie`. The route revalidates the Office user on every request, restricts browser origins, rate-limits chat and execution separately, loads a bounded live snapshot (latest report, prospects, leads, tasks, drafts, deals, message activity, and incidents), and authenticates to Vercel AI Gateway with `AI_GATEWAY_API_KEY` or Vercel's automatically supplied `VERCEL_OIDC_TOKEN`.

The model receives no general database or code-execution tool. Its forced structured response can either answer read-only or propose exactly one of four allow-listed actions: create a task, change a prospect status, create a response draft, or send an existing response draft. A proposal never executes immediately. The server resolves the target against live data, builds the human-readable confirmation itself, and returns a five-minute HMAC-signed token bound to the authenticated email and exact action. Only a separate **Confirm action** request can execute it. Email confirmations are bound to a fingerprint of the recipient, subject, body, status, and update time, so a draft changed after review is stopped instead of sent.

Confirmed actions claim a unique row in `eddie_action_receipts` before execution. The primary key prevents double-clicks or replay from duplicating a task or send, while the existing `agent_log`, sales-response revisions, suppression rules, daily caps, and idempotent email reservation remain authoritative. `eddie_action_receipts` has RLS enabled and all `anon`/`authenticated` privileges revoked; it is reachable only through the authenticated server route using the service role.

## The Resend webhook (`/api/resend/webhook`) and the auto-pause circuit breaker

Verifies Svix signatures, logs every event to `resend_webhook_events` (deduped by `svix_id`) regardless of type, but only actually **acts** on `email.delivered`/`email.bounced`/`email.complained` — any other event type (e.g. opens/clicks, if Resend is configured to send them) is logged but doesn't update `messages.status`.

**Auto-pause trigger**: only fires the deliverability recheck on a *hard* bounce or a complaint (soft/transient bounces never trigger it). The recheck is scoped strictly to `message_type = 'prospecting'` over a trailing 7 days, and trips `system_config.outbound_auto_paused = true` once `sent_count >= 10 AND (bounce_rate >= 5% OR complaint_rate >= 0.1%)`. It's a one-way latch — nothing clears it except the manual "Resume sending" checkbox in `/office/settings`. Because it's scoped to `prospecting` only, **bounces/complaints on nurture or lead-confirmation emails can add an address to the suppression list but can never trip this pause**, and the pause itself is never consulted by `send-nurture-emails` or `notify-new-lead` regardless.

**Is this webhook actually receiving events?** Strong evidence it isn't yet, as of this snapshot:
- `src/app/api/resend/` and the whole `milestone3_resend_webhook` migration are new/untracked in git — in-progress work, not a verified-live integration.
- `RESEND_WEBHOOK_SECRET` is a blank placeholder in `.env.example`.
- Nothing in any doc (this set or `LEAD_FUNNEL_OPERATIONS.md`) mentions registering the endpoint in Resend's dashboard — contrast with `notify-new-lead`, whose Vault/deploy steps *are* spelled out there.

Registering the webhook is an out-of-repo, Resend-dashboard-only action. Until it's done, the entire bounce/complaint-driven suppression and auto-pause safety net is dormant — `suppression_list` can currently only be populated by the Gmail-reply path and the one-time `leads` backfill, not by actual delivery failures.

## `reserve_email_send` — the shared gate, and its blind spots

Every sender in the repo (booking, office proposals, nurture, cold outreach, lead-confirmation, daily report, reminders) calls this RPC before sending. It checks `system_config.master_enabled`, a per-message-type enable flag, and a per-type daily cap via an atomic counter increment (race-safe). **Suppression-list checking is scoped to `message_type in ('nurture', 'prospecting')` only** — `inbound_confirmation` and `internal_notification` sends bypass it entirely. Practically: a previously-bounced or complained-about address can still receive a fresh lead-confirmation email if they resubmit the quiz/form, because that send path was never suppression-checked.

`suppression_list` itself has (at most) three writers with different semantics: the one-time `leads` backfill (`reason: unsubscribe`, `source: legacy_leads`), the Resend webhook (`reason: complaint|hard_bounce`, `source: resend_webhook` — currently dormant per above), and the Gmail-reply trigger (`reason: unsubscribe|manual`, `source: gmail_reply:<classification>`). Given the webhook gap, only two of these three sources are currently live.

## `/api/leads` rate-limit/Turnstile duplication (cross-reference)

As noted in [10](10-Marketing-Site-and-Lead-Funnel.md), `/api/leads` defines its own local copy of rate-limiting and Turnstile verification rather than importing `src/lib/server/rate-limit.js`/`turnstile.js`. Diffed line-for-line against the shared libs used by the three booking routes: **behaviorally identical today** (same defaults, same dev-bypass string, same timeout) — no drift yet, but a separate in-memory bucket store and a real risk that a future tuning change to the shared lib silently won't apply here.

## Gaps (ranked)

1. **Resend webhook likely not yet receiving real events** (registration is an out-of-repo manual step with no evidence it's been done) — the bounce/complaint-driven half of the deliverability safety net is currently inert.
2. **`reserve_email_send` never suppression-checks `inbound_confirmation`/`internal_notification` sends** — a bounced/complained address can still receive fresh lead-confirmation emails.
3. **`outbound_auto_paused` only ever gates cold outreach** — nurture and lead-confirmation volume/bounces are invisible to the circuit breaker entirely, even though they use the same Resend account and could affect overall sender reputation.
4. **`send-nurture-emails`' "already converted" check and the actual paid-conversion RPC disagree** on what counts as a real conversion (any `stripe_events` row vs. a specific product+status) — a lead could be marked "converted" and cut off from nurture without ever having actually paid.
5. **`/api/leads` duplicates rather than imports the shared rate-limit/Turnstile helpers** — no behavioral drift today, but a maintenance foot-gun and a separate bucket namespace.
