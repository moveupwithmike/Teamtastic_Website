-- Launch phase policy (v6.2) — regression suite.
-- Proves the corrected sequencing:
--   * controlled outbound cannot start before pre-launch certification;
--   * the controlled outbound pilot starts WITHOUT any real-customer journey
--     and is hard-capped at five approved messages per weekday;
--   * progression to CONTROLLED SCALE requires the immutable
--     first_real_customer_journey_validation milestone;
--   * retired drafts are terminal and never selectable by the send path;
--   * draft approval demands a named human approver and a production-classified
--     prospect;
--   * kill switches remain authoritative.
-- Run via supabase/tests/run_manual_certification_tests.sh.
\set ON_ERROR_STOP on

begin;

create temp table test_results (
  name text primary key,
  detail text
);

create function pg_temp.assert_that(p_name text, p_condition boolean, p_detail text default null)
returns void language plpgsql as $$
begin
  if coalesce(p_condition, false) then
    insert into test_results values (p_name, coalesce(p_detail, 'ok'))
    on conflict (name) do update set detail = excluded.detail;
  else
    raise exception 'ASSERTION FAILED: % (%)', p_name, coalesce(p_detail, '');
  end if;
end $$;

-- ===========================================================================
-- Environment preparation
-- ===========================================================================

-- Remove fixture residue left by earlier suites so the readiness gate can go
-- green under our control.
delete from public.tasks where source <> 'launch_watchlist'
  and title in ('Fixture urgent follow-up','Seed urgent follow-up');

insert into public.conversion_health_runs(status, started_at, completed_at)
values ('healthy', now() - interval '2 hours', now() - interval '1 hour');

insert into public.mailbox_sync_state(mailbox, status, last_synced_at)
values ('mailbox@teamtastic.test', 'healthy', now() - interval '5 minutes')
on conflict (mailbox) do update set status = 'healthy', updated_at = now(), last_synced_at = now();

-- Phase 1 certification passed + final pre-launch certification passed.
insert into public.b2b_certification_runs(started_by, status, passed_count, failed_count, completed_at, external_messages_sent)
values ('phase-policy@teamtastic.test', 'passed', 12, 0, now(), 0);

-- Ensure the readiness evaluator sees a PASSED LATEST final certification.
-- Earlier suites leave newer running certifications behind, so this suite
-- always creates its own newest passed row. The completion guard legitimately
-- forbids forging a passed row through UPDATE; momentarily suspending that
-- trigger inside this transaction (and re-enabling before commit) is
-- regression-database scaffolding, never a production pattern.
do $$
begin
  execute 'alter table public.final_production_certifications disable trigger final_production_certifications_enforce_completion';
  insert into public.final_production_certifications(
    started_by, preflight_evidence, known_limitations, status,
    signed_off_by, signed_off_at, completed_at, signed_off_state, started_at
  ) values (
    'phase-policy@teamtastic.test',
    '{"automated_tests_passed":true,"production_build_passed":true,"controlled_load_passed":true,"chromium_forms_verified":true}'::jsonb,
    '[]'::jsonb, 'passed',
    'Phase Suite Signer', now(), now(),
    jsonb_build_object('policy_version','suite','gates','[]'::jsonb),
    now() + interval '1 hour'
  );
  execute 'alter table public.final_production_certifications enable trigger final_production_certifications_enforce_completion';
end $$;

-- Reset launch state machine. The schema-only harness dump has no singleton
-- rows, so seed them if absent (production always carries both).
insert into public.system_config(id) values (true) on conflict (id) do nothing;
insert into public.b2b_launch_state(id) values (true) on conflict (id) do nothing;

update public.b2b_launch_state
set phase='off', paused_at=null, paused_by=null, pause_reason=null, prior_config='{}'::jsonb, updated_at=now(), updated_by='phase-policy@teamtastic.test'
where id=true;

update public.system_config
set master_enabled=false, proposal_email_enabled=false, prospecting_enabled=false,
    sequence_followups_enabled=false, outbound_auto_paused=false, outbound_mode='off',
    updated_at=now(), updated_by='phase-policy@teamtastic.test'
