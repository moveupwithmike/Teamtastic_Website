-- Warm relationship intelligence. Signals create review work; they never send outreach.

alter table public.system_config
  add column if not exists warm_relationship_signals_enabled boolean not null default false,
  add column if not exists closed_lost_reactivation_days integer not null default 90
    check (closed_lost_reactivation_days between 14 and 730);

create table public.warm_relationship_signals (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  company_id uuid references public.companies(id) on delete set null,
  deal_id uuid references public.deals(id) on delete set null,
  signal_type text not null check (signal_type in (
    'job_change', 'new_people_ops_hire', 'promotion',
    'closed_lost_reactivation', 'past_champion'
  )),
  observed_at timestamptz not null default now(),
  source text not null,
  source_url text,
  evidence text not null check (length(trim(evidence)) >= 5),
  strength numeric(4,3) not null default 0.800 check (strength between 0 and 1),
  status text not null default 'new' check (status in ('new','reviewed','actioned','dismissed')),
  metadata jsonb not null default '{}'::jsonb,
  fingerprint text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index warm_relationship_signals_review_idx
  on public.warm_relationship_signals(status, strength desc, observed_at desc);
create index warm_relationship_signals_prospect_idx
  on public.warm_relationship_signals(prospect_id, observed_at desc);
create unique index tasks_warm_relationship_source_key
  on public.tasks(source) where source like 'warm_relationship:%';

alter table public.warm_relationship_signals enable row level security;
revoke all on table public.warm_relationship_signals from public, anon, authenticated;
grant select, insert, update, delete on table public.warm_relationship_signals to service_role;

create trigger warm_relationship_signals_touch_updated_at
before update on public.warm_relationship_signals
for each row execute function automation.touch_updated_at();

create or replace function automation.record_warm_relationship_signal(
  p_prospect_id uuid,
  p_signal_type text,
  p_evidence text,
  p_source text,
  p_observed_at timestamptz default now(),
  p_company_id uuid default null,
  p_deal_id uuid default null,
  p_source_url text default null,
  p_strength numeric default 0.800,
  p_metadata jsonb default '{}'::jsonb,
  p_fingerprint text default null
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_config public.system_config%rowtype;
  v_prospect public.prospects%rowtype;
  v_signal public.warm_relationship_signals%rowtype;
  v_fingerprint text;
  v_title text;
  v_due_at timestamptz;
begin
  select * into v_config from public.system_config where id=true;
  if not coalesce(v_config.warm_relationship_signals_enabled,false) then
    return jsonb_build_object('recorded',false,'reason','warm_relationship_signals_disabled');
  end if;
  if p_signal_type not in ('job_change','new_people_ops_hire','promotion','closed_lost_reactivation','past_champion') then
    return jsonb_build_object('recorded',false,'reason','unsupported_signal_type');
  end if;
  if length(trim(coalesce(p_evidence,''))) < 5 or length(trim(coalesce(p_source,''))) < 2 then
    return jsonb_build_object('recorded',false,'reason','evidence_and_source_required');
  end if;
  select * into v_prospect from public.prospects where id=p_prospect_id;
  if v_prospect.id is null then return jsonb_build_object('recorded',false,'reason','prospect_not_found'); end if;
  if p_company_id is not null and not exists(select 1 from public.companies where id=p_company_id) then
    return jsonb_build_object('recorded',false,'reason','company_not_found');
  end if;
  if p_deal_id is not null and not exists(select 1 from public.deals where id=p_deal_id and prospect_id=p_prospect_id) then
    return jsonb_build_object('recorded',false,'reason','deal_mismatch');
  end if;

  v_fingerprint:=coalesce(nullif(trim(p_fingerprint),''),md5(p_prospect_id::text||'|'||p_signal_type||'|'||coalesce(p_deal_id::text,'')||'|'||date_trunc('day',coalesce(p_observed_at,now()))::text||'|'||lower(trim(p_evidence))));
  insert into public.warm_relationship_signals(
    prospect_id,company_id,deal_id,signal_type,observed_at,source,source_url,evidence,strength,metadata,fingerprint
  ) values (
    p_prospect_id,coalesce(p_company_id,v_prospect.company_id),p_deal_id,p_signal_type,coalesce(p_observed_at,now()),trim(p_source),nullif(trim(p_source_url),''),trim(p_evidence),least(1,greatest(0,p_strength)),coalesce(p_metadata,'{}'::jsonb),v_fingerprint
  ) on conflict(fingerprint) do update set
    evidence=excluded.evidence,source_url=coalesce(excluded.source_url,public.warm_relationship_signals.source_url),
    metadata=public.warm_relationship_signals.metadata||excluded.metadata,updated_at=now()
  returning * into v_signal;

  v_title:=case p_signal_type
    when 'job_change' then 'Review job-change opportunity'
    when 'new_people_ops_hire' then 'Welcome new People Ops leader'
    when 'promotion' then 'Review promotion-triggered outreach'
    when 'closed_lost_reactivation' then 'Revisit closed-lost opportunity'
    else 'Reconnect with past champion' end;
  v_due_at:=case when p_signal_type in ('job_change','new_people_ops_hire','promotion') then now()+interval '1 day' else now()+interval '3 days' end;
  insert into public.tasks(prospect_id,title,description,status,priority,due_at,source)
  values(p_prospect_id,v_title,trim(p_evidence)||E'\n\nHuman review is required before any outreach.','open',case when p_strength>=0.85 then 'high' else 'normal' end,v_due_at,'warm_relationship:'||v_signal.id)
  on conflict(source) where source like 'warm_relationship:%' do nothing;

  if v_signal.company_id is not null then
    insert into public.signals(company_id,signal_type,source_url,observed_at,expires_at,strength,evidence,raw_data,fingerprint)
    values(v_signal.company_id,p_signal_type,p_source_url,v_signal.observed_at,v_signal.observed_at+interval '60 days',v_signal.strength,v_signal.evidence,
      jsonb_build_object('warm_relationship_signal_id',v_signal.id,'prospect_id',p_prospect_id,'provider',p_source),
      'warm:'||v_signal.fingerprint)
    on conflict(fingerprint) do nothing;
  end if;

  perform automation.score_prospect(p_prospect_id);
  insert into public.agent_log(agent_name,action,outcome,prospect_id,decision)
  values('warm-relationship-agent','record_signal','completed',p_prospect_id,jsonb_build_object('signal_id',v_signal.id,'signal_type',p_signal_type,'send_enabled',false));
  return jsonb_build_object('recorded',true,'signal_id',v_signal.id,'task_created',true,'send_enabled',false);
end;
$$;

create or replace function automation.queue_closed_lost_reactivations()
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_config public.system_config%rowtype;
  v_deal record;
  v_result jsonb;
  v_created integer:=0;
begin
  select * into v_config from public.system_config where id=true;
  if not coalesce(v_config.warm_relationship_signals_enabled,false) then
    return jsonb_build_object('queued',0,'reason','warm_relationship_signals_disabled');
  end if;
  for v_deal in
    select d.*,p.full_name,p.email from public.deals d join public.prospects p on p.id=d.prospect_id
    where d.stage='closed_lost' and d.outcome='lost' and d.lost_at<=now()-make_interval(days=>v_config.closed_lost_reactivation_days)
      and p.status not in ('suppressed','not_interested','disqualified')
      and not exists(select 1 from public.warm_relationship_signals w where w.deal_id=d.id and w.signal_type='closed_lost_reactivation')
  loop
    v_result:=automation.record_warm_relationship_signal(v_deal.prospect_id,'closed_lost_reactivation',
      'Closed-lost deal is eligible for a human reactivation review. Prior reason: '||coalesce(v_deal.lost_reason,'not recorded'),
      'teamtastic_crm',v_deal.lost_at,v_deal.company_id,v_deal.id,null,0.700,
      jsonb_build_object('lost_reason',v_deal.lost_reason,'days_since_lost',extract(day from now()-v_deal.lost_at)::integer),
      'closed-lost:'||v_deal.id::text);
    if coalesce((v_result->>'recorded')::boolean,false) then v_created:=v_created+1; end if;
  end loop;
  return jsonb_build_object('queued',v_created,'send_enabled',false);
end;
$$;

revoke all on function automation.record_warm_relationship_signal(uuid,text,text,text,timestamptz,uuid,uuid,text,numeric,jsonb,text) from public,anon,authenticated;
revoke all on function automation.queue_closed_lost_reactivations() from public,anon,authenticated;
grant execute on function automation.record_warm_relationship_signal(uuid,text,text,text,timestamptz,uuid,uuid,text,numeric,jsonb,text) to service_role;
grant execute on function automation.queue_closed_lost_reactivations() to service_role;

do $$
begin
  if exists(select 1 from cron.job where jobname='warm-relationship-reactivation') then
    perform cron.unschedule('warm-relationship-reactivation');
  end if;
  perform cron.schedule('warm-relationship-reactivation','17 13 * * *','select automation.queue_closed_lost_reactivations();');
end $$;
