create table public.daily_growth_agendas (
  id uuid primary key default gen_random_uuid(),
  agenda_date date not null unique,
  summary jsonb not null default '{}'::jsonb,
  items jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.daily_growth_agendas enable row level security;
revoke all on table public.daily_growth_agendas from public,anon,authenticated;
grant select,insert,update,delete on table public.daily_growth_agendas to service_role;
create trigger daily_growth_agendas_touch_updated_at before update on public.daily_growth_agendas
for each row execute function automation.touch_updated_at();

create or replace function automation.prepare_daily_growth_agenda(p_agenda_date date default current_date)
returns jsonb language plpgsql security invoker set search_path=''
as $$
declare result jsonb;
begin
  with candidates as (
    select case t.priority when 'urgent' then 100 when 'high' then 80 when 'normal' then 50 else 30 end
      +case when t.due_at<now() then 20 else 0 end priority_score,
      'sales_task' source,t.title,coalesce(t.description,'Complete the CRM task.') detail,
      case when t.prospect_id is not null then '/office/prospects/'||t.prospect_id::text else '/office' end href,t.due_at,
      jsonb_build_object('task_id',t.id) evidence
    from public.tasks t where t.status in ('open','in_progress') and (t.due_at is null or t.due_at<now()+interval '1 day')
    union all
    select 75,'distribution','Review distribution draft: '||d.title,
      d.audience||' · '||d.channel,'/office/distribution',null,jsonb_build_object('distribution_item_id',d.id,'visitors',d.visitors,'leads',d.leads)
    from public.distribution_items d where d.status='draft'
    union all
    select case when e.status='ready_review' then 90 else 70 end,'experiment',
      case when e.status='ready_review' then 'Record experiment result: ' else 'Review experiment proposal: ' end||e.title,
      e.proposed_action,'/office/growth',e.review_due_at,jsonb_build_object('experiment_id',e.id,'status',e.status,'sample',e.latest_sample_size,'minimum',e.minimum_sample_size)
    from public.growth_experiments e where e.status in ('proposed','ready_review')
    union all
    select 65,'organic','Review organic response opportunity',coalesce(o.title,o.community,o.source_url),'/office/organic',null,
      jsonb_build_object('opportunity_id',o.id,'intent_score',o.intent_score)
    from public.organic_opportunities o where o.status in ('review','drafted')
  ), ranked as (
    select * from candidates order by priority_score desc,due_at asc nulls last limit 15
  ), packed as (
    select coalesce(jsonb_agg(jsonb_build_object('priority_score',priority_score,'priority',case when priority_score>=90 then 'urgent' when priority_score>=70 then 'high' else 'normal' end,'source',source,'title',title,'detail',detail,'href',href,'due_at',due_at,'evidence',evidence) order by priority_score desc,due_at asc nulls last),'[]'::jsonb) items,
      count(*)::int total,count(*) filter(where priority_score>=90)::int urgent,count(*) filter(where source='sales_task')::int sales,count(*) filter(where source<>'sales_task')::int growth
    from ranked
  )
  insert into public.daily_growth_agendas(agenda_date,summary,items,generated_at)
  select p_agenda_date,jsonb_build_object('total',total,'urgent',urgent,'sales',sales,'growth',growth),items,now() from packed
  on conflict(agenda_date) do update set summary=excluded.summary,items=excluded.items,generated_at=now()
  returning jsonb_build_object('prepared',true,'agenda_id',id,'summary',summary) into result;
  return result;
end; $$;

create or replace function public.prepare_daily_growth_agenda(p_agenda_date date default current_date)
returns jsonb language sql security invoker set search_path=''
as $$select automation.prepare_daily_growth_agenda(p_agenda_date);$$;
revoke all on function public.prepare_daily_growth_agenda(date) from public,anon,authenticated;
grant execute on function public.prepare_daily_growth_agenda(date) to service_role;
revoke all on function automation.prepare_daily_growth_agenda(date) from public,anon,authenticated;

do $job$
declare job_id bigint;
begin
  select jobid into job_id from cron.job where jobname='prepare-daily-growth-agenda' limit 1;
  if job_id is not null then perform cron.unschedule(job_id); end if;
  perform cron.schedule('prepare-daily-growth-agenda','0 12 * * *','select automation.prepare_daily_growth_agenda(current_date);');
end $job$;
