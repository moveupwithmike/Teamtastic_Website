-- First-party growth brief. Generates internal recommendations only.
alter table public.system_config
  add column if not exists growth_brief_enabled boolean not null default true;

create table public.growth_briefs (
  id uuid primary key default gen_random_uuid(),
  brief_date date not null unique,
  period_start date not null,
  period_end date not null,
  status text not null default 'review' check (status in ('review','accepted','archived')),
  summary jsonb not null default '{}'::jsonb,
  segments jsonb not null default '[]'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.growth_briefs enable row level security;
revoke all on table public.growth_briefs from public, anon, authenticated;
grant select, insert, update, delete on table public.growth_briefs to service_role;

drop trigger if exists growth_briefs_touch_updated_at on public.growth_briefs;
create trigger growth_briefs_touch_updated_at before update on public.growth_briefs
for each row execute function automation.touch_updated_at();

create or replace function automation.prepare_growth_brief(p_brief_date date default current_date)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  enabled boolean := false;
  result jsonb;
begin
  select growth_brief_enabled into enabled from public.system_config where id=true;
  if not coalesce(enabled,false) then
    return jsonb_build_object('prepared',false,'reason','growth_brief_disabled');
  end if;

  with payment_totals as (
    select d.prospect_id, count(distinct dp.id)::int paid_count,
      coalesce(sum(dp.amount),0)::numeric revenue
    from public.deals d join public.deal_payments dp on dp.deal_id=d.id
    where dp.paid_at >= p_brief_date - interval '30 days'
      and dp.paid_at < p_brief_date + interval '1 day'
    group by d.prospect_id
  ), deal_signals as (
    select prospect_id, true has_deal,
      bool_or(outcome='won' or stage in ('deposit_paid','event_scheduled','completed','rebooking')) converted,
      bool_or(stage<>'new_lead') progressed
    from public.deals where prospect_id is not null group by prospect_id
  ), lead_funnel as (
    select l.id, coalesce(nullif(l.landing_page,''),'Direct / unknown') landing_page,
      coalesce(nullif(l.utm_source,''),'direct') utm_source,
      coalesce(nullif(l.utm_campaign,''),'unattributed') utm_campaign,
      (coalesce(l.lead_score,0)>=60 or coalesce(ds.progressed,false)) qualified,
      coalesce(ds.has_deal,false) has_deal, (coalesce(ds.converted,false) or pt.paid_count>0) converted,
      coalesce(pt.revenue,0) revenue
    from public.leads l
    left join deal_signals ds on ds.prospect_id=l.prospect_id
    left join payment_totals pt on pt.prospect_id=l.prospect_id
    where l.created_at >= p_brief_date - interval '30 days'
      and l.created_at < p_brief_date + interval '1 day'
  ), grouped as (
    select landing_page,utm_source,utm_campaign,count(distinct id)::int leads,
      count(distinct id) filter(where qualified)::int qualified_leads,
      count(distinct id) filter(where has_deal)::int deals,
      count(distinct id) filter(where converted)::int conversions,
      coalesce(sum(revenue),0)::numeric revenue
    from lead_funnel group by landing_page,utm_source,utm_campaign
  ), ranked as (
    select *, round(qualified_leads::numeric/nullif(leads,0),4) qualification_rate,
      round(conversions::numeric/nullif(leads,0),4) conversion_rate
    from grouped
  ), totals as (
    select coalesce(sum(leads),0)::int leads,coalesce(sum(qualified_leads),0)::int qualified_leads,
      coalesce(sum(deals),0)::int deals,coalesce(sum(conversions),0)::int conversions,
      coalesce(sum(revenue),0)::numeric revenue from ranked
  ), recommendations as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'priority', case when leads>=5 and qualified_leads=0 then 'high' when conversions>0 then 'medium' else 'low' end,
      'segment', landing_page || ' · ' || utm_source || ' · ' || utm_campaign,
      'action', case
        when leads < 3 then 'Collect more data before changing this campaign.'
        when qualified_leads=0 then 'Review targeting and the lead promise; traffic is not becoming qualified pipeline.'
        when conversions=0 then 'Review the page-to-sales handoff and next actions for these qualified leads.'
        else 'Preserve this path and test one controlled campaign or headline variant.' end,
      'evidence',jsonb_build_object('leads',leads,'qualified_leads',qualified_leads,'conversions',conversions,'revenue',revenue)
    ) order by conversions desc,revenue desc,qualified_leads desc,leads desc),'[]'::jsonb) value from ranked
  )
  insert into public.growth_briefs(brief_date,period_start,period_end,summary,segments,recommendations,generated_at)
  select p_brief_date,p_brief_date-29,p_brief_date,
    jsonb_build_object('leads',t.leads,'qualified_leads',t.qualified_leads,'deals',t.deals,'conversions',t.conversions,'revenue',t.revenue,'window_days',30),
    coalesce((select jsonb_agg(to_jsonb(r) order by r.conversions desc,r.revenue desc,r.qualified_leads desc,r.leads desc) from ranked r),'[]'::jsonb),
    recommendations.value,now() from totals t cross join recommendations
  on conflict(brief_date) do update set period_start=excluded.period_start,period_end=excluded.period_end,
    summary=excluded.summary,segments=excluded.segments,recommendations=excluded.recommendations,generated_at=now()
  returning jsonb_build_object('prepared',true,'brief_id',id,'brief_date',brief_date,'summary',summary) into result;

  insert into public.agent_log(agent_name,action,outcome,decision)
  values('growth-brief','prepare_daily_growth_brief','completed',result || jsonb_build_object('automatic_changes',false));
  return result || jsonb_build_object('automatic_changes',false);
end;
$$;

revoke all on function automation.prepare_growth_brief(date) from public,anon,authenticated;
grant execute on function automation.prepare_growth_brief(date) to service_role;

create or replace function public.prepare_growth_brief(p_brief_date date default current_date)
returns jsonb language sql security invoker set search_path=''
as $$ select automation.prepare_growth_brief(p_brief_date); $$;
revoke all on function public.prepare_growth_brief(date) from public,anon,authenticated;
grant execute on function public.prepare_growth_brief(date) to service_role;

do $$
declare job_id bigint;
begin
  select jobid into job_id from cron.job where jobname='prepare-daily-growth-brief' limit 1;
  if job_id is not null then perform cron.unschedule(job_id); end if;
  perform cron.schedule('prepare-daily-growth-brief','20 11 * * *',
    'select automation.prepare_growth_brief(current_date);');
end $$;
