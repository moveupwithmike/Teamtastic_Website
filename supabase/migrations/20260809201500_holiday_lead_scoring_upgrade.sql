-- Phase 8: transparent, outcome-measured scoring for inbound event leads.

alter table public.leads
  add column if not exists lead_score_reasons jsonb not null default '[]'::jsonb,
  add column if not exists lead_score_version text,
  add column if not exists lead_score_override integer check(lead_score_override between 0 and 100),
  add column if not exists lead_score_override_reason text,
  add column if not exists lead_score_overridden_by text,
  add column if not exists lead_score_overridden_at timestamptz,
  add column if not exists lead_scored_at timestamptz;

create table public.lead_score_history (
  id bigint generated always as identity primary key,
  lead_id uuid not null references public.leads(id) on delete cascade,
  calculated_score integer not null check(calculated_score between 0 and 100),
  final_score integer not null check(final_score between 0 and 100),
  reasons jsonb not null,
  scoring_version text not null,
  override_applied boolean not null default false,
  scored_at timestamptz not null default now()
);
create index lead_score_history_lead_idx on public.lead_score_history(lead_id,scored_at desc);
alter table public.lead_score_history enable row level security;
revoke all on table public.lead_score_history from public,anon,authenticated;
revoke all on sequence public.lead_score_history_id_seq from public,anon,authenticated;
grant select,insert,delete on table public.lead_score_history to service_role;
grant usage,select on sequence public.lead_score_history_id_seq to service_role;

create or replace function public.score_event_lead(p_lead_id uuid)
returns jsonb language plpgsql security invoker set search_path=''
as $$
declare l public.leads%rowtype; v_score integer:=0; v_final integer; v_reasons jsonb:='[]'::jsonb;
  v_days integer; v_engagement integer:=0; v_deposit boolean:=false; v_points integer; v_version constant text:='event-v2';
begin
  select * into l from public.leads where id=p_lead_id for update;
  if l.id is null then return jsonb_build_object('scored',false,'reason','lead_not_found'); end if;
  if coalesce((l.context->>'synthetic_test')::boolean,false) then return jsonb_build_object('scored',false,'reason','synthetic_lead'); end if;

  if l.preferred_event_date is not null then
    v_days:=l.preferred_event_date-current_date;
    v_points:=case when v_days<0 then 0 when v_days<=14 then 20 when v_days<=30 then 18 when v_days<=60 then 14 when v_days<=120 then 8 else 3 end;
    v_score:=v_score+v_points; v_reasons:=v_reasons||jsonb_build_array(jsonb_build_object('component','event_urgency','points',v_points,'detail',case when v_days<0 then 'Requested date has passed' else v_days||' days until requested event' end));
  else v_reasons:=v_reasons||jsonb_build_array(jsonb_build_object('component','event_urgency','points',0,'detail','Event date missing')); end if;

  v_points:=case when coalesce(l.team_size,'')~*'150\+|150-300|300\+' then 18 when coalesce(l.team_size,'')~*'50-150|75-|81-|200' then 14 when coalesce(l.team_size,'')~*'15-50|25-74|31-80' then 9 when l.team_size is not null then 4 else 0 end;
  v_score:=v_score+v_points; v_reasons:=v_reasons||jsonb_build_array(jsonb_build_object('component','team_size','points',v_points,'detail',coalesce(l.team_size,'Team size missing')));

  v_points:=case when coalesce(l.budget_range,'')~*'5000|5,000' then 18 when coalesce(l.budget_range,'')~*'2500-5000|2,500.*5,000|2000.*5000' then 14 when coalesce(l.budget_range,'')~*'1000-2500|1,000.*2,500' then 9 when coalesce(l.budget_range,'')~*'under-1000' then 3 when l.budget_range is not null then 5 else 0 end;
  v_score:=v_score+v_points; v_reasons:=v_reasons||jsonb_build_array(jsonb_build_object('component','budget_package_fit','points',v_points,'detail',concat_ws(' · ',l.budget_range,l.package_interest)));

  v_points:=case l.decision_timeline when 'this-week' then 15 when '1-2-weeks' then 12 when 'this-month' then 8 when 'researching' then 3 else 0 end;
  v_score:=v_score+v_points; v_reasons:=v_reasons||jsonb_build_array(jsonb_build_object('component','decision_timeline','points',v_points,'detail',coalesce(l.decision_timeline,'Decision timing missing')));

  v_points:=case when l.lead_source='large_holiday_event_page' or l.package_interest='large-event-production' or coalesce(l.team_size,'')~*'150\+|150-300|300\+' then 10 else 0 end;
  v_score:=v_score+v_points; v_reasons:=v_reasons||jsonb_build_array(jsonb_build_object('component','large_event_complexity','points',v_points,'detail',case when v_points>0 then 'Large-group production or complex event signal' else 'Standard event complexity' end));

  select count(distinct event_name) into v_engagement from public.funnel_events where submission_id=l.submission_id;
  v_points:=least(10,v_engagement*2); v_score:=v_score+v_points;
  v_reasons:=v_reasons||jsonb_build_array(jsonb_build_object('component','funnel_engagement','points',v_points,'detail',v_engagement||' distinct first-party actions'));

  select exists(select 1 from public.stripe_events s where (s.lead_id=l.id or s.submission_id=l.submission_id) and s.payment_status='paid') into v_deposit;
  v_points:=case when v_deposit then 25 else 0 end; v_score:=least(100,v_score+v_points);
  v_reasons:=v_reasons||jsonb_build_array(jsonb_build_object('component','deposit_activity','points',v_points,'detail',case when v_deposit then 'Payment or deposit received' else 'No paid deposit yet' end));

  v_final:=coalesce(l.lead_score_override,v_score);
  if l.lead_score is distinct from v_final or l.lead_score_reasons is distinct from v_reasons or l.lead_score_version is distinct from v_version then
    update public.leads set lead_score=v_final,lead_score_reasons=v_reasons,lead_score_version=v_version,lead_scored_at=now() where id=l.id;
    insert into public.lead_score_history(lead_id,calculated_score,final_score,reasons,scoring_version,override_applied) values(l.id,v_score,v_final,v_reasons,v_version,l.lead_score_override is not null);
  end if;
  return jsonb_build_object('scored',true,'lead_id',l.id,'calculated_score',v_score,'final_score',v_final,'override_applied',l.lead_score_override is not null,'reasons',v_reasons,'scoring_version',v_version);
