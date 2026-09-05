# 15 — Database Schema Map

A cross-cutting reference: which tables exist, which migration introduced them, which subsystem(s) actually read/write them, and every `system_config` flag / cron job in the project in one place. Read this before diving into 10–14 if you want the shared-state picture first — nearly every subsystem doc references `system_config`, `agent_log`, `reserve_email_send`, or `prospects`/`deals`.

Single shared Supabase Postgres project (also used by the separate `teamtastic.games` product). 26 migrations as of this snapshot. RLS is enabled on essentially every business table, but the near-universal pattern is `revoke all on <table> from anon, authenticated` plus `grant ... to service_role` — i.e. RLS here is a wall against a hypothetical browser-side call using the anon key, not a row-scoped authorization layer. Every route/action/Edge-Function in the repo uses the service-role key, so **the real authorization boundary is "does the caller have the service-role key," not any RLS policy nuance.**

## Table inventory by subsystem

**Storefront — leads/bookings**
- `leads`, `notification_deliveries`, `stripe_events` — `202607030001_reliable_lead_capture.sql`. Written by `/api/leads`, `notify-new-lead`, `/api/stripe/webhook`.
- `booking_types`, `booking_settings`, `bookings` — `20260718232853_native_booking_foundation.sql`. Written by the three booking API routes + the office-only `apply_post_call_outcome` RPC (the only path that reaches `completed`/`no_show`).

**Sales-engine — CRM core**
- `prospects`, `companies`, `messages`, `tasks`, `agent_log`, `system_config`, `suppression_list`, `email_send_counters` — `20260718145314_autonomous_crm_foundation.sql`. This migration also defines `reserve_email_send`/`record_email_send_result`, the shared gate every sender in the repo calls.
- `deals`, `deal_stage_history` (unused by any UI — populated, never displayed), `deal_payments` — `20260719233045_milestone1_deal_pipeline.sql`. Only ever created by DB triggers off `bookings`/`stripe_events`; the office layer only advances existing rows.
- `proposals` — `20260719235008_milestone2_office_foundation.sql` (+ index in `20260720000255`). `metadata` column defined, never used.

**Sales-engine — outbound pipeline**
- `apollo_candidates`, `enrichment_requests` — `phase3_apollo_discovery`/`phase3_apollo_enrichment_queue` migrations.
- `signal_sources`, `signals` — `phase3_signal_collector`. `signal_sources.enabled` for the `gdelt` row is inserted `false` and never flipped — an independent, easy-to-miss kill switch.
- `outreach_drafts` — `phase3_outbound_foundation`, later gains `sequence_step` from `sequence_followups`.
- `sequences`, `sequence_steps` (**orphaned — created, granted, never populated or read**), `sequence_enrollments` — `phase2_schedules`/`sequence_followups`.
- `mailbox_sync_state` — Gmail ingestion status tracking.

