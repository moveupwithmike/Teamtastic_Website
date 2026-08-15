create table public.b2b_launch_state (
  id boolean primary key default true check(id),
  phase text not null default 'off' check(phase in ('off','inbound_pilot','proposal_pilot','live','paused','rolled_back')),
  launched_at timestamptz,
  launched_by text,
  paused_at timestamptz,
  paused_by text,
  pause_reason text,
  readiness_snapshot_id uuid references public.launch_readiness_snapshots(id) on delete set null,
  certification_run_id uuid references public.b2b_certification_runs(id) on delete set null,
  prior_config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by text
);
insert into public.b2b_launch_state(id) values(true) on conflict(id) do nothing;

create table public.b2b_launch_history (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  from_phase text not null,
  to_phase text not null,
  actor text not null,
  reason text,
  readiness_snapshot_id uuid references public.launch_readiness_snapshots(id) on delete set null,
  certification_run_id uuid references public.b2b_certification_runs(id) on delete set null,
  before_config jsonb not null,
  after_config jsonb not null,
  created_at timestamptz not null default now()
);
create index b2b_launch_history_created_idx on public.b2b_launch_history(created_at desc);
alter table public.b2b_launch_state enable row level security;
alter table public.b2b_launch_history enable row level security;
revoke all on table public.b2b_launch_state,public.b2b_launch_history from public,anon,authenticated;
grant select,insert,update,delete on table public.b2b_launch_state,public.b2b_launch_history to service_role;

create or replace function public.transition_b2b_launch(p_action text,p_actor text,p_reason text default null,p_daily_cap integer default 5)
returns jsonb language plpgsql security invoker set search_path=''
as $$
declare v_state public.b2b_launch_state%rowtype; v_config public.system_config%rowtype;
  v_readiness public.launch_readiness_snapshots%rowtype; v_cert public.b2b_certification_runs%rowtype;
  v_before jsonb; v_after jsonb; v_to text; v_prior jsonb;
