# Lead Funnel Operations

## Autonomous CRM safety state

The CRM foundation migration is intentionally fail-closed. When first applied,
`system_config.master_enabled` is `false`, so no autonomous email can reserve a
send. Do not enable prospecting during the foundation rollout.

Safe activation order:

1. Apply `20260718145314_autonomous_crm_foundation.sql` in a non-production project.
2. Confirm every CRM table has RLS enabled and no `anon` or `authenticated` grants.
3. Deploy the updated `notify-new-lead` and `send-nurture-emails` functions.
4. Set and authenticate `michael@tryteamtastic.com` as the future prospecting sender.
5. Turn on `master_enabled` and `internal_notifications_enabled` only; leave all
   customer-facing automation flags off.
6. Test a form submission and confirm the prospect, lead link, task, agent log,
   and internal notification behavior.
7. Enable `inbound_auto_reply_enabled`, with `daily_inbound_cap` kept at 25.
8. Enable nurture only after reply ingestion can stop sequences. Prospecting stays
   disabled until Gmail ingestion, suppression handling, and approval mode exist.

Emergency stop:

```sql
update public.system_config
set master_enabled = false, updated_by = 'manual-emergency-stop'
where id = true;
```

The autonomous sender must call `reserve_email_send` before every email. A blocked
reservation is recorded in `agent_log`; it must never be bypassed by retry logic.

TryTeamtastic is the prospecting boundary. Warm inbound and client communication
remain on the existing Teamtastic sender. Prospecting must use a mailbox on
`tryteamtastic.com`, beginning with five approved emails per business day.

### Shared Supabase migration history

The website currently uses the same Supabase project as Teamtastic Games. That
project has an extensive migration history that is not present in this website
repository. Do not run `migration repair` from this repository or treat a normal
CLI push as safe until the Games migration files are reconciled. The CRM migrations
were applied through the connected Supabase migration API and verified directly.

## Phase 2 — Gmail reply intelligence

Phase 2 uses read-only Gmail OAuth and polls the TryTeamtastic inbox every five
minutes. It does not mark messages read, modify labels, archive, delete, or send
through Gmail. Every Gmail message ID is deduplicated before processing.

Current activation state:

- `teamtastic-daily-report` is active at `12:30 UTC` each morning.
- `gmail-reply-ingestion` exists but is inactive until OAuth is connected.
- `system_config.gmail_ingestion_enabled` remains `false` until the OAuth test passes.
- Nurture and prospecting remain disabled.

### One-time Gmail OAuth setup

1. Create or select a Google Cloud project owned by Teamtastic.
2. Enable the Gmail API and configure the OAuth consent screen.
3. Create a Web application OAuth client.
4. Authorize `michael@tryteamtastic.com` using only
   `https://www.googleapis.com/auth/gmail.readonly` and request offline access.
5. Store the client ID, client secret, and resulting refresh token as Supabase
   Edge Function secrets named `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, and
   `GMAIL_REFRESH_TOKEN`. Never place them in browser or Vercel public variables.
6. Manually invoke `ingest-gmail-replies`; confirm the mailbox state becomes
   `healthy` and known replies are inserted once.
7. Set `system_config.gmail_ingestion_enabled = true`, then activate the
   `gmail-reply-ingestion` cron job.

Google only returns the refresh token during an offline authorization grant in
many cases. Preserve it; repeatedly generating tokens can invalidate older ones.

### Reply behavior

- Every inbound reply stops pending, active, or paused sequences immediately.
- Unsubscribe, complaint, legal, and explicit not-interested replies add the
  sender to the suppression list.
- Interested replies create a high-priority task.
- Complaints and legal language create urgent tasks.
- Unknown or low-confidence classifications always create a review task.
- Out-of-office replies stop the current sequence but do not suppress the sender.
- All decisions are written to `agent_log` and appear in the daily report,
  including blocked and skipped actions.

## Deployment order

1. Verify the Resend sending domain and collect the production sender address.
2. Deploy `supabase/functions/notify-new-lead` with JWT verification disabled. The function authenticates database calls using the dedicated webhook secret.
3. Set the Edge Function secrets listed in `.env.example`.
4. Create two Supabase Vault secrets before applying the migration:
   - `lead_notification_function_url`: the deployed `notify-new-lead` function URL.
   - `lead_notification_webhook_secret`: a strong random value.
   The webhook secret value must exactly match `LEAD_NOTIFICATION_WEBHOOK_SECRET` on the Edge Function.
5. Apply `supabase/migrations/202607030001_reliable_lead_capture.sql`. This replaces the legacy `on_lead_created` trigger to prevent duplicate emails.
6. Add the Next.js/Vercel variables from `.env.example`.
7. In Stripe, register `https://teamtastic.events/api/stripe/webhook` for `checkout.session.completed` and copy its signing secret.
8. Configure Calendly/Stripe customer confirmations in their dashboards.
9. Deploy the website only after the migration and notification function are live.

