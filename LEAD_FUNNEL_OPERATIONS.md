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
- `gmail-reply-ingestion` is active every five minutes.
- Read-only OAuth is connected to `michael@tryteamtastic.com`; mailbox sync is healthy.
- `system_config.gmail_ingestion_enabled` is `true`.
- Live tests confirmed reply classification, immediate sequence stopping, suppression,
  question escalation, and duplicate-message protection.
- Automated Google/no-reply system notifications are excluded from prospect replies.
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

## Phase 3 — Cold outbound foundation

Phase 3 is operating in research/scoring/draft-review mode only. It has no email
sending code, and `system_config.prospecting_enabled` remains `false`.

Current activation state:

- `source_runs`, `enrichment_requests`, `prospect_score_history`, and
  `outreach_drafts` are live, protected by RLS, and reserved for server-side jobs.
- The scoring model combines company fit (35 points), role fit (25), active signal
  strength (30), and PostHog intent (10).
- `process-phase3-pipeline` scores eligible records and creates evidence-backed
  drafts with status `review`; it cannot approve or send a draft.
- Suppression and ineligible-status checks run before scoring and again before
  drafting.
- The weekday `phase3-score-and-draft` schedule exists but is inactive.
- `collect-phase3-signals` is deployed against the GDELT public-news index. It
  searches CRM company names for hiring, expansion, workplace, and award news,
  stores the article title and URL as evidence, retries provider rate limits, and
  has no email access or sending capability.
- The weekday `phase3-signal-collector` schedule exists but is inactive.
- A controlled public-source test discovered and stored 10 evidence-backed news
  signals. The validation company and its signals were then retired.
- Research and enrichment switches remain off. There are currently no eligible
  real target companies in the CRM.
- Apollo is connected through an encrypted Edge Function secret. The no-credit
  authentication and usage tests returned `200`, confirming master-key access;
  no contact search, enrichment, or email sending occurred during validation.
- `discover-apollo-candidates` is deployed with US, 25–2,000 employee, and senior
  People/HR/workplace/culture targeting. A credit-free validation returned 10
  relevant leaders and stored them in `apollo_candidates` for review.
- Apollo discovery is off after validation. The weekday discovery schedule exists
  but is inactive.
- Selected candidates can enter `enrichment_requests` through a database-enforced
  five-per-day queue. No candidates are selected or queued yet, and
  `phase3_enrichment_enabled` remains `false`, so no enrichment credits can be used.
- `process-apollo-enrichment` is deployed but disabled. When explicitly enabled,
  it processes only selected queued candidates, requests work email only (no
  personal email or phone), rechecks suppression, deduplicates companies and
  prospects, and promotes verified contacts into the CRM. Its weekday schedule
  exists but is inactive. A fail-closed validation consumed zero credits.
- A one-time approved batch enriched five selected candidates. All five returned
  verified work contacts, passed suppression checks, and were promoted into five
  CRM company/prospect records. Enrichment was switched off immediately afterward.
- Direct public-web research produced reliable signals for four of the five
  companies after the GDELT provider was rate-limited. Those four prospects scored
  82.5–85.5 and generated `phase3-v2` review-only drafts. The fifth remained at 60
  and correctly received no draft. Copy review found and corrected an awkward
  evidence-introduction pattern; the older drafts were retired.
- Three supplied brand newsletters were distilled into
  `TEAMTASTIC_OUTREACH_VOICE.md`. The Phase 3 writer now uses the
  `phase3-v3.1-teamtastic-voice` template: one evidence-backed opener, one varied playful
  human observation, the emotional promise of participation and connection, the
  practical promise that Teamtastic handles facilitation, and one low-pressure
  question. All generated messages remain review-only.
- This validation created zero prospecting messages and sent zero emails.
- A controlled fake prospect scored 87 and produced one review draft with zero
  outbound messages. The test prospect, company, and draft were then retired.

Safe activation order:

1. Review and select up to five of the first Apollo candidates.
2. Run one capped Apollo enrichment batch and verify its actual credit usage.
3. Promote verified contacts and companies into the CRM with suppression and
   duplicate checks.
4. Run the public-news collector against those companies and review evidence quality.
5. Review scored prospects and drafts manually; tune fit criteria and voice.
6. Activate the weekday research/scoring/drafting schedules while leaving prospecting off.
7. Approve a very small initial batch for separate sending only after the warmed
   TryTeamtastic mailbox, suppression checks, daily caps, and reply handling are
   reconfirmed.

Emergency Phase 3 pause:

```sql
update public.system_config
set phase3_research_enabled = false,
    phase3_enrichment_enabled = false,
    phase3_scoring_enabled = false,
    phase3_drafting_enabled = false,
    prospecting_enabled = false,
    updated_by = 'manual-phase3-stop'
where id = true;
```

## Phase 4 — client lifecycle and escalation

Phase 4 has started with a server-only, fail-closed foundation:

- `lifecycle_actions` stores idempotent, reviewable client follow-ups linked to
  the existing client and event records. It does not send email.
- Scheduled events generate one onboarding checklist and one seven-day readiness
  task. Fingerprints prevent duplicate tasks on repeated runs.
- Completed events prepare four lifecycle actions: a 48-hour thank-you and review
  request, a seven-day testimonial request, a 90-day rebook touch, and an annual
  anniversary touch.
- Every lifecycle draft records `send_enabled: false`. Approval, queueing, and
  sending are separate states, and the database requires reviewer details before
  an action can enter an approved or sending state.
- The escalation engine sends pricing negotiation, complaints, legal language,
  opportunities at or above $5,000, and decisions below 80% confidence to Michael.
  An ordinary operational reply correctly produces no escalation.
- `phase4_lifecycle_enabled`, `phase4_email_enabled`, and
  `phase4_learning_enabled` are all off. The daily Phase 4 preparation schedule
  exists but is inactive. Escalation detection is on as a safety rail.
- A controlled fake-client test created two tasks and four lifecycle actions.
  A second run created zero duplicates. The test data was removed afterward, and
  the client-lifecycle message count remained zero.
- Paid hosted-event deposits now have an idempotent conversion path from the
  verified Stripe webhook into the CRM. A matched payment creates or connects the
  prospect, company, and client; records the money received once; creates an
  urgent onboarding task; and creates a scheduled event only when the lead supplied
  a valid preferred date. Missing dates are explicitly marked `needs_event_details`
  for Michael instead of being guessed.
- Stripe replay handling retries incomplete conversions but does not duplicate a
  client, event, task, conversion, or lifetime-value amount. The webhook continues
  to verify Stripe signatures before processing. Lifecycle conversion remains
  gated by `phase4_lifecycle_enabled`, and it has no email-sending path.
- The paid-conversion test ran inside a rolled-back transaction. It verified one
  client, one event, one onboarding task, one conversion, the correct $200 value,
  and an idempotent replay. No test notification or lifecycle email could commit.

Remaining Phase 4 work:

1. Review and finalize the onboarding checklist fields and lifecycle email copy.
2. Add the approval-and-send worker behind the existing lifecycle email cap.
3. Connect testimonials and review destinations.
4. Build the weekly learning report and recommendation-only tuning loop.
5. Run a supervised real-client lifecycle test before activating the schedule.

Emergency Phase 4 pause:

```sql
update public.system_config
set phase4_lifecycle_enabled = false,
    phase4_email_enabled = false,
    phase4_learning_enabled = false,
    updated_by = 'manual-phase4-stop'
where id = true;
```

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
