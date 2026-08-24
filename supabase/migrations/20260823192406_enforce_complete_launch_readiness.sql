-- Keep recovered automation failures and their generated tasks from remaining
-- permanently open after a later successful run of the same operation.
create or replace function automation.resolve_recovered_automation_incidents()
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_resolved integer := 0;
begin
  update public.production_incidents incident
  set status = 'resolved',
      resolved_at = now(),
      resolution = 'Resolved automatically after a later successful automation run.',
      updated_at = now()
  from public.agent_log failed_run
  where incident.status <> 'resolved'
    and incident.source_type = 'agent_log'
    and failed_run.id::text = incident.source_id
    and exists (
      select 1
      from public.agent_log recovered_run
      where recovered_run.agent_name = failed_run.agent_name
        and recovered_run.action = failed_run.action
        and recovered_run.outcome = 'completed'
        and recovered_run.created_at > (
          select max(later_failure.created_at)
          from public.agent_log later_failure
          where later_failure.agent_name = failed_run.agent_name
            and later_failure.action = failed_run.action
            and later_failure.outcome in ('failed', 'escalated')
        )
    );
  get diagnostics v_resolved = row_count;

  update public.tasks task
  set status = 'completed', updated_at = now()
  where task.status in ('open', 'in_progress')
    and task.source = 'production_incident'
    and exists (
      select 1
      from public.production_incidents incident
      where incident.status = 'resolved'
        and task.fingerprint = 'incident:task:' || incident.id::text
    );

  return v_resolved;
end;
$$;

revoke all on function automation.resolve_recovered_automation_incidents() from public, anon, authenticated;

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

  select count(*)::integer into v_open_incidents
  from public.production_incidents
  where status <> 'resolved' and severity in ('critical', 'high');

  select count(*)::integer into v_overdue_priority_tasks
  from public.tasks
  where status in ('open', 'in_progress')
    and priority in ('urgent', 'high')
    and coalesce(source, '') <> 'launch_watchlist'
    and due_at < now();

  select count(*)::integer into v_overdue_normal_tasks
  from public.tasks
  where status in ('open', 'in_progress')
    and priority in ('normal', 'low')
    and coalesce(source, '') <> 'launch_watchlist'
    and due_at < now();

  select status into v_final_certification_status
  from public.final_production_certifications order by created_at desc limit 1;

  v_blockers :=
    case when coalesce(v_health_status, 'missing') <> 'healthy' then 1 else 0 end +
    case when v_failed_notifications + v_stale_notifications > 0 then 1 else 0 end +
    case when v_missing_next_action > 0 then 1 else 0 end +
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
    jsonb_build_object('key','deal_next_actions','missing',v_missing_next_action,'blocking',v_missing_next_action > 0),
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

revoke all on function automation.evaluate_launch_readiness() from public, anon, authenticated;

-- Re-evaluate immediately on deployment so Launch Control cannot display a
-- stale green snapshot until the next 15-minute cron tick.
select automation.evaluate_launch_readiness();
