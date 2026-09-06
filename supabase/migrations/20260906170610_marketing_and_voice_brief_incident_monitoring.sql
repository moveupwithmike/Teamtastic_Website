-- Both sync-marketing-performance and generate-daily-voice-brief are
-- deliberately built to never crash and always return 200 OK, even when a
-- platform/step fails -- one bad platform must not take down the report.
-- That's the right call for reliability, but it means the existing
-- cron.job_run_details-based failure scan in collect_production_incidents()
-- can never see these failures: from cron's perspective the job "succeeded."
-- Adds two more checks to that same function, following the exact
-- single-stable-fingerprint / latest-row pattern already used for
-- conversion_health_runs (check only the most recent row, not a rolling
-- window, so a since-fixed failure doesn't get re-flagged from history).
--
-- Placed after every existing check/resolve pair rather than interleaved
-- with them, and using dedicated loop variables (v_marketing, v_report)
-- rather than reusing the shared `r` variable -- the original function
-- reuses `r` between the conversion_health_runs check and its own resolve
-- check a few lines later, so anything inserted in between that reassigns
-- `r` to a differently-shaped row would break that check at runtime.

create or replace function automation.collect_production_incidents()
returns jsonb language plpgsql security invoker set search_path='' as $$declare r record;v_created integer:=0;v_resolved integer:=0;v_step integer:=0;v_id uuid;v_marketing record;v_report record;v_agent_log_cursor bigint;v_agent_log_max_id bigint;begin
  for r in select * from public.notification_deliveries where status='failed' and updated_at>=now()-interval '7 days' loop v_id:=automation.upsert_incident('notification:'||r.id,'lead_notification',case when r.attempts>=3 then 'critical' else 'high' end,'Lead notification delivery failed',coalesce(r.last_error,'Notification provider returned a failure.'),'notification_delivery',r.id::text,null,r.lead_id,jsonb_build_object('attempts',r.attempts,'notification_type',r.notification_type));v_created:=v_created+1;end loop;
  for r in select * from public.stripe_events where (lifecycle_status='failed' or alert_status='failed') and coalesce(lifecycle_processed_at,created_at)>=now()-interval '30 days' loop v_id:=automation.upsert_incident('stripe:'||r.id,'stripe','critical','Stripe payment processing requires reconciliation',coalesce(r.lifecycle_error,r.alert_error,'Stripe processing failed.'),'stripe_event',r.id::text,null,r.lead_id,jsonb_build_object('lifecycle_status',r.lifecycle_status,'alert_status',r.alert_status,'stripe_event_id',r.stripe_event_id));v_created:=v_created+1;end loop;
  for r in select * from public.payment_requests where status='mismatch' loop v_id:=automation.upsert_incident('payment-request:'||r.id,'stripe','critical','Payment request mismatch','The paid amount or Stripe session does not match the recorded payment request.','payment_request',r.id::text,null,r.lead_id,jsonb_build_object('status',r.status));v_created:=v_created+1;end loop;
  select coalesce(incident_monitor_agent_log_cursor,0) into v_agent_log_cursor from public.system_config where id=true;
  v_agent_log_max_id:=v_agent_log_cursor;
  for r in select * from public.agent_log where outcome in('failed','escalated') and id>v_agent_log_cursor loop
    v_id:=automation.upsert_incident('agent:'||r.agent_name||':'||r.action||':'||coalesce(left(r.error,120),r.outcome),'automation',case when r.outcome='failed' then 'high' else 'medium' end,r.agent_name||': '||replace(r.action,'_',' '),coalesce(r.error,r.decision->>'reason','Automation requires review.'),'agent_log',r.id::text,r.prospect_id,null,jsonb_build_object('outcome',r.outcome));
    v_created:=v_created+1;
    if r.id>v_agent_log_max_id then v_agent_log_max_id:=r.id;end if;
  end loop;
  if v_agent_log_max_id>v_agent_log_cursor then
    update public.system_config set incident_monitor_agent_log_cursor=v_agent_log_max_id where id=true;
  end if;
  for r in select j.jobname,d.jobid,d.status,d.return_message,d.end_time from cron.job_run_details d join cron.job j on j.jobid=d.jobid where d.status='failed' and d.start_time>=now()-interval '2 hours' loop v_id:=automation.upsert_incident('cron:'||r.jobid,'scheduled_job','high','Scheduled job failed: '||r.jobname,coalesce(r.return_message,'The scheduled job failed.'),'cron_job',r.jobid::text,null,null,jsonb_build_object('jobname',r.jobname,'end_time',r.end_time));v_created:=v_created+1;end loop;
  select * into r from public.conversion_health_runs order by started_at desc limit 1;if r.id is not null and r.status<>'healthy' then v_id:=automation.upsert_incident('conversion-health','conversion_health','critical','Holiday conversion pages are unhealthy',coalesce(r.error,r.checks_failed||' conversion checks failed.'),'conversion_health_run',r.id::text,null,null,jsonb_build_object('status',r.status,'checks_failed',r.checks_failed));v_created:=v_created+1;end if;
  update public.production_incidents i set status='resolved',resolved_at=now(),resolution='Resolved automatically after the notification was delivered.',updated_at=now() where i.status<>'resolved' and i.source_type='notification_delivery' and exists(select 1 from public.notification_deliveries d where d.id::text=i.source_id and d.status='sent');get diagnostics v_resolved=row_count;
  update public.production_incidents i set status='resolved',resolved_at=now(),resolution='Resolved automatically after payment reconciliation.',updated_at=now() where i.status<>'resolved' and i.source_type='stripe_event' and exists(select 1 from public.stripe_events s where s.id::text=i.source_id and s.lifecycle_status<>'failed' and s.alert_status<>'failed');get diagnostics v_step=row_count;v_resolved:=v_resolved+v_step;
  if r.id is not null and r.status='healthy' then update public.production_incidents set status='resolved',resolved_at=now(),resolution='Resolved automatically after a healthy conversion audit.',updated_at=now() where fingerprint='conversion-health' and status<>'resolved';get diagnostics v_step=row_count;v_resolved:=v_resolved+v_step;end if;
  for v_marketing in select distinct on (platform) * from public.marketing_performance_snapshots order by platform,snapshot_date desc loop if v_marketing.error is not null then v_id:=automation.upsert_incident('marketing-sync:'||v_marketing.platform,'automation','medium','Marketing sync failing: '||replace(v_marketing.platform,'_',' '),coalesce(v_marketing.error,'Marketing platform sync failed.'),'marketing_performance_snapshot',v_marketing.id::text,null,null,jsonb_build_object('platform',v_marketing.platform,'snapshot_date',v_marketing.snapshot_date));v_created:=v_created+1;end if;end loop;
  update public.production_incidents i set status='resolved',resolved_at=now(),resolution='Resolved automatically after a successful marketing sync.',updated_at=now() where i.status<>'resolved' and i.fingerprint like 'marketing-sync:%' and exists(select 1 from (select distinct on (platform) platform,error from public.marketing_performance_snapshots order by platform,snapshot_date desc) latest where 'marketing-sync:'||latest.platform=i.fingerprint and latest.error is null);get diagnostics v_step=row_count;v_resolved:=v_resolved+v_step;
  select * into v_report from public.daily_reports order by report_date desc limit 1;
  if v_report.report_date is not null and v_report.voice_brief_status='unavailable' then v_id:=automation.upsert_incident('voice-brief:latest','automation','low','Morning voice brief unavailable',coalesce(v_report.voice_brief_error,'Voice brief generation failed.'),'daily_report',v_report.id::text,null,null,jsonb_build_object('report_date',v_report.report_date));v_created:=v_created+1;end if;
  if v_report.report_date is not null and v_report.voice_brief_status='ready' then update public.production_incidents set status='resolved',resolved_at=now(),resolution='Resolved automatically after a successful voice brief generation.',updated_at=now() where fingerprint='voice-brief:latest' and status<>'resolved';get diagnostics v_step=row_count;v_resolved:=v_resolved+v_step;end if;
  insert into public.tasks(title,description,priority,due_at,source,fingerprint) select 'Production incident: '||title,coalesce(description,'Open the Production Incident Center.'),case when severity='critical' then 'urgent' else 'high' end,now(),'production_incident','incident:task:'||id from public.production_incidents where status='open' and severity in('critical','high') on conflict(fingerprint) where fingerprint is not null do nothing;
  return jsonb_build_object('observed_failures',v_created,'resolved',v_resolved,'open_incidents',(select count(*) from public.production_incidents where status<>'resolved'),'critical_open',(select count(*) from public.production_incidents where status<>'resolved' and severity='critical'));
end;$$;
