create table public.production_incidents (
  id uuid primary key default gen_random_uuid(),
  fingerprint text not null unique,
  category text not null check(category in ('scheduled_job','webhook','lead_notification','email_provider','stripe','conversion_health','automation','other')),
  severity text not null check(severity in ('critical','high','medium','low')),
  status text not null default 'open' check(status in ('open','acknowledged','monitoring','resolved')),
  title text not null,
  description text,
  owner text not null default 'michael',
  source_type text not null,
  source_id text,
  prospect_id uuid references public.prospects(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  deal_id uuid references public.deals(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  occurrences integer not null default 1 check(occurrences>0),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  resolution text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index production_incidents_open_idx on public.production_incidents(severity,last_seen_at desc) where status<>'resolved';
create table public.production_incident_updates(
  id uuid primary key default gen_random_uuid(),incident_id uuid not null references public.production_incidents(id) on delete cascade,
  update_type text not null check(update_type in ('detected','acknowledged','recovery_attempt','monitoring','resolved','reopened')),
  note text,actor text not null,metadata jsonb not null default '{}'::jsonb,created_at timestamptz not null default now()
);
create index production_incident_updates_incident_idx on public.production_incident_updates(incident_id,created_at desc);
alter table public.production_incidents enable row level security;alter table public.production_incident_updates enable row level security;
revoke all on table public.production_incidents,public.production_incident_updates from public,anon,authenticated;
grant select,insert,update,delete on table public.production_incidents,public.production_incident_updates to service_role;

create or replace function automation.upsert_incident(p_fingerprint text,p_category text,p_severity text,p_title text,p_description text,p_source_type text,p_source_id text,p_prospect_id uuid default null,p_lead_id uuid default null,p_metadata jsonb default '{}'::jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$declare v_id uuid;v_was_resolved boolean;begin
  select id,status='resolved' into v_id,v_was_resolved from public.production_incidents where fingerprint=p_fingerprint for update;
  if v_id is null then insert into public.production_incidents(fingerprint,category,severity,title,description,source_type,source_id,prospect_id,lead_id,metadata) values(p_fingerprint,p_category,p_severity,p_title,p_description,p_source_type,p_source_id,p_prospect_id,p_lead_id,p_metadata) returning id into v_id;insert into public.production_incident_updates(incident_id,update_type,note,actor,metadata) values(v_id,'detected',p_description,'incident-monitor',p_metadata);
  else update public.production_incidents set severity=p_severity,title=p_title,description=p_description,metadata=metadata||p_metadata,occurrences=occurrences+1,last_seen_at=now(),status=case when status='resolved' then 'open' else status end,resolved_at=case when status='resolved' then null else resolved_at end,resolution=case when status='resolved' then null else resolution end,updated_at=now() where id=v_id;if v_was_resolved then insert into public.production_incident_updates(incident_id,update_type,note,actor) values(v_id,'reopened','The failure condition recurred.','incident-monitor');end if;end if;return v_id;end;$$;

create or replace function automation.collect_production_incidents()
returns jsonb language plpgsql security invoker set search_path='' as $$declare r record;v_created integer:=0;v_resolved integer:=0;v_step integer:=0;v_id uuid;begin
  for r in select * from public.notification_deliveries where status='failed' and updated_at>=now()-interval '7 days' loop v_id:=automation.upsert_incident('notification:'||r.id,'lead_notification',case when r.attempts>=3 then 'critical' else 'high' end,'Lead notification delivery failed',coalesce(r.last_error,'Notification provider returned a failure.'),'notification_delivery',r.id::text,null,r.lead_id,jsonb_build_object('attempts',r.attempts,'notification_type',r.notification_type));v_created:=v_created+1;end loop;
  for r in select * from public.stripe_events where (lifecycle_status='failed' or alert_status='failed') and coalesce(lifecycle_processed_at,created_at)>=now()-interval '30 days' loop v_id:=automation.upsert_incident('stripe:'||r.id,'stripe','critical','Stripe payment processing requires reconciliation',coalesce(r.lifecycle_error,r.alert_error,'Stripe processing failed.'),'stripe_event',r.id::text,null,r.lead_id,jsonb_build_object('lifecycle_status',r.lifecycle_status,'alert_status',r.alert_status,'stripe_event_id',r.stripe_event_id));v_created:=v_created+1;end loop;
  for r in select * from public.payment_requests where status='mismatch' loop v_id:=automation.upsert_incident('payment-request:'||r.id,'stripe','critical','Payment request mismatch','The paid amount or Stripe session does not match the recorded payment request.','payment_request',r.id::text,null,r.lead_id,jsonb_build_object('status',r.status));v_created:=v_created+1;end loop;
  for r in select * from public.agent_log where outcome in('failed','escalated') and created_at>=now()-interval '24 hours' loop v_id:=automation.upsert_incident('agent:'||r.agent_name||':'||r.action||':'||coalesce(left(r.error,120),r.outcome),'automation',case when r.outcome='failed' then 'high' else 'medium' end,r.agent_name||': '||replace(r.action,'_',' '),coalesce(r.error,r.decision->>'reason','Automation requires review.'),'agent_log',r.id::text,r.prospect_id,null,jsonb_build_object('outcome',r.outcome));v_created:=v_created+1;end loop;
  for r in select j.jobname,d.jobid,d.status,d.return_message,d.end_time from cron.job_run_details d join cron.job j on j.jobid=d.jobid where d.status='failed' and d.start_time>=now()-interval '2 hours' loop v_id:=automation.upsert_incident('cron:'||r.jobid,'scheduled_job','high','Scheduled job failed: '||r.jobname,coalesce(r.return_message,'The scheduled job failed.'),'cron_job',r.jobid::text,null,null,jsonb_build_object('jobname',r.jobname,'end_time',r.end_time));v_created:=v_created+1;end loop;
  select * into r from public.conversion_health_runs order by started_at desc limit 1;if r.id is not null and r.status<>'healthy' then v_id:=automation.upsert_incident('conversion-health','conversion_health','critical','Holiday conversion pages are unhealthy',coalesce(r.error,r.checks_failed||' conversion checks failed.'),'conversion_health_run',r.id::text,null,null,jsonb_build_object('status',r.status,'checks_failed',r.checks_failed));v_created:=v_created+1;end if;
  update public.production_incidents i set status='resolved',resolved_at=now(),resolution='Resolved automatically after the notification was delivered.',updated_at=now() where i.status<>'resolved' and i.source_type='notification_delivery' and exists(select 1 from public.notification_deliveries d where d.id::text=i.source_id and d.status='sent');get diagnostics v_resolved=row_count;
  update public.production_incidents i set status='resolved',resolved_at=now(),resolution='Resolved automatically after payment reconciliation.',updated_at=now() where i.status<>'resolved' and i.source_type='stripe_event' and exists(select 1 from public.stripe_events s where s.id::text=i.source_id and s.lifecycle_status<>'failed' and s.alert_status<>'failed');get diagnostics v_step=row_count;v_resolved:=v_resolved+v_step;
  if r.id is not null and r.status='healthy' then update public.production_incidents set status='resolved',resolved_at=now(),resolution='Resolved automatically after a healthy conversion audit.',updated_at=now() where fingerprint='conversion-health' and status<>'resolved';get diagnostics v_step=row_count;v_resolved:=v_resolved+v_step;end if;
  insert into public.tasks(title,description,priority,due_at,source,fingerprint) select 'Production incident: '||title,coalesce(description,'Open the Production Incident Center.'),case when severity='critical' then 'urgent' else 'high' end,now(),'production_incident','incident:task:'||id from public.production_incidents where status='open' and severity in('critical','high') on conflict(fingerprint) where fingerprint is not null do nothing;
  return jsonb_build_object('observed_failures',v_created,'resolved',v_resolved,'open_incidents',(select count(*) from public.production_incidents where status<>'resolved'),'critical_open',(select count(*) from public.production_incidents where status<>'resolved' and severity='critical'));
end;$$;
create or replace function public.collect_production_incidents() returns jsonb language sql security invoker set search_path='' as $$select automation.collect_production_incidents();$$;
revoke all on function public.collect_production_incidents() from public,anon,authenticated;grant execute on function public.collect_production_incidents() to service_role;
revoke all on function automation.upsert_incident(text,text,text,text,text,text,text,uuid,uuid,jsonb),automation.collect_production_incidents() from public,anon,authenticated;
do $job$ begin if exists(select 1 from cron.job where jobname='production-incident-monitor') then perform cron.unschedule('production-incident-monitor');end if;perform cron.schedule('production-incident-monitor','*/5 * * * *','select automation.collect_production_incidents();');end $job$;
