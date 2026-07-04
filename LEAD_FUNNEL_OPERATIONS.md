# Lead Funnel Operations

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

Transient notification failures can be retried by invoking the Edge Function with the lead ID. Successfully sent notification types are idempotent and will be skipped.