**Lifecycle/reporting**
- `resend_webhook_events`, `system_config.outbound_auto_paused` — `milestone3_resend_webhook`.
- `marketing_performance_snapshots` — `20260905204000_marketing_performance_sync.sql`. One row per platform (`google_analytics`/`google_search_console`/`google_ads`/`meta_ads`) per day, written by the `sync-marketing-performance` Edge Function (read-only reporting only — no code path here can write to any ad platform). Read by `collectEddieContext()` (`src/lib/server/office/eddie.js`) and by both `send-daily-sales-report`/`generate-daily-voice-brief`. Existed as a boolean-only placeholder (`marketing_connections` in Eddie's context) before this migration; the connection flags are unchanged, this just makes them capable of turning true.
- `daily_reports` — daily sales report idempotency. Gains `audio_url`/`transcript`/`voice_brief_status`/`voice_brief_error` from `20260905143400_daily_voice_brief.sql`, written by the separate `generate-daily-voice-brief` function, never by `send-daily-sales-report` itself. Same migration creates a private Supabase Storage bucket (`daily-report-audio`) — the first and only Storage usage in this repo; no `storage.objects` policy is added since RLS-with-no-policy already denies anon/authenticated by default and service_role bypasses RLS.
- `lifecycle_actions`, `escalation_rules`, `client_conversions`, `clients`, `events` — phase4 client-lifecycle/paid-conversion migrations.
- `learning_recommendations` — phase4 operational completion.

## `system_config` — flag inventory

Singleton row (`id = true`). Flags found across all migrations, grouped by what they gate:

| Flag | Gates | Editable from Settings UI? |
|---|---|---|
| `master_enabled` | Everything — the top-level kill switch every function checks first | No (not found in `updateSystemConfig`) |
| `booking_email_enabled`, `daily_booking_email_cap` | Booking confirmation/reminder emails | No |
| `booking_reminders_enabled` | `send-booking-reminders` (also needs its cron job flipped active) | No |
| `nurture_enabled`, `daily_nurture_cap` | `send-nurture-emails` | No |
| `prospecting_enabled`, `daily_prospecting_cap`, `prospecting_from_email` | `send-approved-outreach`, discovery/enrichment stages | **Yes** |
| `proposal_email_enabled`, `daily_proposal_cap` | `approveAndSendProposal` | **No** — a real office UI gap, see [12](12-Private-Sales-Office.md) |
| `phase3_apollo_discovery_enabled`, `phase3_enrichment_enabled`, `phase3_apollo_enrichment_daily_cap`, `phase3_research_enabled`, `phase3_scoring_enabled`, `phase3_drafting_enabled`, `phase3_signal_company_limit`, `phase3_minimum_score`, `phase3_max_drafts_per_run`, `phase3_apollo_results_per_run` | The 5 outbound-pipeline stages individually | No — DB-only |
| `sequence_followups_enabled` | `draft-sequence-followups` | **Yes** |
| `outbound_auto_paused` | `draft-sequence-followups`, `send-approved-outreach` only (not nurture/lead-confirmation) | **Yes** (a "Resume sending" checkbox, shown only while paused) |
| `gmail_ingestion_enabled` | `ingest-gmail-replies` | No |
| `daily_report_enabled`, `daily_report_recipient` | `send-daily-sales-report` | No |
| `daily_report_voice_brief_enabled` | `generate-daily-voice-brief` — ships `false`, pending real cost/quality validation (same posture as `gmail_llm_classification_enabled`) | No |
| `marketing_reporting_sync_enabled` | `sync-marketing-performance` — ships `false`; also requires per-platform env vars to be set before any given platform actually syncs (see [14](14-Lifecycle-Emails-and-Deliverability.md)) | No |

Most of the "No" column above isn't a bug — these are mostly one-time/rarely-touched ops toggles — but `proposal_email_enabled`/`daily_proposal_cap` stand out because the dashboard actively surfaces a proposal-approval workflow that can be silently blocked by them with no UI explanation.

## Full cron inventory (every job found, across every migration)

| Job | Schedule | Active by default? | Subsystem |
|---|---|---|---|
| `retry-pending-lead-notifications` | `*/5 * * * *` | Yes | Lead notify retry |
| `quiz-abandoner-nurture` | `0 * * * *` | Yes | Nurture drip |
| `teamtastic-daily-report` | `30 12 * * *` | Yes | Daily report |
| `daily-voice-brief` | `35 12 * * *` | No | Daily report — decoupled voice-brief follow-on, reads the row `teamtastic-daily-report` just wrote |
| `sync-marketing-performance` | `0 12 * * *` | No | Marketing reporting — runs before the daily report so that day's report/voice-brief can include yesterday's numbers |
| `phase3-apollo-enrichment` | `15 12 * * 1-5` | **Yes** | Outbound pipeline — the only pipeline stage active |
| `office-post-call-tasks` | `*/15 * * * *` | Yes | Office |
| `phase3-apollo-discovery` | `0 12 * * 1-5` | No | Outbound pipeline |
| `phase3-signal-collector` | `30 12 * * 1-5` | No | Outbound pipeline |
| `phase3-score-and-draft` | `0 13 * * 1-5` | No | Outbound pipeline |
| `draft-sequence-followups` | `10 13 * * 1-5` | No | Outbound pipeline |
| `send-approved-outreach` | `*/30 13-21 * * 1-5` | No | Outbound pipeline |
| `gmail-reply-ingestion` | `*/5 * * * *` | No | Reply ingestion |
| `send-booking-reminders` | `*/15 * * * *` | No | Booking |
| `phase4-lifecycle-preparation` | (weekly-ish) | No | Client lifecycle |
| `phase4-weekly-learning` | (weekly) | No | Client lifecycle |

**Pattern**: every non-trivial feature added since the CRM foundation is shipped with its cron job explicitly deactivated, requiring a manual `cron.alter_job(..., active := true)` to go live — this is consistent, deliberate rollout discipline across the whole codebase (confirmed by explicit comments in several migrations), not an isolated oversight. But it does mean a large fraction of what's *described* as automated in the schema/functions is not actually running yet.

## Orphaned or dead schema found across all subsystems

- `sequence_steps` — created, granted, claimed-populated by a migration's own (inaccurate) comment; actually empty and unread by any function.
- `automation.score_prospect(uuid)` SQL RPC — fully implemented, granted, never called (the outbound-pipeline function reimplements the same formula in TypeScript instead).
- `deal_stage_history` — populated by trigger, never displayed by any office page.
- `proposals.metadata` — defined, never read or written.
- `enrichment_requests.request_kind` values `'company_contacts'`/`'email_verification'` and their corresponding unique-index targeting paths — schema supports them, nothing ever inserts them.
- `test-apollo-connection` — not orphaned so much as intentionally never scheduled; a manual diagnostic endpoint.

## Cross-subsystem semantic mismatches found

- **"Did this lead convert?"** is answered two different ways by two different consumers of `stripe_events`: `send-nurture-emails` treats *any* row as conversion; `process_paid_conversion` requires a specific product key and `payment_status = 'paid'`. See [14](14-Lifecycle-Emails-and-Deliverability.md).
- **Sequence-enrollment status vocabulary is inconsistent**: reply-stop and suppression-stop use `stopped_reply`/`stopped_suppressed`, booking-stop uses `paused`, natural completion uses `completed` — four different terminal/semi-terminal states with no unified naming, and no path ever resumes a `paused` enrollment.
- **Suppression-list checking is inconsistent by message type**: `nurture`/`prospecting` are checked inside `reserve_email_send`; `inbound_confirmation`/`internal_notification`/`booking` are not. See [14](14-Lifecycle-Emails-and-Deliverability.md).