Do not apply the migration before steps 1–4. The migration intentionally removes
the legacy lead-email trigger when it activates the replacement.

## Quiz-abandoner nurture sequence

Sends up to 3 emails per `event_quiz` lead who hasn't paid the deposit: day 1
(package recap), day 3 (social proof), day 7 (direct nudge). Stops permanently
once a matching `stripe_events` row appears. Replies go to
`INTERNAL_NOTIFICATION_EMAIL` (Michael's inbox) via the email's `reply_to`.

1. Deploy `supabase/functions/send-nurture-emails` with JWT verification
   disabled, same as `notify-new-lead`.
2. Set its Edge Function secrets: `NURTURE_WEBHOOK_SECRET` (a new strong
   random value — do not reuse `LEAD_NOTIFICATION_WEBHOOK_SECRET`),
   `STRIPE_DEPOSIT_URL` (same value as `NEXT_PUBLIC_STRIPE_DEPOSIT_URL`),
   plus `RESEND_API_KEY` / `RESEND_FROM_EMAIL` / `INTERNAL_NOTIFICATION_EMAIL`
   (same values as `notify-new-lead`).
3. Create two Supabase Vault secrets:
   - `nurture_function_url`: the deployed `send-nurture-emails` function URL.
   - `nurture_webhook_secret`: must exactly match `NURTURE_WEBHOOK_SECRET`.
4. Apply `supabase/migrations/202607040001_quiz_abandoner_nurture.sql`. This
   schedules an hourly `pg_cron` job (`quiz-abandoner-nurture`) that invokes
   the function — no code path calls it directly.

### Verification

- Manually invoke the function (`curl -X POST <url> -H "x-webhook-secret: ..."`)
  and confirm a `200` with `{"processed": N, "sent": M}`.
- Backdate a test lead's `created_at` by 25 hours in a non-production project
  and confirm exactly one `nurture_day1` row appears in `notification_deliveries`
  on the next invocation, and the email arrives with the correct package recap.
- Confirm a lead with a matching `stripe_events` row is skipped entirely (no
  nurture email after a deposit is paid).
- Confirm `cron.job` shows `quiz-abandoner-nurture` scheduled `0 * * * *`:
  `select * from cron.job where jobname = 'quiz-abandoner-nurture';`

## Verification checklist

- Submit each of the event quiz, playable demo, event concierge, and family concierge.
- Confirm one `leads` row and two successful notification deliveries per lead: customer confirmation and internal email.
- Retry with the same `submission_id`; confirm no additional row or notification.
- Complete a Stripe test-mode checkout and confirm one `stripe_events` row plus the internal email alert.
- Replay the Stripe event; confirm it reports `Already processed`.
- Confirm PostHog receives funnel events without names, emails, phone numbers, or free-text answers.

## Routine monitoring

- Failed lead notifications:
  `select * from notification_deliveries where status = 'failed' order by updated_at desc;`
- Leads with incomplete notifications:
  `select l.id, l.email, l.lead_source, d.notification_type, d.status, d.attempts from leads l join notification_deliveries d on d.lead_id = l.id where d.status <> 'sent' order by l.created_at desc;`
- Unmatched deposits:
  `select * from stripe_events where matched = false order by paid_at desc;`
- Lead volume by source:
  `select lead_source, count(*) from leads where created_at > now() - interval '30 days' group by lead_source;`
- Nurture sequence funnel (how many quiz leads reach each step):
  `select notification_type, status, count(*) from notification_deliveries where notification_type like 'nurture_%' group by notification_type, status order by notification_type;`

Transient notification failures can be retried by invoking the Edge Function with the lead ID. Successfully sent notification types are idempotent and will be skipped.