begin
  if nullif(trim(p_actor),'') is null then return jsonb_build_object('changed',false,'reason','actor_required'); end if;
  perform pg_advisory_xact_lock(hashtextextended('b2b-controlled-launch',1));
  select * into v_state from public.b2b_launch_state where id=true for update;
  select * into v_config from public.system_config where id=true for update;
  select * into v_readiness from public.launch_readiness_snapshots order by created_at desc limit 1;
  select * into v_cert from public.b2b_certification_runs order by completed_at desc nulls last limit 1;
  v_before:=jsonb_build_object('master_enabled',v_config.master_enabled,'gmail_ingestion_enabled',v_config.gmail_ingestion_enabled,'daily_report_enabled',v_config.daily_report_enabled,'proposal_email_enabled',v_config.proposal_email_enabled,'prospecting_enabled',v_config.prospecting_enabled,'sequence_followups_enabled',v_config.sequence_followups_enabled,'daily_prospecting_cap',v_config.daily_prospecting_cap,'outbound_auto_paused',v_config.outbound_auto_paused);
  if p_action in ('begin_pilot','enable_proposals','enable_outbound') and (v_readiness.id is null or v_readiness.status='blocked' or v_readiness.blocker_count>0) then return jsonb_build_object('changed',false,'reason','launch_readiness_blocked'); end if;
  if p_action in ('begin_pilot','enable_proposals','enable_outbound') and (v_cert.id is null or v_cert.status<>'passed') then return jsonb_build_object('changed',false,'reason','certification_required'); end if;
  if p_action='begin_pilot' then
    if v_state.phase not in ('off','paused','rolled_back') then return jsonb_build_object('changed',false,'reason','invalid_phase','phase',v_state.phase); end if;
    v_prior:=v_before;
    update public.system_config set master_enabled=true,gmail_ingestion_enabled=true,daily_report_enabled=true,proposal_email_enabled=false,prospecting_enabled=false,sequence_followups_enabled=false,updated_at=now(),updated_by=p_actor where id=true;
    v_to:='inbound_pilot';
    update public.b2b_launch_state set phase=v_to,launched_at=now(),launched_by=p_actor,paused_at=null,paused_by=null,pause_reason=null,readiness_snapshot_id=v_readiness.id,certification_run_id=v_cert.id,prior_config=v_prior,updated_at=now(),updated_by=p_actor where id=true;
  elsif p_action='enable_proposals' then
    if v_state.phase<>'inbound_pilot' then return jsonb_build_object('changed',false,'reason','inbound_pilot_required','phase',v_state.phase); end if;
    update public.system_config set proposal_email_enabled=true,updated_at=now(),updated_by=p_actor where id=true; v_to:='proposal_pilot';
    update public.b2b_launch_state set phase=v_to,readiness_snapshot_id=v_readiness.id,certification_run_id=v_cert.id,updated_at=now(),updated_by=p_actor where id=true;
  elsif p_action='enable_outbound' then
    if v_state.phase<>'proposal_pilot' then return jsonb_build_object('changed',false,'reason','proposal_pilot_required','phase',v_state.phase); end if;
    if v_config.outbound_auto_paused then return jsonb_build_object('changed',false,'reason','deliverability_auto_pause_active'); end if;
    update public.system_config set prospecting_enabled=true,sequence_followups_enabled=true,daily_prospecting_cap=least(10,greatest(1,coalesce(p_daily_cap,5))),updated_at=now(),updated_by=p_actor where id=true; v_to:='live';
    update public.b2b_launch_state set phase=v_to,readiness_snapshot_id=v_readiness.id,certification_run_id=v_cert.id,updated_at=now(),updated_by=p_actor where id=true;
  elsif p_action='pause' then
    if v_state.phase='off' then return jsonb_build_object('changed',false,'reason','already_off'); end if;
    update public.system_config set master_enabled=false,proposal_email_enabled=false,prospecting_enabled=false,sequence_followups_enabled=false,updated_at=now(),updated_by=p_actor where id=true; v_to:='paused';
    update public.b2b_launch_state set phase=v_to,paused_at=now(),paused_by=p_actor,pause_reason=coalesce(nullif(trim(p_reason),''),'Emergency pause'),updated_at=now(),updated_by=p_actor where id=true;
  elsif p_action='rollback' then
    if v_state.prior_config='{}'::jsonb then return jsonb_build_object('changed',false,'reason','no_saved_configuration'); end if;
    update public.system_config set master_enabled=(v_state.prior_config->>'master_enabled')::boolean,gmail_ingestion_enabled=(v_state.prior_config->>'gmail_ingestion_enabled')::boolean,daily_report_enabled=(v_state.prior_config->>'daily_report_enabled')::boolean,proposal_email_enabled=(v_state.prior_config->>'proposal_email_enabled')::boolean,prospecting_enabled=(v_state.prior_config->>'prospecting_enabled')::boolean,sequence_followups_enabled=(v_state.prior_config->>'sequence_followups_enabled')::boolean,daily_prospecting_cap=(v_state.prior_config->>'daily_prospecting_cap')::integer,outbound_auto_paused=(v_state.prior_config->>'outbound_auto_paused')::boolean,updated_at=now(),updated_by=p_actor where id=true; v_to:='rolled_back';
    update public.b2b_launch_state set phase=v_to,paused_at=now(),paused_by=p_actor,pause_reason=coalesce(nullif(trim(p_reason),''),'Rolled back to pre-launch configuration'),updated_at=now(),updated_by=p_actor where id=true;
  else return jsonb_build_object('changed',false,'reason','unknown_action'); end if;
  select jsonb_build_object('master_enabled',master_enabled,'gmail_ingestion_enabled',gmail_ingestion_enabled,'daily_report_enabled',daily_report_enabled,'proposal_email_enabled',proposal_email_enabled,'prospecting_enabled',prospecting_enabled,'sequence_followups_enabled',sequence_followups_enabled,'daily_prospecting_cap',daily_prospecting_cap,'outbound_auto_paused',outbound_auto_paused) into v_after from public.system_config where id=true;
  insert into public.b2b_launch_history(action,from_phase,to_phase,actor,reason,readiness_snapshot_id,certification_run_id,before_config,after_config) values(p_action,v_state.phase,v_to,p_actor,p_reason,v_readiness.id,v_cert.id,v_before,v_after);
  return jsonb_build_object('changed',true,'phase',v_to,'previous_phase',v_state.phase,'config',v_after);
end; $$;
revoke all on function public.transition_b2b_launch(text,text,text,integer) from public,anon,authenticated;
grant execute on function public.transition_b2b_launch(text,text,text,integer) to service_role;