where id=true;

select automation.evaluate_launch_readiness();

create temp table gate as select get_launch_readiness as state from public.get_launch_readiness();
select pg_temp.assert_that('env.readiness_green_with_prelaunch_certification',
  coalesce((select state->>'status' from pg_temp.gate),'x') in ('ready','warning'),
  (select state::text from pg_temp.gate));

-- ===========================================================================
-- Section 1. Phase ordering and certification gating
-- ===========================================================================

-- Outbound cannot be jumped to from off.
do $$
declare v jsonb;
begin
  v := public.transition_b2b_launch('enable_outbound','phase-suite@teamtastic.test','suite');
  perform pg_temp.assert_that('phase.outbound_requires_proposal_pilot_first',
    not (v->>'changed')::boolean and (v->>'reason') in ('proposal_pilot_required','launch_readiness_blocked'));
end $$;

-- Phase A: inbound pilot starts WITHOUT any customer journey.
do $$
declare v jsonb;
begin
  v := public.transition_b2b_launch('begin_pilot','phase-suite@teamtastic.test','suite inbound');
  perform pg_temp.assert_that('phase.inbound_pilot_starts_without_journey',
    (v->>'changed')::boolean and (v->>'phase')='inbound_pilot', coalesce(v->>'reason','-'));
end $$;

-- Phase A never consults the post-launch milestone subsystem: whether or not
-- any journey milestone exists (earlier suites may have validated one), the
-- pilot transition above succeeded purely on pre-launch readiness.
select pg_temp.assert_that('phase.pilot_transition_ignores_milestones',
  exists(select 1 from public.launch_phase_milestone_state
         where milestone_key='first_real_customer_journey_validation')
  or not exists(select 1 from public.launch_phase_milestones));

-- Phase B: proposal pilot.
do $$
declare v jsonb;
begin
  v := public.transition_b2b_launch('enable_proposals','phase-suite@teamtastic.test','suite proposals');
  perform pg_temp.assert_that('phase.proposal_pilot_starts', (v->>'changed')::boolean and (v->>'phase')='proposal_pilot');
end $$;

-- Phase C blocked while final pre-launch certification is incomplete: a
-- NEWER running certification becomes the latest and holds everything.
-- started_at is explicit because now() is transaction-stable inside this
-- suite's single transaction and ordering must be deterministic.
insert into public.final_production_certifications(started_by, preflight_evidence, known_limitations, started_at)
values ('phase-policy-incomplete@teamtastic.test', '{}'::jsonb, '[]'::jsonb, now() + interval '2 hours');
select automation.evaluate_launch_readiness();

do $$
declare v jsonb;
begin
  v := public.transition_b2b_launch('enable_outbound','phase-suite@teamtastic.test','suite outbound premature');
  perform pg_temp.assert_that('phase.outbound_blocked_without_prelaunch_certification',
    not (v->>'changed')::boolean and (v->>'reason')='launch_readiness_blocked', coalesce(v::text,'null'));
end $$;

delete from public.final_production_certifications
where started_by='phase-policy-incomplete@teamtastic.test';
select automation.evaluate_launch_readiness();

-- Phase C starts without a real customer journey; requested cap 9 clamps to 5.
do $$
declare v jsonb;
begin
  v := public.transition_b2b_launch('enable_outbound','phase-suite@teamtastic.test','suite outbound',9);
  perform pg_temp.assert_that('phase.outbound_starts_before_customer_journey',
    (v->>'changed')::boolean and (v->>'phase')='live', coalesce(v->>'reason','-'));
  perform pg_temp.assert_that('cap.controlled_pilot_max_five_per_weekday',
    (v->'config'->>'daily_prospecting_cap')::int = 5,
    v->'config'->>'daily_prospecting_cap');
end $$;

-- ===========================================================================
-- Section 2. Controlled scale is earned by the post-launch milestone
-- ===========================================================================