end $$;

create or replace function public.refresh_event_lead_scores(p_days integer default 180)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare r record; v_count integer:=0;
begin
  for r in select id from public.leads where created_at>=now()-make_interval(days=>least(greatest(p_days,1),730)) and coalesce((context->>'synthetic_test')::boolean,false)=false loop
    perform public.score_event_lead(r.id); v_count:=v_count+1;
  end loop;
  return jsonb_build_object('refreshed',v_count,'scoring_version','event-v2');
end $$;

create or replace function public.get_lead_score_performance(p_days integer default 180)
returns jsonb language sql stable security invoker set search_path='' as $$
with base as (
  select l.id,l.lead_score,case when l.lead_score>=70 then 'high' when l.lead_score>=40 then 'medium' else 'low' end band,
    exists(select 1 from public.deals d where d.prospect_id=l.prospect_id and (d.outcome='won' or d.stage in('deposit_paid','event_scheduled','completed','rebooking')))
    or exists(select 1 from public.stripe_events s where (s.lead_id=l.id or s.submission_id=l.submission_id) and s.payment_status='paid') converted
  from public.leads l where l.created_at>=now()-make_interval(days=>least(greatest(p_days,1),730)) and l.lead_score is not null and coalesce((l.context->>'synthetic_test')::boolean,false)=false
), bands as (select band,count(*)::int leads,count(*) filter(where converted)::int conversions,round(count(*) filter(where converted)::numeric/nullif(count(*),0),4) conversion_rate from base group by band), totals as (select count(*)::int scored_leads,count(*) filter(where converted)::int conversions from base)
select jsonb_build_object('days',least(greatest(p_days,1),730),'totals',(select to_jsonb(t) from totals t),'bands',coalesce((select jsonb_agg(to_jsonb(b) order by case band when 'high' then 1 when 'medium' then 2 else 3 end) from bands b),'[]'::jsonb),'useful',coalesce((select max(conversion_rate) filter(where band='high')>=max(conversion_rate) filter(where band in('medium','low')) from bands),false));
$$;

create or replace function automation.score_lead_after_change() returns trigger language plpgsql security invoker set search_path='' as $$begin perform public.score_event_lead(new.id);return new;end$$;
create or replace function automation.score_lead_after_funnel() returns trigger language plpgsql security invoker set search_path='' as $$declare v_id uuid;begin if new.submission_id is not null then select id into v_id from public.leads where submission_id=new.submission_id;if v_id is not null then perform public.score_event_lead(v_id);end if;end if;return new;end$$;
create or replace function automation.score_lead_after_payment() returns trigger language plpgsql security invoker set search_path='' as $$declare v_id uuid;begin if new.payment_status='paid' then v_id:=new.lead_id;if v_id is null and new.submission_id is not null then select id into v_id from public.leads where submission_id=new.submission_id;end if;if v_id is not null then perform public.score_event_lead(v_id);end if;end if;return new;end$$;

drop trigger if exists leads_score_after_qualification on public.leads;
create trigger leads_score_after_qualification after insert or update of preferred_event_date,team_size,budget_range,package_interest,decision_timeline,lead_score_override on public.leads for each row execute function automation.score_lead_after_change();
drop trigger if exists funnel_score_after_insert on public.funnel_events;
create trigger funnel_score_after_insert after insert on public.funnel_events for each row execute function automation.score_lead_after_funnel();
drop trigger if exists stripe_score_after_payment on public.stripe_events;
create trigger stripe_score_after_payment after insert or update of payment_status on public.stripe_events for each row execute function automation.score_lead_after_payment();

revoke execute on function public.score_event_lead(uuid),public.refresh_event_lead_scores(integer),public.get_lead_score_performance(integer) from public,anon,authenticated;
grant execute on function public.score_event_lead(uuid),public.refresh_event_lead_scores(integer),public.get_lead_score_performance(integer) to service_role;
revoke execute on function automation.score_lead_after_change(),automation.score_lead_after_funnel(),automation.score_lead_after_payment() from public,anon,authenticated;

do $$declare v_job bigint;begin select jobid into v_job from cron.job where jobname='refresh-event-lead-scores' limit 1;if v_job is not null then perform cron.unschedule(v_job);end if;perform cron.schedule('refresh-event-lead-scores','15 10 * * *','select public.refresh_event_lead_scores(180)');end$$;

select public.refresh_event_lead_scores(730);
