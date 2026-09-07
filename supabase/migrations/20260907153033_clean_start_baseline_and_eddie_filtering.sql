-- Establish a recoverable go-live boundary for the Sales Engine. Existing QA
-- records remain in place for audit, but authoritative reporting treats them
-- as non-production. No customer, lead, or history row is deleted.

alter table public.system_config
  add column if not exists sales_reporting_since timestamptz;

comment on column public.system_config.sales_reporting_since is
  'Owner-approved boundary after which production-classified sales activity appears in Eddie and sales reports.';

update public.system_config
set sales_reporting_since = clock_timestamp(),
    updated_at = clock_timestamp(),
    updated_by = 'michael:approved-clean-start-2026-09-07'
where id = true;

-- Reclassify only records that currently claim to be production. Existing
-- certification, test_qa, and research_seed classifications retain their more
-- specific provenance.
insert into public.production_record_classifications(
  record_type, record_id, classification, reason, actor, evidence, correlation_id
)
select
  'lead', status.record_id, 'test_qa',
  'Owner confirmed every lead predating the Sales Engine go-live baseline is test data.',
  'Michael Accendo',
  jsonb_build_object('clean_start', true, 'approved_on', '2026-09-07', 'prior_classification', status.classification),
  'clean-start-2026-09-07:lead:' || status.record_id::text
from public.production_record_classification_status status
where status.record_type = 'lead'
  and status.classification = 'production';

insert into public.production_record_classifications(
  record_type, record_id, classification, reason, actor, evidence, correlation_id
)
select distinct
  'prospect', status.record_id, 'test_qa',
  'Owner confirmed the pre-launch prospect linked to test sales activity is not a live prospect.',
  'Michael Accendo',
  jsonb_build_object('clean_start', true, 'approved_on', '2026-09-07', 'prior_classification', status.classification),
  'clean-start-2026-09-07:prospect:' || status.record_id::text
from public.production_record_classification_status status
where status.record_type = 'prospect'
  and status.classification = 'production'
  and (
    exists(select 1 from public.leads lead where lead.prospect_id = status.record_id)
    or exists(select 1 from public.deals deal where deal.prospect_id = status.record_id)
  );

insert into public.production_record_classifications(
  record_type, record_id, classification, reason, actor, evidence, correlation_id
)
select
  status.record_type, status.record_id, 'test_qa',
  'Owner confirmed this pre-launch sales record belongs to test or rehearsal activity.',
  'Michael Accendo',
  jsonb_build_object('clean_start', true, 'approved_on', '2026-09-07', 'prior_classification', status.classification),
  'clean-start-2026-09-07:' || status.record_type || ':' || status.record_id::text
from public.production_record_classification_status status
where status.record_type in ('deal', 'client', 'booking')
  and status.classification = 'production';

insert into public.production_record_classifications(
  record_type, record_id, classification, reason, actor, evidence, correlation_id
)
select
  'task', status.record_id, 'test_qa',
  'Owner confirmed this pre-launch sales task is attached to test or rehearsal activity.',
  'Michael Accendo',
  jsonb_build_object('clean_start', true, 'approved_on', '2026-09-07', 'prior_classification', status.classification),
  'clean-start-2026-09-07:task:' || status.record_id::text
from public.production_record_classification_status status
join public.tasks task on task.id = status.record_id
join public.production_record_classification_status prospect_status
  on prospect_status.record_type = 'prospect'
 and prospect_status.record_id = task.prospect_id
where status.record_type = 'task'
  and status.classification = 'production'
  and prospect_status.classification <> 'production';

-- Close the fake pipeline without deleting its audit history.
update public.deals
set stage = 'closed_lost',
    outcome = 'lost',
    lost_at = coalesce(lost_at, clock_timestamp()),
    lost_reason = coalesce(nullif(trim(lost_reason), ''), 'Closed during owner-approved clean-start reset; non-production test record.'),
    next_action = null,
    next_action_due_at = null,
    stage_source = 'clean_start_reset',
    stage_source_id = 'owner-approved-2026-09-07',
    updated_at = clock_timestamp()
where outcome = 'open';

-- Close the 16 historical daily launch reminders and the intentionally
-- disabled Reddit permission reminder. The Reddit approval flag remains off.
update public.tasks
set status = 'completed', updated_at = clock_timestamp()
where source = 'launch_watchlist'
  and status in ('open', 'in_progress');