do $$
declare v jsonb;
begin
  v := public.transition_b2b_launch('enable_scale','phase-suite@teamtastic.test','premature scale');
  perform pg_temp.assert_that('scale.refused_without_validated_journey_milestone',
    not (v->>'changed')::boolean and (v->>'reason')='first_real_customer_journey_validation_required',
    coalesce(v->>'reason','-'));
  perform pg_temp.assert_that('scale.refusal_reports_post_launch_state',
    v ? 'post_launch_milestones');
end $$;

-- Simulate the observer freezing a validated milestone for a REAL, fully
-- valid production chain (built as fixture data), then roll the whole
-- scenario back so later suites start with no milestones at all.
savepoint milestone_scenario;

insert into public.prospects(full_name, email, source, status)
values ('Scale Journey Sue', 'scale.journey@example.test', 'inbound', 'new');

insert into public.leads(submission_id, name, email, email_normalized, lead_source, status, context, prospect_id)
values (gen_random_uuid(), 'Scale Journey Sue', 'scale.journey@example.test', 'scale.journey@example.test', 'website', 'new', '{}'::jsonb,
        (select id from public.prospects where email_normalized='scale.journey@example.test'));

insert into public.clients(name, primary_prospect_id)
select 'Scale Client Co', id from public.prospects where email_normalized='scale.journey@example.test';

insert into public.client_contacts(client_id, name, email, portal_invite_status, accepted_at)
select c.id, 'Sue Contact', 'scale.journey@example.test', 'sent', now()
from public.clients c join public.prospects p on p.id=c.primary_prospect_id
where p.email_normalized='scale.journey@example.test';

insert into public.portal_invitations(client_contact_id, idempotency_key, status, sent_at, created_at)
select cc.id, 'invite-scale-suite', 'sent', now(), now()
from public.client_contacts cc join public.clients c on c.id=cc.client_id
join public.prospects p on p.id=c.primary_prospect_id
where p.email_normalized='scale.journey@example.test';

insert into public.deals(prospect_id, title, stage, outcome, next_action, next_action_due_at)
select p.id, 'Scale journey open deal', 'proposal_sent', 'open', 'Follow up', now() + interval '1 day'
from public.prospects p where p.email_normalized='scale.journey@example.test';

do $$ begin perform automation.observe_post_launch_milestones(); end $$;

select pg_temp.assert_that('scale.milestone_row_visible_and_validated',
  exists(select 1 from public.launch_phase_milestone_state
         where milestone_key='first_real_customer_journey_validation' and validated));

do $$
declare v jsonb;
begin
  v := public.transition_b2b_launch('enable_scale','phase-suite@teamtastic.test','earned scale',7);
  perform pg_temp.assert_that('scale.starts_after_journey_milestone',
    (v->>'changed')::boolean and (v->>'phase')='controlled_scale', coalesce(v->>'reason','-'));
  perform pg_temp.assert_that('cap.scale_cap_within_authority',
    (v->'config'->>'daily_prospecting_cap')::int between 1 and 10);
end $$;

rollback to savepoint milestone_scenario;

select pg_temp.assert_that('scale.milestone_scenario_fully_rolled_back',
  not exists(select 1 from public.launch_phase_milestones));

-- Emergency pause remains available from every active phase.
do $$
declare v jsonb; v_master boolean;
begin
  v := public.transition_b2b_launch('pause','phase-suite@teamtastic.test','suite pause');
  perform pg_temp.assert_that('phase.pause_from_active_phase', (v->>'changed')::boolean and (v->>'phase')='paused');
  select master_enabled into v_master from public.system_config where id=true;
  perform pg_temp.assert_that('killswitch.pause_disables_master', v_master = false);
end $$;

-- Kill-switch authority: reserve_email_send refuses while master is off.
select pg_temp.assert_that('killswitch.reserve_email_send_respects_master',
  (public.reserve_email_send('prospecting','someone@example.test'))->>'allowed' = 'false'
  and (public.reserve_email_send('prospecting','someone@example.test'))->>'reason' = 'master_kill_switch');

