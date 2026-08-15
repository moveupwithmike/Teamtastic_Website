-- Automated, read-only launch readiness evaluation. It creates internal tasks only.

create table public.launch_readiness_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_bucket timestamptz not null unique,
  status text not null check (status in ('ready','warning','blocked')),
  blocker_count integer not null default 0 check (blocker_count >= 0),
  warning_count integer not null default 0 check (warning_count >= 0),
  checks jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index launch_readiness_snapshots_created_idx
  on public.launch_readiness_snapshots(created_at desc);

alter table public.launch_readiness_snapshots enable row level security;
revoke all on table public.launch_readiness_snapshots from public, anon, authenticated;
grant select, insert, update, delete on table public.launch_readiness_snapshots to service_role;

create or replace function automation.evaluate_launch_readiness()
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_bucket timestamptz := date_trunc('hour', now());
  v_health_status text;
  v_failed_notifications integer := 0;
  v_stale_notifications integer := 0;
  v_missing_next_action integer := 0;
  v_missing_qualification integer := 0;
  v_mailbox_status text;
  v_blockers integer := 0;
  v_warnings integer := 0;
  v_status text;
  v_checks jsonb;
begin
  select status into v_health_status
  from public.conversion_health_runs order by started_at desc limit 1;

  select count(*)::integer into v_failed_notifications
  from public.notification_deliveries
  where status = 'failed' and created_at >= now() - interval '30 days';

  select count(*)::integer into v_stale_notifications
  from public.notification_deliveries
  where status = 'pending'
    and created_at >= now() - interval '30 days'
    and created_at < now() - interval '10 minutes';

  select count(*)::integer into v_missing_next_action
  from public.deals
  where outcome = 'open'
    and (nullif(trim(next_action), '') is null or next_action_due_at is null);

  select count(*)::integer into v_missing_qualification
  from public.leads
  where lead_source in ('holiday_party_money_page','year_end_celebration_page','large_holiday_event_page')
    and created_at >= now() - interval '30 days'
    and (preferred_event_date is null or nullif(trim(event_timezone), '') is null);

  select status into v_mailbox_status
  from public.mailbox_sync_state order by updated_at desc limit 1;

  v_blockers :=
    case when coalesce(v_health_status, 'missing') <> 'healthy' then 1 else 0 end +
    case when v_failed_notifications + v_stale_notifications > 0 then 1 else 0 end +
    case when v_missing_next_action > 0 then 1 else 0 end +
    case when v_mailbox_status = 'error' then 1 else 0 end;
  v_warnings :=
    case when v_missing_qualification > 0 then 1 else 0 end +
    case when coalesce(v_mailbox_status, 'not_configured') not in ('healthy','error') then 1 else 0 end;
  v_status := case when v_blockers > 0 then 'blocked' when v_warnings > 0 then 'warning' else 'ready' end;

  v_checks := jsonb_build_array(
    jsonb_build_object('key','conversion_health','status',coalesce(v_health_status,'missing'),'blocking',coalesce(v_health_status,'missing') <> 'healthy'),
    jsonb_build_object('key','lead_notifications','failed',v_failed_notifications,'stale_pending',v_stale_notifications,'blocking',v_failed_notifications + v_stale_notifications > 0),
    jsonb_build_object('key','deal_next_actions','missing',v_missing_next_action,'blocking',v_missing_next_action > 0),
    jsonb_build_object('key','holiday_qualification','missing',v_missing_qualification,'blocking',false),
    jsonb_build_object('key','mailbox_sync','status',coalesce(v_mailbox_status,'not_configured'),'blocking',v_mailbox_status = 'error')
  );

  insert into public.launch_readiness_snapshots(snapshot_bucket,status,blocker_count,warning_count,checks)
  values(v_bucket,v_status,v_blockers,v_warnings,v_checks)
  on conflict(snapshot_bucket) do update set
    status=excluded.status, blocker_count=excluded.blocker_count,
    warning_count=excluded.warning_count, checks=excluded.checks, created_at=now();

  if v_status = 'blocked' then
    insert into public.tasks(title,description,priority,due_at,source,fingerprint)
    values(
      'B2B launch readiness regression',
      'Launch Control detected ' || v_blockers || ' blocking condition(s). Open /office/launch before enabling or continuing sales activity.',
      'urgent', now(), 'launch_watchlist', 'launch:readiness:' || current_date::text
    ) on conflict(fingerprint) where fingerprint is not null do update set
      description=excluded.description, priority='urgent', due_at=now(),
      status=case when public.tasks.status='completed' then 'open' else public.tasks.status end,
      updated_at=now();
  else
    update public.tasks set status='completed',updated_at=now()
    where source='launch_watchlist' and status in ('open','in_progress');
  end if;

  return jsonb_build_object('status',v_status,'blockers',v_blockers,'warnings',v_warnings,'checks',v_checks);
end;
$$;

create or replace function public.evaluate_launch_readiness()
returns jsonb language sql security invoker set search_path=''
as $$ select automation.evaluate_launch_readiness(); $$;
revoke all on function public.evaluate_launch_readiness() from public, anon, authenticated;
grant execute on function public.evaluate_launch_readiness() to service_role;
revoke all on function automation.evaluate_launch_readiness() from public, anon, authenticated;

do $job$
declare job_id bigint;
begin
  select jobid into job_id from cron.job where jobname='launch-readiness-watchlist' limit 1;
  if job_id is not null then perform cron.unschedule(job_id); end if;
  perform cron.schedule('launch-readiness-watchlist','*/15 * * * *','select automation.evaluate_launch_readiness();');
end $job$;