update public.tasks
set status = 'cancelled',
    description = concat_ws(E'\n\n', nullif(trim(description), ''), 'Closed during the owner-approved clean start. Reddit commercial collection remains disabled until separately approved.'),
    updated_at = clock_timestamp()
where fingerprint = 'organic-reddit-commercial-approval-followup'
  and status in ('open', 'in_progress');

-- Make the shared ROI report honor the same boundary. This keeps both Eddie
-- and the Office dashboards from mixing rehearsal traffic or leads into the
-- new live baseline.
create or replace function public.get_lead_source_roi(p_days integer default 30)
returns jsonb language sql stable security invoker set search_path=''
as $$
with bounds as (
  select greatest(
    now()-make_interval(days=>least(greatest(p_days,1),365)),
    coalesce((select sales_reporting_since from public.system_config where id=true), '-infinity'::timestamptz)
  ) since
), visits as (
  select public.normalize_campaign_value('source',utm_source) source,
    public.normalize_campaign_value('medium',utm_medium) medium,
    public.normalize_campaign_value('campaign',utm_campaign) campaign,
    coalesce(nullif(landing_page,''),'Direct / unknown') landing_page,
    count(distinct session_id)::int visitors,
    count(distinct session_id) filter(where event_name='page_engaged')::int engaged_visitors
  from public.funnel_events,bounds where occurred_at>=since
  group by 1,2,3,4
), lead_rows as (
  select l.*,public.normalize_campaign_value('source',l.utm_source) source,
    public.normalize_campaign_value('medium',l.utm_medium) medium,
    public.normalize_campaign_value('campaign',l.utm_campaign) campaign,
    coalesce(nullif(l.landing_page,''),'Direct / unknown') attributed_page,
    row_number() over(partition by l.prospect_id order by l.created_at,l.id) prospect_rank
  from public.leads l
  join public.production_record_classification_status ls
    on ls.record_type='lead' and ls.record_id=l.id and ls.classification='production'
  cross join bounds
  where l.created_at>=since and coalesce((l.context->>'synthetic_test')::boolean,false)=false
), deal_signals as (
  select d.prospect_id,bool_or(d.stage<>'new_lead' or d.call_outcome='qualified') qualified,
    count(*)::int deals,count(*) filter(where d.call_completed_at is not null)::int discovery_calls
  from public.deals d
  join public.production_record_classification_status ds
    on ds.record_type='deal' and ds.record_id=d.id and ds.classification='production'
  where d.prospect_id is not null group by d.prospect_id
), proposal_signals as (
  select d.prospect_id,count(p.id)::int proposals,
    count(p.id) filter(where p.status in ('sent','approved'))::int proposals_sent
  from public.proposals p
  join public.deals d on d.id=p.deal_id
  join public.production_record_classification_status ds
    on ds.record_type='deal' and ds.record_id=d.id and ds.classification='production'
  group by d.prospect_id
), payment_signals as (
  select d.prospect_id,count(dp.id) filter(where dp.payment_kind='deposit')::int deposits,
    coalesce(sum(dp.amount),0)::numeric revenue
  from public.deal_payments dp
  join public.deals d on d.id=dp.deal_id
  join public.production_record_classification_status ds
    on ds.record_type='deal' and ds.record_id=d.id and ds.classification='production'
  cross join bounds
  where dp.paid_at>=bounds.since
  group by d.prospect_id
), prospect_signals as (
  select d.prospect_id,d.qualified,d.deals,d.discovery_calls,
    coalesce(p.proposals,0) proposals,coalesce(p.proposals_sent,0) proposals_sent,
    coalesce(pay.deposits,0) deposits,coalesce(pay.revenue,0) revenue
  from deal_signals d left join proposal_signals p using(prospect_id) left join payment_signals pay using(prospect_id)
), leads as (
  select source,medium,campaign,attributed_page landing_page,
    count(*)::int leads,
    count(*) filter(where coalesce(lead_score,0)>=60 or coalesce(ps.qualified,false))::int qualified_leads,
    coalesce(sum(case when prospect_rank=1 then ps.deals else 0 end),0)::int deals,
    coalesce(sum(case when prospect_rank=1 then ps.discovery_calls else 0 end),0)::int discovery_calls,
    coalesce(sum(case when prospect_rank=1 then ps.proposals else 0 end),0)::int proposals,
    coalesce(sum(case when prospect_rank=1 then ps.proposals_sent else 0 end),0)::int proposals_sent,
    coalesce(sum(case when prospect_rank=1 then ps.deposits else 0 end),0)::int deposits,
    coalesce(sum(case when prospect_rank=1 then ps.revenue else 0 end),0)::numeric revenue
  from lead_rows l left join prospect_signals ps on ps.prospect_id=l.prospect_id
  group by 1,2,3,4
), costs as (
  select public.normalize_campaign_value('source',utm_source) source,
    public.normalize_campaign_value('medium',utm_medium) medium,
    public.normalize_campaign_value('campaign',utm_campaign) campaign,
    landing_page,coalesce(sum(spend_cents),0)::bigint spend_cents
  from public.campaign_ad_spend,bounds where spend_date>=since::date group by 1,2,3,4
), keys as (
  select source,medium,campaign,landing_page from visits union select source,medium,campaign,landing_page from leads
  union select source,medium,campaign,landing_page from costs
), rows as (
  select k.*,coalesce(v.visitors,0) visitors,coalesce(v.engaged_visitors,0) engaged_visitors,
    coalesce(l.leads,0) leads,coalesce(l.qualified_leads,0) qualified_leads,coalesce(l.deals,0) deals,
    coalesce(l.discovery_calls,0) discovery_calls,coalesce(l.proposals,0) proposals,coalesce(l.proposals_sent,0) proposals_sent,
    coalesce(l.deposits,0) deposits,coalesce(l.revenue,0) revenue,coalesce(c.spend_cents,0) spend_cents
  from keys k left join visits v using(source,medium,campaign,landing_page)
  left join leads l using(source,medium,campaign,landing_page) left join costs c using(source,medium,campaign,landing_page)
), metrics as (
  select *,round(leads::numeric/nullif(visitors,0),4) visitor_to_lead_rate,
    round(qualified_leads::numeric/nullif(leads,0),4) qualification_rate,
    round(discovery_calls::numeric/nullif(leads,0),4) call_rate,
    round(proposals_sent::numeric/nullif(leads,0),4) proposal_rate,
    round(deposits::numeric/nullif(leads,0),4) deposit_rate,
    case when spend_cents>0 then round(spend_cents::numeric/100/nullif(leads,0),2) end cost_per_lead,
    case when spend_cents>0 then round(spend_cents::numeric/100/nullif(qualified_leads,0),2) end cost_per_qualified_lead,
    case when spend_cents>0 then round(revenue/(spend_cents::numeric/100),2) end roas,
    (visitors>=10 and qualified_leads=0) traffic_without_qualified_leads
  from rows
), totals as (
  select coalesce(sum(visitors),0)::int visitors,coalesce(sum(leads),0)::int leads,
    coalesce(sum(qualified_leads),0)::int qualified_leads,coalesce(sum(discovery_calls),0)::int discovery_calls,
    coalesce(sum(proposals_sent),0)::int proposals_sent,coalesce(sum(deposits),0)::int deposits,
    coalesce(sum(revenue),0)::numeric revenue,coalesce(sum(spend_cents),0)::bigint spend_cents,
    count(*) filter(where traffic_without_qualified_leads)::int waste_flags from metrics
)
select jsonb_build_object('days',least(greatest(p_days,1),365),'generated_at',now(),
  'reporting_since',(select since from bounds),
  'summary',(select to_jsonb(t)||jsonb_build_object('roas',case when spend_cents>0 then round(revenue/(spend_cents::numeric/100),2) end) from totals t),
  'campaigns',coalesce((select jsonb_agg(to_jsonb(m) order by m.revenue desc,m.qualified_leads desc,m.leads desc,m.visitors desc) from metrics m),'[]'::jsonb));
