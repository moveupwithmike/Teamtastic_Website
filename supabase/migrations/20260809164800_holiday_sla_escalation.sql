create table public.holiday_sla_escalation_runs (
  id uuid primary key default gen_random_uuid(),
  warnings_15m integer not null default 0,
  breaches_30m integer not null default 0,
  deposits_unhandled integer not null default 0,
  december_unresolved integer not null default 0,
  followups_overdue integer not null default 0,
  resolved integer not null default 0,
  result jsonb not null default '{}'::jsonb,
  ran_at timestamptz not null default now()
);
create index holiday_sla_escalation_runs_ran_idx on public.holiday_sla_escalation_runs(ran_at desc);
alter table public.holiday_sla_escalation_runs enable row level security;
revoke all on table public.holiday_sla_escalation_runs from public,anon,authenticated;
grant select,insert,update,delete on table public.holiday_sla_escalation_runs to service_role;

create or replace function automation.escalate_holiday_sla()
returns jsonb language plpgsql security invoker set search_path=''
as $$
declare v_15 integer:=0;v_30 integer:=0;v_deposit integer:=0;v_december integer:=0;v_followup integer:=0;v_resolved integer:=0;v_step integer:=0;v_result jsonb;
begin
  insert into public.tasks(prospect_id,title,description,priority,due_at,source,fingerprint)
  select l.prospect_id,'Holiday lead approaching response SLA','No recorded human sales response after 15 minutes. Respond before the 30-minute SLA is breached.','high',now(),'holiday_sla_escalation','holiday:escalation:15:'||l.id
  from public.leads l where l.lead_source in('holiday_party_money_page','year_end_celebration_page','large_holiday_event_page') and l.prospect_id is not null and coalesce((l.context->>'synthetic_test')::boolean,false)=false and l.created_at<=now()-interval '15 minutes'
  and not exists(select 1 from public.messages m where m.prospect_id=l.prospect_id and m.direction='outbound' and m.message_type in('manual','proposal') and coalesce(m.sent_at,m.created_at)>=l.created_at)
  on conflict(fingerprint) where fingerprint is not null do nothing;get diagnostics v_15=row_count;

  insert into public.tasks(prospect_id,title,description,priority,due_at,source,fingerprint)
  select l.prospect_id,'Holiday response SLA breached','No recorded human sales response within 30 minutes. Respond immediately and record the outcome.','urgent',now(),'holiday_sla_escalation','holiday:escalation:30:'||l.id
  from public.leads l where l.lead_source in('holiday_party_money_page','year_end_celebration_page','large_holiday_event_page') and l.prospect_id is not null and coalesce((l.context->>'synthetic_test')::boolean,false)=false and l.created_at<=now()-interval '30 minutes'
  and not exists(select 1 from public.messages m where m.prospect_id=l.prospect_id and m.direction='outbound' and m.message_type in('manual','proposal') and coalesce(m.sent_at,m.created_at)>=l.created_at)
  on conflict(fingerprint) where fingerprint is not null do nothing;get diagnostics v_30=row_count;

  insert into public.tasks(prospect_id,title,description,priority,due_at,source,fingerprint)
  select l.prospect_id,'Deposit paid — immediate response required','A holiday buyer paid a deposit and no subsequent human sales response is recorded. Confirm receipt, date, and onboarding immediately.','urgent',now(),'holiday_sla_escalation','holiday:escalation:deposit:'||s.id
  from public.stripe_events s join public.leads l on l.id=s.lead_id where s.payment_status='paid' and s.product_key='hosted_event_deposit' and coalesce((l.context->>'synthetic_test')::boolean,false)=false
  and not exists(select 1 from public.messages m where m.prospect_id=l.prospect_id and m.direction='outbound' and m.message_type in('manual','proposal') and coalesce(m.sent_at,m.created_at)>=s.paid_at)
  and not exists(select 1 from public.tasks t where t.source='phase4_paid_conversion' and t.prospect_id=l.prospect_id and t.status='completed')
  on conflict(fingerprint) where fingerprint is not null do nothing;get diagnostics v_deposit=row_count;

  insert into public.tasks(prospect_id,title,description,priority,due_at,source,fingerprint)
  select l.prospect_id,'December availability still unconfirmed','A December date request remains unresolved after 30 minutes. Confirm host and production capacity before promising the date.','urgent',now(),'holiday_sla_escalation','holiday:escalation:december:'||l.id
  from public.leads l join public.deals d on d.prospect_id=l.prospect_id where l.lead_source in('holiday_party_money_page','year_end_celebration_page','large_holiday_event_page') and coalesce((l.context->>'synthetic_test')::boolean,false)=false and l.created_at<=now()-interval '30 minutes' and (extract(month from l.preferred_event_date)=12 or extract(month from l.alternate_event_date)=12) and coalesce((d.metadata->>'availability_confirmed')::boolean,false)=false and d.outcome='open'
  on conflict(fingerprint) where fingerprint is not null do nothing;get diagnostics v_december=row_count;

  insert into public.tasks(prospect_id,title,description,priority,due_at,source,fingerprint)
  select t.prospect_id,'Overdue holiday follow-up','A scheduled holiday follow-up is overdue. Review the timeline and complete or cancel the original follow-up.','high',now(),'holiday_sla_escalation','holiday:escalation:followup:'||t.id
  from public.tasks t join public.prospects p on p.id=t.prospect_id where t.source='holiday_sla' and t.title like 'Holiday lead follow-up%' and t.status in('open','in_progress') and t.due_at<now()
  and not exists(select 1 from public.leads l where l.prospect_id=p.id and coalesce((l.context->>'synthetic_test')::boolean,false)=true)
  on conflict(fingerprint) where fingerprint is not null do nothing;get diagnostics v_followup=row_count;

  update public.tasks e set status='completed',updated_at=now(),description=coalesce(e.description,'')||E'\nResolved automatically after a human sales response was recorded.'
  where e.source='holiday_sla_escalation' and e.status in('open','in_progress') and (e.fingerprint like 'holiday:escalation:15:%' or e.fingerprint like 'holiday:escalation:30:%') and exists(select 1 from public.leads l join public.messages m on m.prospect_id=l.prospect_id where e.fingerprint like '%:'||l.id and m.direction='outbound' and m.message_type in('manual','proposal') and coalesce(m.sent_at,m.created_at)>=l.created_at);get diagnostics v_resolved=row_count;
  update public.tasks e set status='completed',updated_at=now() where e.source='holiday_sla_escalation' and e.status in('open','in_progress') and e.fingerprint like 'holiday:escalation:followup:%' and not exists(select 1 from public.tasks original where e.fingerprint='holiday:escalation:followup:'||original.id and original.status in('open','in_progress'));get diagnostics v_step=row_count;v_resolved:=v_resolved+v_step;
  update public.tasks e set status='completed',updated_at=now() where e.source='holiday_sla_escalation' and e.status in('open','in_progress') and e.fingerprint like 'holiday:escalation:deposit:%' and exists(select 1 from public.stripe_events s join public.leads l on l.id=s.lead_id where e.fingerprint='holiday:escalation:deposit:'||s.id and (exists(select 1 from public.messages m where m.prospect_id=l.prospect_id and m.direction='outbound' and m.message_type in('manual','proposal') and coalesce(m.sent_at,m.created_at)>=s.paid_at) or exists(select 1 from public.tasks t where t.source='phase4_paid_conversion' and t.prospect_id=l.prospect_id and t.status='completed')));get diagnostics v_step=row_count;v_resolved:=v_resolved+v_step;
  update public.tasks e set status='completed',updated_at=now() where e.source='holiday_sla_escalation' and e.status in('open','in_progress') and e.fingerprint like 'holiday:escalation:december:%' and exists(select 1 from public.leads l join public.deals d on d.prospect_id=l.prospect_id where e.fingerprint='holiday:escalation:december:'||l.id and coalesce((d.metadata->>'availability_confirmed')::boolean,false)=true);get diagnostics v_step=row_count;v_resolved:=v_resolved+v_step;

  v_result:=jsonb_build_object('warnings_15m',v_15,'breaches_30m',v_30,'deposits_unhandled',v_deposit,'december_unresolved',v_december,'followups_overdue',v_followup,'resolved',v_resolved,'open_escalations',(select count(*) from public.tasks where source='holiday_sla_escalation' and status in('open','in_progress')));
  insert into public.holiday_sla_escalation_runs(warnings_15m,breaches_30m,deposits_unhandled,december_unresolved,followups_overdue,resolved,result) values(v_15,v_30,v_deposit,v_december,v_followup,v_resolved,v_result);
  update public.daily_reports set summary=summary||jsonb_build_object('holiday_sla',v_result),updated_at=now() where report_date=current_date;
  return v_result;
end;$$;
create or replace function public.escalate_holiday_sla() returns jsonb language sql security invoker set search_path='' as $$select automation.escalate_holiday_sla();$$;
revoke all on function public.escalate_holiday_sla() from public,anon,authenticated;
grant execute on function public.escalate_holiday_sla() to service_role;
revoke all on function automation.escalate_holiday_sla() from public,anon,authenticated;
do $job$ begin if exists(select 1 from cron.job where jobname='holiday-sla-escalation') then perform cron.unschedule('holiday-sla-escalation');end if;perform cron.schedule('holiday-sla-escalation','*/5 * * * *','select automation.escalate_holiday_sla();');end $job$;
