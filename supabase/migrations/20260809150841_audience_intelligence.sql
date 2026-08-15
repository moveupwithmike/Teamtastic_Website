create table public.audience_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null unique,
  period_start date not null,
  period_end date not null,
  summary jsonb not null default '{}'::jsonb,
  segments jsonb not null default '{}'::jsonb,
  objections jsonb not null default '[]'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.audience_snapshots enable row level security;
revoke all on table public.audience_snapshots from public,anon,authenticated;
grant select,insert,update,delete on table public.audience_snapshots to service_role;
create trigger audience_snapshots_touch_updated_at before update on public.audience_snapshots
for each row execute function automation.touch_updated_at();

create or replace function automation.prepare_audience_snapshot(p_snapshot_date date default current_date)
returns jsonb language plpgsql security invoker set search_path=''
as $$
declare result jsonb;
begin
  with deal_signals as (
    select prospect_id,bool_or(stage<>'new_lead') progressed,bool_or(outcome='won' or stage in ('deposit_paid','event_scheduled','completed','rebooking')) converted
    from public.deals where prospect_id is not null group by prospect_id
  ), base as (
    select l.*,coalesce(ds.progressed,false) progressed,coalesce(ds.converted,false) converted
    from public.leads l left join deal_signals ds on ds.prospect_id=l.prospect_id
    where l.created_at>=p_snapshot_date-interval '90 days' and l.created_at<p_snapshot_date+interval '1 day'
  ), facet_rows as (
    select 'occasion' facet,coalesce(nullif(occasion,''),'not provided') value,count(*)::int leads,count(*) filter(where progressed)::int progressed,count(*) filter(where converted)::int converted from base group by 1,2
    union all select 'team_size',coalesce(nullif(team_size,''),'not provided'),count(*)::int,count(*) filter(where progressed)::int,count(*) filter(where converted)::int from base group by 1,2
    union all select 'budget',coalesce(nullif(budget_range,''),'not provided'),count(*)::int,count(*) filter(where progressed)::int,count(*) filter(where converted)::int from base group by 1,2
    union all select 'decision_timeline',coalesce(nullif(decision_timeline,''),'not provided'),count(*)::int,count(*) filter(where progressed)::int,count(*) filter(where converted)::int from base group by 1,2
    union all select 'time_zone',coalesce(nullif(event_timezone,''),'not provided'),count(*)::int,count(*) filter(where progressed)::int,count(*) filter(where converted)::int from base group by 1,2
    union all select 'source',coalesce(nullif(lead_source,''),'not provided'),count(*)::int,count(*) filter(where progressed)::int,count(*) filter(where converted)::int from base group by 1,2
  ), facets as (
    select jsonb_object_agg(facet,items) value from (
      select facet,jsonb_agg(jsonb_build_object('value',value,'leads',leads,'progressed',progressed,'converted',converted,'progression_rate',round(progressed::numeric/nullif(leads,0),4)) order by leads desc,value) items
      from facet_rows group by facet
    ) x
  ), objection_rows as (
    select case
      when lower(lost_reason)~'price|budget|cost|expensive' then 'budget or price'
      when lower(lost_reason)~'tim(e|ing)|date|schedule|availability' then 'timing or availability'
      when lower(lost_reason)~'competitor|vendor|alternative' then 'selected another option'
      when lower(lost_reason)~'cancel|priority|internal|approval' then 'internal priority or approval'
      else 'other or unspecified' end category,count(*)::int occurrences
    from public.deals where outcome='lost' and lost_at>=p_snapshot_date-interval '90 days' group by 1
  ), objections as (
    select coalesce(jsonb_agg(jsonb_build_object('category',category,'occurrences',occurrences) order by occurrences desc),'[]'::jsonb) value from objection_rows
  ), totals as (
    select count(*)::int leads,count(*) filter(where progressed)::int progressed,count(*) filter(where converted)::int converted,
      count(*) filter(where preferred_event_date is null)::int missing_date,count(*) filter(where event_timezone is null)::int missing_timezone,
      count(*) filter(where budget_range is null)::int missing_budget from base
  ), recs as (
    select jsonb_build_array(
      jsonb_build_object('priority',case when missing_date>0 then 'high' else 'low' end,'action','Keep event date and time zone prominent in every holiday inquiry path.','evidence',jsonb_build_object('missing_date',missing_date,'missing_timezone',missing_timezone,'leads',leads)),
      jsonb_build_object('priority',case when missing_budget*2>=greatest(leads,1) then 'medium' else 'low' end,'action','Use package ranges to help buyers self-qualify before a sales conversation.','evidence',jsonb_build_object('missing_budget',missing_budget,'leads',leads)),
      jsonb_build_object('priority','medium','action','Use the highest-volume occasion and team-size segments when prioritizing distribution drafts.','evidence',jsonb_build_object('window_days',90))
    ) value from totals
  )
  insert into public.audience_snapshots(snapshot_date,period_start,period_end,summary,segments,objections,recommendations,generated_at)
  select p_snapshot_date,p_snapshot_date-89,p_snapshot_date,
    jsonb_build_object('leads',t.leads,'progressed',t.progressed,'converted',t.converted,'progression_rate',round(t.progressed::numeric/nullif(t.leads,0),4),'conversion_rate',round(t.converted::numeric/nullif(t.leads,0),4),'window_days',90),
    coalesce(f.value,'{}'::jsonb),o.value,r.value,now()
  from totals t cross join facets f cross join objections o cross join recs r
  on conflict(snapshot_date) do update set summary=excluded.summary,segments=excluded.segments,objections=excluded.objections,recommendations=excluded.recommendations,generated_at=now()
  returning jsonb_build_object('prepared',true,'snapshot_id',id,'summary',summary) into result;
  return result;
end; $$;

create or replace function public.prepare_audience_snapshot(p_snapshot_date date default current_date)
returns jsonb language sql security invoker set search_path=''
as $$select automation.prepare_audience_snapshot(p_snapshot_date);$$;
revoke all on function public.prepare_audience_snapshot(date) from public,anon,authenticated;
grant execute on function public.prepare_audience_snapshot(date) to service_role;
revoke all on function automation.prepare_audience_snapshot(date) from public,anon,authenticated;

do $job$
declare job_id bigint;
begin
  select jobid into job_id from cron.job where jobname='prepare-audience-intelligence' limit 1;
  if job_id is not null then perform cron.unschedule(job_id); end if;
  perform cron.schedule('prepare-audience-intelligence','50 11 * * *','select automation.prepare_audience_snapshot(current_date);');
end $job$;