$$;

revoke execute on function public.get_lead_source_roi(integer) from public,anon,authenticated;
grant execute on function public.get_lead_source_roi(integer) to service_role;

-- Launch Control now owns one durable current reminder. Repeated checks update
-- that row rather than creating a new task every day.
create or replace function automation.evaluate_launch_readiness()
returns jsonb
language plpgsql
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

  select status into v_health_status from public.conversion_health_runs order by started_at desc limit 1;
  select count(*)::integer into v_failed_notifications from public.notification_deliveries
    where status = 'failed' and created_at >= now() - interval '30 days';
  select count(*)::integer into v_stale_notifications from public.notification_deliveries
    where status = 'pending' and created_at >= now() - interval '30 days' and created_at < now() - interval '10 minutes';

  select
    count(*) filter(where nullif(trim(coalesce(d.next_action, '')), '') is null or d.next_action_due_at is null)::integer,
    count(*) filter(where nullif(trim(coalesce(d.next_action, '')), '') <> '' and d.next_action_due_at is not null and d.next_action_due_at < now())::integer
  into v_missing_next_action, v_overdue_next_action
  from public.deals d
  where d.outcome = 'open' and automation.record_affects_production_readiness('deal', d.id);

  select count(*)::integer into v_missing_qualification from public.leads l
  where l.lead_source in ('holiday_party_money_page','year_end_celebration_page','large_holiday_event_page')
    and l.created_at >= now() - interval '30 days'
    and (l.preferred_event_date is null or nullif(trim(l.event_timezone), '') is null)
    and automation.record_affects_production_readiness('lead', l.id);

  select status into v_mailbox_status from public.mailbox_sync_state order by updated_at desc limit 1;
  select count(*)::integer into v_open_incidents from public.production_incidents
    where status <> 'resolved' and severity in ('critical', 'high');
  select count(*)::integer into v_overdue_priority_tasks from public.tasks t
  where t.status in ('open','in_progress') and t.priority in ('urgent','high')
    and coalesce(t.source,'') <> 'launch_watchlist' and t.due_at < now()
    and automation.record_affects_production_readiness('task', t.id);
  select count(*)::integer into v_overdue_normal_tasks from public.tasks t
  where t.status in ('open','in_progress') and t.priority in ('normal','low')
    and coalesce(t.source,'') <> 'launch_watchlist' and t.due_at < now()
    and automation.record_affects_production_readiness('task', t.id);
  select status into v_final_certification_status from public.final_production_certifications order by created_at desc limit 1;

  v_blockers :=
    case when coalesce(v_health_status,'missing') <> 'healthy' then 1 else 0 end +
    case when v_failed_notifications + v_stale_notifications > 0 then 1 else 0 end +
    case when v_missing_next_action + v_overdue_next_action > 0 then 1 else 0 end +
    case when v_mailbox_status = 'error' then 1 else 0 end +
    case when v_open_incidents > 0 then 1 else 0 end +
    case when v_overdue_priority_tasks > 0 then 1 else 0 end +
    case when coalesce(v_final_certification_status,'missing') <> 'passed' then 1 else 0 end;
  v_warnings :=
    case when v_missing_qualification > 0 then 1 else 0 end +
    case when coalesce(v_mailbox_status,'not_configured') not in ('healthy','error') then 1 else 0 end +
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
  on conflict(snapshot_bucket) do update set status=excluded.status,blocker_count=excluded.blocker_count,
    warning_count=excluded.warning_count,checks=excluded.checks,created_at=now();

  update public.tasks set status='completed',updated_at=now()
  where source='launch_watchlist' and fingerprint <> 'launch:readiness:current'
    and status in ('open','in_progress');

  if v_status = 'blocked' then
    insert into public.tasks(title,description,priority,due_at,source,fingerprint)
    values('B2B launch readiness status',
      'Launch Control currently has ' || v_blockers || ' blocking condition(s). Open /office/launch to review the exact current status.',
      'urgent',now(),'launch_watchlist','launch:readiness:current')
    on conflict(fingerprint) where fingerprint is not null do update set
      description=excluded.description,priority='urgent',due_at=now(),
      status=case when public.tasks.status='completed' then 'open' else public.tasks.status end,updated_at=now();
  else
    update public.tasks set status='completed',updated_at=now()
    where source='launch_watchlist' and fingerprint='launch:readiness:current'
      and status in ('open','in_progress');
  end if;

  return jsonb_build_object('status',v_status,'blockers',v_blockers,'warnings',v_warnings,'checks',v_checks);
end;
$$;

select automation.evaluate_launch_readiness();