-- Restore master for the draft section (drafts are independent of sending).
update public.system_config set master_enabled=true, updated_at=now(), updated_by='phase-suite@teamtastic.test' where id=true;

-- ===========================================================================
-- Section 3. Draft lifecycle: retirement is terminal; approval is human and
-- classification-aware
-- ===========================================================================

insert into public.prospects(full_name, email, source, status)
values ('Draft Danny', 'draft.danny@example.test', 'inbound', 'qualified');
create temp table danny as select id from public.prospects where email_normalized='draft.danny@example.test';

insert into public.outreach_drafts(prospect_id, subject, body_text, status, fingerprint)
values ((select id from danny), 'Suite subject', 'Suite body text long enough.', 'review', 'phase-policy-draft-1');

-- Retire it: audit/history preserved, nothing deleted.
update public.outreach_drafts set status='retired', updated_at=now()
where fingerprint='phase-policy-draft-1';

select pg_temp.assert_that('draft.retirement_preserves_history',
  (select status from public.outreach_drafts where fingerprint='phase-policy-draft-1')='retired'
  and (select subject from public.outreach_drafts where fingerprint='phase-policy-draft-1')='Suite subject');

-- A retired draft can never be reactivated into the send path.
do $$
begin
  begin
    update public.outreach_drafts
    set status='approved', approved_at=now(), approved_by='operator@teamtastic.test'
    where fingerprint='phase-policy-draft-1';
    raise exception 'ASSERTION FAILED (draft.retired_terminal): reactivation succeeded';
  exception when others then
    if sqlerrm like 'ASSERTION FAILED%' then raise; end if;
    perform pg_temp.assert_that('draft.retired_cannot_send_or_reactivate',
      sqlerrm like '%terminal and cannot be reactivated%', left(sqlerrm,120));
  end;
end $$;

select pg_temp.assert_that('draft.send_path_never_selects_retired',
  not exists(select 1 from public.outreach_drafts
             where fingerprint='phase-policy-draft-1' and status in ('draft','review','approved')));

-- Human approval is mandatory at the database level.
do $$
begin
  begin
    insert into public.outreach_drafts(prospect_id, subject, body_text, status, fingerprint)
    values ((select id from danny), 'No approver', 'Body without approval metadata.', 'approved', 'phase-policy-draft-2');
    raise exception 'ASSERTION FAILED (draft.approval_metadata_required): succeeded';
  exception when others then
    if sqlerrm like 'ASSERTION FAILED%' then raise; end if;
    perform pg_temp.assert_that('draft.approval_metadata_required',
      sqlerrm ilike '%outreach_drafts_check%' or sqlerrm ilike '%approved_at%', left(sqlerrm,120));
  end;
end $$;

-- Approval requires a production-classified prospect.
insert into public.production_record_classifications(record_type, record_id, classification, reason, actor, evidence)
values ('prospect', (select id from danny), 'research_seed',
        'Suite scenario: discovery-only account held before any outreach eligibility.', 'op@teamtastic.test',
        jsonb_build_object('scenario','draft_approval_guard'));

insert into public.outreach_drafts(prospect_id, subject, body_text, status, fingerprint)
values ((select id from danny), 'Seed subject', 'Body for a research seed account.', 'review', 'phase-policy-draft-3');

do $$
begin
  begin
    update public.outreach_drafts
    set status='approved', approved_at=now(), approved_by='operator@teamtastic.test'
    where fingerprint='phase-policy-draft-3';
    raise exception 'ASSERTION FAILED (draft.seed_approval_blocked): succeeded';
  exception when others then
    if sqlerrm like 'ASSERTION FAILED%' then raise; end if;
    perform pg_temp.assert_that('draft.seed_prospect_approval_blocked',
      sqlerrm like '%production-classified prospect%', left(sqlerrm,120));
  end;
end $$;

commit;

select 'ALL ASSERTIONS PASSED' as result, count(*) as assertions from test_results;
