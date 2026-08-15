-- Consent-aware, first-party funnel telemetry. No PII or form content.
create table public.funnel_events (
  id bigint generated always as identity primary key,
  session_id uuid not null,
  submission_id uuid,
  event_name text not null check (event_name in (
    'landing_page_viewed','page_engaged','concierge_modal_opened','quiz_started',
    'lead_submit_attempted','lead_captured','lead_capture_failed',
    'pricing_cta_clicked','deposit_cta_clicked','booking_call_clicked',
    'holiday_checklist_downloaded','free_game_clicked'
  )),
  landing_page text not null,
  referrer_host text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  properties jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index funnel_events_occurred_idx on public.funnel_events(occurred_at desc);
create index funnel_events_page_event_idx on public.funnel_events(landing_page,event_name,occurred_at desc);
create index funnel_events_session_idx on public.funnel_events(session_id,occurred_at desc);
create index funnel_events_submission_idx on public.funnel_events(submission_id) where submission_id is not null;

alter table public.funnel_events enable row level security;
revoke all on table public.funnel_events from public,anon,authenticated;
revoke all on sequence public.funnel_events_id_seq from public,anon,authenticated;
grant select,insert,delete on table public.funnel_events to service_role;
grant usage,select on sequence public.funnel_events_id_seq to service_role;

create or replace function public.get_first_party_funnel_summary(p_days integer default 30)
returns jsonb language sql security invoker set search_path=''
as $$
  with filtered as (
    select * from public.funnel_events
    where occurred_at >= now() - make_interval(days => least(greatest(p_days,1),180))
  ), totals as (
    select count(distinct session_id)::int visitors,
      count(distinct session_id) filter(where event_name='page_engaged')::int engaged_visitors,
      count(distinct session_id) filter(where event_name in ('concierge_modal_opened','quiz_started','pricing_cta_clicked'))::int cta_visitors,
      count(distinct session_id) filter(where event_name='lead_submit_attempted')::int form_starts,
      count(distinct submission_id) filter(where event_name='lead_captured')::int leads
    from filtered
  ), paths as (
    select landing_page,coalesce(utm_source,'direct') utm_source,coalesce(utm_campaign,'unattributed') utm_campaign,
      count(distinct session_id)::int visitors,
      count(distinct session_id) filter(where event_name='page_engaged')::int engaged,
      count(distinct session_id) filter(where event_name in ('concierge_modal_opened','quiz_started','pricing_cta_clicked'))::int cta_visitors,
      count(distinct session_id) filter(where event_name='lead_submit_attempted')::int form_starts,
      count(distinct submission_id) filter(where event_name='lead_captured')::int leads
    from filtered group by landing_page,coalesce(utm_source,'direct'),coalesce(utm_campaign,'unattributed')
  )
  select jsonb_build_object(
    'totals',to_jsonb(t),
    'paths',coalesce((select jsonb_agg(to_jsonb(p) order by p.leads desc,p.form_starts desc,p.cta_visitors desc,p.visitors desc) from paths p),'[]'::jsonb)
  ) from totals t;
$$;
revoke all on function public.get_first_party_funnel_summary(integer) from public,anon,authenticated;
grant execute on function public.get_first_party_funnel_summary(integer) to service_role;

do $job$
declare job_id bigint;
begin
  select jobid into job_id from cron.job where jobname='purge-old-funnel-events' limit 1;
  if job_id is not null then perform cron.unschedule(job_id); end if;
  perform cron.schedule('purge-old-funnel-events','45 10 * * *',
    $$delete from public.funnel_events where occurred_at < now() - interval '180 days';$$);
end $job$;
