-- Phase 7: campaign attribution from first-party visit through revenue.

create table public.campaign_ad_spend (
  id uuid primary key default gen_random_uuid(),
  spend_date date not null,
  utm_source text not null,
  utm_medium text not null default 'paid',
  utm_campaign text not null default 'unattributed',
  landing_page text not null default 'all',
  spend_cents integer not null check (spend_cents >= 0),
  currency text not null default 'usd' check (currency ~ '^[a-z]{3}$'),
  notes text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(spend_date,utm_source,utm_medium,utm_campaign,landing_page)
);
create index campaign_ad_spend_lookup_idx on public.campaign_ad_spend(spend_date,utm_source,utm_campaign);
alter table public.campaign_ad_spend enable row level security;
revoke all on table public.campaign_ad_spend from public,anon,authenticated;
grant select,insert,update,delete on table public.campaign_ad_spend to service_role;
create trigger campaign_ad_spend_touch_updated_at before update on public.campaign_ad_spend
for each row execute function automation.touch_updated_at();

create or replace function public.normalize_campaign_value(p_kind text,p_value text)
returns text language sql immutable security invoker set search_path=''
as $$
  select case
    when nullif(trim(p_value),'') is null then case when p_kind='source' then 'direct' when p_kind='medium' then 'none' else 'unattributed' end
    when p_kind='source' and lower(trim(p_value)) in ('fb','facebook','instagram','ig','meta') then 'meta'
    when p_kind='source' and lower(trim(p_value)) in ('googleads','google_ads','adwords','google') then 'google'
    when p_kind='source' and lower(trim(p_value)) in ('linkedin.com','linked_in','linkedin') then 'linkedin'
    when p_kind='medium' and lower(trim(p_value)) in ('cpc','ppc','paid-social','paid_social','paid') then 'paid'
    when p_kind='medium' and lower(trim(p_value)) in ('email','newsletter') then 'email'
    else trim(both '-' from regexp_replace(lower(trim(p_value)),'[^a-z0-9]+','-','g'))
  end;
$$;
revoke execute on function public.normalize_campaign_value(text,text) from public,anon,authenticated;
grant execute on function public.normalize_campaign_value(text,text) to service_role;

create or replace function public.get_lead_source_roi(p_days integer default 30)
returns jsonb language sql stable security invoker set search_path=''
as $$
with bounds as (
  select now()-make_interval(days=>least(greatest(p_days,1),365)) since
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
  from public.leads l,bounds where l.created_at>=since and coalesce((l.context->>'synthetic_test')::boolean,false)=false
), deal_signals as (
  select prospect_id,bool_or(stage<>'new_lead' or call_outcome='qualified') qualified,
    count(*)::int deals,count(*) filter(where call_completed_at is not null)::int discovery_calls
  from public.deals where prospect_id is not null group by prospect_id
), proposal_signals as (
  select d.prospect_id,count(p.id)::int proposals,
    count(p.id) filter(where p.status in ('sent','approved'))::int proposals_sent
  from public.proposals p join public.deals d on d.id=p.deal_id group by d.prospect_id
), payment_signals as (
  select d.prospect_id,count(dp.id) filter(where dp.payment_kind='deposit')::int deposits,
    coalesce(sum(dp.amount),0)::numeric revenue
  from public.deal_payments dp join public.deals d on d.id=dp.deal_id group by d.prospect_id
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
  'summary',(select to_jsonb(t)||jsonb_build_object('roas',case when spend_cents>0 then round(revenue/(spend_cents::numeric/100),2) end) from totals t),
  'campaigns',coalesce((select jsonb_agg(to_jsonb(m) order by m.revenue desc,m.qualified_leads desc,m.leads desc,m.visitors desc) from metrics m),'[]'::jsonb));
$$;
revoke execute on function public.get_lead_source_roi(integer) from public,anon,authenticated;
grant execute on function public.get_lead_source_roi(integer) to service_role;
