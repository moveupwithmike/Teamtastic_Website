-- Advisor remediation for the shared Teamtastic production database.
-- Keep player-facing SECURITY DEFINER RPCs intact; they require a separate
-- authorization audit because anonymous players intentionally call them.

-- Make the client AI status view respect the caller's RLS policies and expose
-- only the read privilege the client portal needs.
create or replace view public.client_ai_status
with (security_invoker = true)
as
select
  id,
  name,
  email,
  ai_tier,
  ai_credits_used,
  ai_credits_limit,
  case
    when ai_credits_limit is null then true
    when ai_credits_used < ai_credits_limit then true
    else false
  end as has_credits_remaining,
  case
    when ai_credits_limit is null then null::integer
    else greatest(0, ai_credits_limit - ai_credits_used)
  end as credits_remaining
from public.clients;

revoke all on public.client_ai_status from public, anon, authenticated, service_role;
grant select on public.client_ai_status to authenticated, service_role;

-- Pin every advisor-flagged function to trusted schemas. ALTER FUNCTION keeps
-- the function body and existing callers unchanged.
alter function public.update_updated_at_column() set search_path = pg_catalog, public, auth, extensions;
alter function public.fill_icebreaker_response_event_id() set search_path = pg_catalog, public, auth, extensions;
alter function public.update_escape_room_progress_updated_at() set search_path = pg_catalog, public, auth, extensions;
alter function public.append_buzzer(uuid, uuid, text, text) set search_path = pg_catalog, public, auth, extensions;
alter function public.pop_buzzer(uuid) set search_path = pg_catalog, public, auth, extensions;
alter function public.clear_buzzers(uuid) set search_path = pg_catalog, public, auth, extensions;
alter function public.append_buzz(uuid, uuid, text, text, text, bigint) set search_path = pg_catalog, public, auth, extensions;
alter function public.create_event_from_template(uuid, text, uuid) set search_path = pg_catalog, public, auth, extensions;
alter function public.reorder_rounds(jsonb) set search_path = pg_catalog, public, auth, extensions;
alter function public.handle_new_user() set search_path = pg_catalog, public, auth, extensions;
alter function public.process_nurture_drips() set search_path = pg_catalog, public, auth, extensions;

-- Trigger and scheduler entrypoints are internal implementation details, not
-- public Data API RPCs. Triggers do not require callers to hold EXECUTE, and
-- pg_cron runs these functions as postgres.
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.process_nurture_drips() from public, anon, authenticated;
revoke all on function public.capture_direct_player_score_write() from public, anon, authenticated;
revoke all on function public.capture_direct_team_score_write() from public, anon, authenticated;
revoke all on function public.enforce_reaction_rate_limit() from public, anon, authenticated;
revoke all on function public.trigger_booking_reminders() from public, anon, authenticated;
revoke all on function public.trigger_nurture_emails() from public, anon, authenticated;
revoke all on function public.trigger_send_scheduled_event_email() from public, anon, authenticated;

grant execute on function public.handle_new_user() to postgres, service_role;
grant execute on function public.process_nurture_drips() to postgres, service_role;
grant execute on function public.capture_direct_player_score_write() to postgres, service_role;
grant execute on function public.capture_direct_team_score_write() to postgres, service_role;
grant execute on function public.enforce_reaction_rate_limit() to postgres, service_role;
grant execute on function public.trigger_booking_reminders() to postgres, service_role;
grant execute on function public.trigger_nurture_emails() to postgres, service_role;
grant execute on function public.trigger_send_scheduled_event_email() to postgres, service_role;

-- Evaluate auth.uid() once per statement instead of once per lead row.
drop policy if exists "Allow admin read/write" on public.leads;
create policy "Allow admin read/write"
on public.leads
for all
to authenticated
using (
  exists (
    select 1 from public.users u
    where u.id = (select auth.uid()) and u.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.users u
    where u.id = (select auth.uid()) and u.role = 'admin'
  )
);

-- Cover foreign-key joins and parent-row deletes across B2B, bookings,
-- lifecycle automation, attribution, certification, and incident management.
create index if not exists b2b_certification_runs_stripe_event_id_idx on public.b2b_certification_runs (stripe_event_id);
create index if not exists b2b_launch_history_certification_run_id_idx on public.b2b_launch_history (certification_run_id);
create index if not exists b2b_launch_history_readiness_snapshot_id_idx on public.b2b_launch_history (readiness_snapshot_id);
create index if not exists b2b_launch_state_certification_run_id_idx on public.b2b_launch_state (certification_run_id);
create index if not exists b2b_launch_state_readiness_snapshot_id_idx on public.b2b_launch_state (readiness_snapshot_id);
create index if not exists bookings_booking_type_id_idx on public.bookings (booking_type_id);
create index if not exists bookings_lead_id_idx on public.bookings (lead_id);
create index if not exists bookings_rescheduled_from_id_idx on public.bookings (rescheduled_from_id);
create index if not exists event_capacity_holds_event_id_idx on public.event_capacity_holds (event_id);
create index if not exists event_capacity_holds_prospect_id_idx on public.event_capacity_holds (prospect_id);
create index if not exists lifecycle_actions_event_id_idx on public.lifecycle_actions (event_id);
create index if not exists lifecycle_actions_prospect_id_idx on public.lifecycle_actions (prospect_id);
create index if not exists messages_sequence_enrollment_id_idx on public.messages (sequence_enrollment_id);
create index if not exists organic_attribution_booking_id_idx on public.organic_attribution (booking_id);
create index if not exists organic_attribution_draft_id_idx on public.organic_attribution (draft_id);
create index if not exists organic_attribution_lead_id_idx on public.organic_attribution (lead_id);
create index if not exists organic_attribution_opportunity_id_idx on public.organic_attribution (opportunity_id);
create index if not exists organic_attribution_payment_id_idx on public.organic_attribution (payment_id);
create index if not exists organic_opportunities_source_id_idx on public.organic_opportunities (source_id);
create index if not exists organic_source_runs_source_id_idx on public.organic_source_runs (source_id);
create index if not exists outreach_drafts_sequence_enrollment_id_idx on public.outreach_drafts (sequence_enrollment_id);
create index if not exists outreach_drafts_signal_id_idx on public.outreach_drafts (signal_id);
create index if not exists outreach_drafts_source_run_id_idx on public.outreach_drafts (source_run_id);
create index if not exists payment_requests_deal_id_idx on public.payment_requests (deal_id);
create index if not exists production_incidents_deal_id_idx on public.production_incidents (deal_id);
create index if not exists production_incidents_lead_id_idx on public.production_incidents (lead_id);
create index if not exists production_incidents_prospect_id_idx on public.production_incidents (prospect_id);
create index if not exists sales_response_drafts_deal_id_idx on public.sales_response_drafts (deal_id);
create index if not exists sales_response_drafts_prospect_id_idx on public.sales_response_drafts (prospect_id);
create index if not exists sequence_enrollments_prospect_id_idx on public.sequence_enrollments (prospect_id);
create index if not exists stripe_events_lead_id_idx on public.stripe_events (lead_id);
create index if not exists tasks_client_id_idx on public.tasks (client_id);
create index if not exists tasks_event_id_idx on public.tasks (event_id);
create index if not exists tasks_prospect_id_idx on public.tasks (prospect_id);
create index if not exists warm_relationship_signals_company_id_idx on public.warm_relationship_signals (company_id);
create index if not exists warm_relationship_signals_deal_id_idx on public.warm_relationship_signals (deal_id);
