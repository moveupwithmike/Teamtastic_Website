-- Classification-aware launch readiness.
--
-- The readiness evaluator previously counted raw records. It now applies the
-- canonical production-classification boundary so that records explicitly
-- classified test_qa or certification can never create launch blockers,
-- while production records and unresolved records (fail closed) do.
-- Decisions come exclusively from production_record_classification_status;
-- names, emails, titles, and wording are never consulted.
--
-- Also extends deal-action detection: an open production/unresolved deal now
-- blocks when its next action is MISSING or OVERDUE (previously only missing
-- actions were counted).

-- Single canonical production-readiness eligibility predicate, reused by the
-- evaluator so no divergent definitions exist.
create or replace function automation.record_affects_production_readiness(
  p_record_type text,
  p_record_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1
    from public.production_record_classification_status status
    where status.record_type = p_record_type
      and status.record_id = p_record_id
      and status.classification in ('test_qa', 'certification')
  );
$$;

revoke all on function automation.record_affects_production_readiness(text, uuid) from public, anon, authenticated;

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
  v_overdue_next_action integer := 0;
  v_missing_qualification integer := 0;
  v_mailbox_status text;
  v_open_incidents integer := 0;
  v_overdue_priority_tasks integer := 0;
  v_overdue_normal_tasks integer := 0;
  v_final_certification_status text;
  v_blockers integer := 0;
  v_warnings integer := 0;
  v_status text;
  v_checks jsonb;
begin
  perform automation.resolve_recovered_automation_incidents();

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

  -- Deal actions respect the canonical classification boundary:
  --   production / unresolved -> affect readiness (unresolved fails closed)
  --   test_qa / certification -> excluded entirely
  select
    count(*) filter (
      where nullif(trim(coalesce(d.next_action, '')), '') is null
        or d.next_action_due_at is null
    )::integer,
    count(*) filter (
      where nullif(trim(coalesce(d.next_action, '')), '') <> ''
        and d.next_action_due_at is not null
        and d.next_action_due_at < now()
    )::integer
  into v_missing_next_action, v_overdue_next_action
  from public.deals d
  where d.outcome = 'open'
    and automation.record_affects_production_readiness('deal', d.id);

  select count(*)::integer into v_missing_qualification
  from public.leads l
  where l.lead_source in ('holiday_party_money_page','year_end_celebration_page','large_holiday_event_page')
    and l.created_at >= now() - interval '30 days'
    and (l.preferred_event_date is null or nullif(trim(l.event_timezone), '') is null)
    and automation.record_affects_production_readiness('lead', l.id);

  select status into v_mailbox_status
  from public.mailbox_sync_state order by updated_at desc limit 1;

  select count(*)::integer into v_open_incidents
  from public.production_incidents
  where status <> 'resolved' and severity in ('critical', 'high');

  select count(*)::integer into v_overdue_priority_tasks
  from public.tasks t
  where t.status in ('open', 'in_progress')
    and t.priority in ('urgent', 'high')
    and coalesce(t.source, '') <> 'launch_watchlist'
    and t.due_at < now()
    and automation.record_affects_production_readiness('task', t.id);

  select count(*)::integer into v_overdue_normal_tasks
  from public.tasks t
  where t.status in ('open', 'in_progress')
    and t.priority in ('normal', 'low')
    and coalesce(t.source, '') <> 'launch_watchlist'
    and t.due_at < now()
    and automation.record_affects_production_readiness('task', t.id);

  select status into v_final_certification_status
  from public.final_production_certifications order by created_at desc limit 1;

  v_blockers :=
    case when coalesce(v_health_status, 'missing') <> 'healthy' then 1 else 0 end +
    case when v_failed_notifications + v_stale_notifications > 0 then 1 else 0 end +
    case when v_missing_next_action + v_overdue_next_action > 0 then 1 else 0 end +
    case when v_mailbox_status = 'error' then 1 else 0 end +
    case when v_open_incidents > 0 then 1 else 0 end +
    case when v_overdue_priority_tasks > 0 then 1 else 0 end +
    case when coalesce(v_final_certification_status, 'missing') <> 'passed' then 1 else 0 end;
  v_warnings :=
    case when v_missing_qualification > 0 then 1 else 0 end +
    case when coalesce(v_mailbox_status, 'not_configured') not in ('healthy','error') then 1 else 0 end +
    case when v_overdue_normal_tasks > 0 then 1 else 0 end;
  v_status := case when v_blockers > 0 then 'blocked' when v_warnings > 0 then 'warning' else 'ready' end;

  v_checks := jsonb_build_array(
    jsonb_build_object('key','conversion_health','status',coalesce(v_health_status,'missing'),'blocking',coalesce(v_health_status,'missing') <> 'healthy'),
    jsonb_build_object('key','lead_notifications','failed',v_failed_notifications,'stale_pending',v_stale_notifications,'blocking',v_failed_notifications + v_stale_notifications > 0),
    jsonb_build_object('key','deal_next_actions','missing',v_missing_next_action,'overdue',v_overdue_next_action,'blocking',v_missing_next_action + v_overdue_next_action > 0),
    jsonb_build_object('key','holiday_qualification','missing',v_missing_qualification,'blocking',false),
    jsonb_build_object('key','mailbox_sync','status',coalesce(v_mailbox_status,'not_configured'),'blocking',v_mailbox_status = 'error'),
    jsonb_build_object('key','production_incidents','open_high_or_critical',v_open_incidents,'blocking',v_open_incidents > 0),
    jsonb_build_object('key','overdue_priority_tasks','count',v_overdue_priority_tasks,'blocking',v_overdue_priority_tasks > 0),
    jsonb_build_object('key','overdue_normal_tasks','count',v_overdue_normal_tasks,'blocking',false),
    jsonb_build_object('key','final_certification','status',coalesce(v_final_certification_status,'missing'),'blocking',coalesce(v_final_certification_status,'missing') <> 'passed')
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

-- Re-evaluate immediately on deployment so Launch Control cannot display a
-- stale snapshot until the next cron tick.
select automation.evaluate_launch_readiness();
