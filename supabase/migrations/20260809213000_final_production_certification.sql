-- Phase 11: durable, time-gated production certification.
create table public.final_production_certifications (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'running' check(status in ('running','ready_for_signoff','passed','failed')),
  started_at timestamptz not null default now(),
  observation_ends_at timestamptz not null default now()+interval '24 hours',
  completed_at timestamptz,
  started_by text not null,
  signed_off_by text,
  signed_off_at timestamptz,
  preflight_evidence jsonb not null default '{}'::jsonb,
  latest_checks jsonb not null default '[]'::jsonb,
  known_limitations jsonb not null default '[]'::jsonb,
  pilot_lead_id uuid references public.leads(id) on delete set null,
  pilot_client_id uuid references public.clients(id) on delete set null,
  pilot_portal_invitation_id uuid references public.portal_invitations(id) on delete set null,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index final_production_certifications_status_end_idx on public.final_production_certifications(status,observation_ends_at);
alter table public.final_production_certifications enable row level security;
revoke all on table public.final_production_certifications from public,anon,authenticated;
grant select,insert,update on table public.final_production_certifications to service_role;

create table public.final_certification_observations (
  id bigint generated always as identity primary key,
  certification_id uuid not null references public.final_production_certifications(id) on delete restrict,
  observed_at timestamptz not null default now(),
  critical_incidents integer not null default 0,
  failed_core_jobs integer not null default 0,
  failed_notifications integer not null default 0,
  stripe_reconciliation_issues integer not null default 0,
  health_status text,
  mailbox_status text,
  snapshot jsonb not null default '{}'::jsonb
);
create index final_certification_observations_run_time_idx on public.final_certification_observations(certification_id,observed_at desc);
alter table public.final_certification_observations enable row level security;
revoke all on table public.final_certification_observations from public,anon,authenticated;
revoke all on sequence public.final_certification_observations_id_seq from public,anon,authenticated;
grant select,insert on table public.final_certification_observations to service_role;
grant usage,select on sequence public.final_certification_observations_id_seq to service_role;

create trigger final_production_certifications_touch before update on public.final_production_certifications
for each row execute function automation.touch_updated_at();

create or replace function automation.observe_final_production_certifications()
returns jsonb language plpgsql security invoker set search_path=''
as $$
declare r public.final_production_certifications%rowtype; criticals integer; jobs integer; notifications integer; stripe_issues integer; health text; mailbox text; checks jsonb; journey record; observed integer:=0;
begin
  for r in select * from public.final_production_certifications where status in ('running','ready_for_signoff') for update skip locked loop
    select count(*) into criticals from public.production_incidents where severity='critical' and status<>'resolved' and last_seen_at>=r.started_at;
    select count(*) into jobs from cron.job_run_details d join cron.job j on j.jobid=d.jobid
      where d.start_time>=r.started_at and d.status='failed' and j.active and j.jobname in ('holiday-sla-escalation','production-incident-monitor','holiday-sla-maintenance','conversion-health-monitor','prepare-daily-growth-brief','prepare-growth-experiment-queue','prepare-daily-growth-agenda');
    select count(*) into notifications from public.notification_deliveries where created_at>=r.started_at and status='failed';
    select count(*) into stripe_issues from public.stripe_events where created_at>=r.started_at and (matched=false or lifecycle_status in ('failed','needs_lead_match') or alert_status='failed');
    select status into health from public.conversion_health_runs order by started_at desc limit 1;
    select status into mailbox from public.mailbox_sync_state order by updated_at desc limit 1;
    select l.id lead_id,c.id client_id,pi.id invitation_id into journey
      from public.leads l join public.clients c on c.primary_prospect_id=l.prospect_id
      join public.client_contacts cc on cc.client_id=c.id
      join public.portal_invitations pi on pi.client_contact_id=cc.id
      where l.created_at>=r.started_at and coalesce((l.context->>'synthetic_test')::boolean,false)=false
        and pi.status in ('sent','accepted') order by pi.created_at limit 1;
    checks:=jsonb_build_array(
      jsonb_build_object('key','observation_window','passed',now()>=r.observation_ends_at,'detail',case when now()>=r.observation_ends_at then '24-hour observation complete' else 'Observation remains in progress' end),
      jsonb_build_object('key','critical_incidents','passed',criticals=0,'detail',criticals||' unresolved critical incidents during pilot'),
      jsonb_build_object('key','core_jobs','passed',jobs=0,'detail',jobs||' failed core scheduled-job runs during pilot'),
      jsonb_build_object('key','notifications','passed',notifications=0,'detail',notifications||' failed lead notifications during pilot'),
      jsonb_build_object('key','stripe_reconciliation','passed',stripe_issues=0,'detail',stripe_issues||' Stripe reconciliation issues during pilot'),
      jsonb_build_object('key','conversion_health','passed',health='healthy','detail','Latest conversion health: '||coalesce(health,'missing')),
      jsonb_build_object('key','mailbox_sync','passed',mailbox='healthy','detail','Latest mailbox sync: '||coalesce(mailbox,'missing')),
      jsonb_build_object('key','production_journey','passed',journey.lead_id is not null,'detail',case when journey.lead_id is null then 'Waiting for one real lead-to-client portal journey' else 'Production lead reached client portal onboarding' end)
    );
    insert into public.final_certification_observations(certification_id,critical_incidents,failed_core_jobs,failed_notifications,stripe_reconciliation_issues,health_status,mailbox_status,snapshot)
    values(r.id,criticals,jobs,notifications,stripe_issues,health,mailbox,checks);
    update public.final_production_certifications set latest_checks=checks,pilot_lead_id=journey.lead_id,pilot_client_id=journey.client_id,
      pilot_portal_invitation_id=journey.invitation_id,status=case when now()>=r.observation_ends_at and criticals=0 and jobs=0 and notifications=0 and stripe_issues=0
        and health='healthy' and mailbox='healthy' and journey.lead_id is not null then 'ready_for_signoff' else 'running' end where id=r.id;
    observed:=observed+1;
  end loop;
  return jsonb_build_object('observed',observed);
end;$$;
revoke all on function automation.observe_final_production_certifications() from public,anon,authenticated;

create or replace function public.observe_final_production_certifications()
returns jsonb language sql security invoker set search_path=''
as $$select automation.observe_final_production_certifications();$$;
revoke all on function public.observe_final_production_certifications() from public,anon,authenticated;
grant execute on function public.observe_final_production_certifications() to service_role;

create or replace function public.start_final_production_certification(p_actor text,p_preflight_evidence jsonb,p_known_limitations jsonb)
returns uuid language plpgsql security invoker set search_path=''
as $$declare new_id uuid;
begin
  if exists(select 1 from public.final_production_certifications where status in ('running','ready_for_signoff')) then
    select id into new_id from public.final_production_certifications where status in ('running','ready_for_signoff') order by started_at desc limit 1; return new_id;
  end if;
  insert into public.final_production_certifications(started_by,preflight_evidence,known_limitations) values(p_actor,coalesce(p_preflight_evidence,'{}'),coalesce(p_known_limitations,'[]')) returning id into new_id;
  perform automation.observe_final_production_certifications(); return new_id;
end;$$;
revoke all on function public.start_final_production_certification(text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.start_final_production_certification(text,jsonb,jsonb) to service_role;

create or replace function public.sign_off_final_production_certification(p_certification_id uuid,p_actor text)
returns jsonb language plpgsql security invoker set search_path=''
as $$declare r public.final_production_certifications%rowtype;
begin
  perform automation.observe_final_production_certifications();
  select * into r from public.final_production_certifications where id=p_certification_id for update;
  if r.status<>'ready_for_signoff' then raise exception 'Final certification gates are not complete'; end if;
  if coalesce((r.preflight_evidence->>'automated_tests_passed')::boolean,false)=false
    or coalesce((r.preflight_evidence->>'production_build_passed')::boolean,false)=false
    or coalesce((r.preflight_evidence->>'office_access_verified')::boolean,false)=false
    or coalesce((r.preflight_evidence->>'stripe_verified')::boolean,false)=false
    or coalesce((r.preflight_evidence->>'scheduled_automations_verified')::boolean,false)=false
    or coalesce((r.preflight_evidence->>'security_advisors_reviewed')::boolean,false)=false
    or coalesce((r.preflight_evidence->>'controlled_load_passed')::boolean,false)=false then raise exception 'Required preflight evidence is incomplete'; end if;
  update public.final_production_certifications set status='passed',signed_off_by=p_actor,signed_off_at=now(),completed_at=now() where id=r.id;
  return jsonb_build_object('passed',true,'certification_id',r.id,'signed_off_by',p_actor);
end;$$;
revoke all on function public.sign_off_final_production_certification(uuid,text) from public,anon,authenticated;
grant execute on function public.sign_off_final_production_certification(uuid,text) to service_role;

do $job$
declare job_id bigint;
begin
  select jobid into job_id from cron.job where jobname='final-production-certification-monitor' limit 1;
  if job_id is not null then perform cron.unschedule(job_id); end if;
  perform cron.schedule('final-production-certification-monitor','15 * * * *','select automation.observe_final_production_certifications();');
end $job$;
