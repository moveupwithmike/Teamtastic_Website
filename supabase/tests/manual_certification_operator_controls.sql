-- Manual certification operator controls — regression suite.
-- Covers: portal/journey lineage integrity, synthetic lead notification
-- suppression across legacy boundaries, sign-off concurrency authority,
-- evidence immutability, and service-role surface restrictions.
--
-- Run via supabase/tests/run_manual_certification_tests.sh (needs the schema
-- dump + local stubs). Every assertion raises on failure; reaching the final
-- summary means every assertion passed.
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
-- Shared fixtures
-- ===========================================================================

insert into public.__test_vault_secrets(name, decrypted_secret) values
  ('lead_notification_function_url', 'https://edge.internal/notify-new-lead'),
  ('lead_notification_webhook_secret', 'stub-secret');

insert into public.conversion_health_runs(status, started_at, completed_at)
values ('healthy', now() - interval '2 hours', now() - interval '1 hour');

insert into public.mailbox_sync_state(mailbox, status, last_synced_at)
values ('mailbox@teamtastic.test', 'healthy', now() - interval '10 minutes')
on conflict (mailbox) do update set status = 'healthy', updated_at = now(), last_synced_at = now();

-- Certification A with two parallel candidate journeys (client A and client B)
-- so cross-record binding failures are proven rejections of the bypass itself,
-- not accidents of a missing second journey.
insert into public.final_production_certifications(started_by, preflight_evidence, known_limitations)
values ('operator@teamtastic.test', '{}'::jsonb, '[]'::jsonb);

update public.final_production_certifications
set started_at = now() - interval '30 hours',
    observation_ends_at = now() - interval '6 hours'
where started_by = 'operator@teamtastic.test';

create temp table cert_a as
  select id from public.final_production_certifications where started_by = 'operator@teamtastic.test';

-- Journey A
insert into public.prospects(full_name, email, source, status)
values ('Alice Realjourney', 'alice.journey@example.test', 'inbound', 'new');
create temp table prospect_a as select id from public.prospects where email_normalized='alice.journey@example.test';

insert into public.leads(submission_id, name, email, email_normalized, lead_source, status, context, prospect_id, created_at)
values (gen_random_uuid(), 'Alice Realjourney', 'alice.journey@example.test', 'alice.journey@example.test',
        'website', 'new', '{}'::jsonb, (select id from prospect_a), now() - interval '28 hours');

insert into public.clients(name, primary_prospect_id)
select 'Client A Holdings', id from prospect_a;
create temp table client_a as
  select c.id from public.clients c join public.prospects p on p.id=c.primary_prospect_id
  where p.email_normalized='alice.journey@example.test';

insert into public.client_contacts(client_id, name, email, portal_invite_status, accepted_at)
select id, 'Alice Contact', 'alice.journey@example.test', 'sent', now() - interval '20 hours' from client_a;
create temp table contact_a as select cc.id from public.client_contacts cc join client_a on client_a.id=cc.client_id;

insert into public.portal_invitations(client_contact_id, idempotency_key, status, sent_at, created_at)
select id, 'invite-a-stub', 'sent', now() - interval '21 hours', now() - interval '22 hours' from contact_a;
create temp table invitation_a as select pi.id from public.portal_invitations pi join contact_a on contact_a.id=pi.client_contact_id;

insert into public.deals(prospect_id, title, stage, outcome, next_action, next_action_due_at)
select id, 'Client A open deal', 'proposal_sent', 'open', 'Follow up', now() + interval '1 day' from prospect_a;

-- Journey B (parallel candidate; invitation sent but NOT accepted).
insert into public.prospects(full_name, email, source, status)
values ('Bob Otherclient', 'bob.other@example.test', 'inbound', 'new');
create temp table prospect_b as select id from public.prospects where email_normalized='bob.other@example.test';

insert into public.leads(submission_id, name, email, email_normalized, lead_source, status, context, prospect_id, created_at)
values (gen_random_uuid(), 'Bob Otherclient', 'bob.other@example.test', 'bob.other@example.test',
        'website', 'new', '{}'::jsonb, (select id from prospect_b), now() - interval '27 hours');

insert into public.clients(name, primary_prospect_id)
select 'Client B Industries', id from prospect_b;
create temp table client_b as
  select c.id from public.clients c join public.prospects p on p.id=c.primary_prospect_id
  where p.email_normalized='bob.other@example.test';

insert into public.client_contacts(client_id, name, email, portal_invite_status)
select id, 'Bob Contact', 'bob.other@example.test', 'sent' from client_b;
create temp table contact_b as select cc.id from public.client_contacts cc join client_b on client_b.id=cc.client_id;

insert into public.portal_invitations(client_contact_id, idempotency_key, status, sent_at, created_at)
select id, 'invite-b-stub', 'sent', now() - interval '18 hours', now() - interval '19 hours' from contact_b;
create temp table invitation_b as select pi.id from public.portal_invitations pi join contact_b on contact_b.id=pi.client_contact_id;

insert into public.deals(prospect_id, title, stage, outcome, next_action, next_action_due_at)
select id, 'Client B open deal', 'proposal_sent', 'open', 'Follow up', now() + interval '1 day' from prospect_b;

-- Canonical lineage resolves to journey A (earliest invitation created).
do $$
declare v record;
begin
  select * into v from automation.final_certification_journey_lineage((select id from cert_a));
  perform pg_temp.assert_that('lineage.canonical_is_client_a',
    v.client_id = (select id from client_a), format('resolved client %s', v.client_id));
  perform pg_temp.assert_that('lineage.resolves_valid',
    v.lineage_valid and v.invitation_status = 'sent'
    and exists(select 1 from public.client_contacts cc where cc.id = v.contact_id and cc.accepted_at is not null));
end $$;

-- ===========================================================================
-- Section 1. Journey gates retired pre-launch; post-launch milestone owns
-- the first genuine customer journey
-- ===========================================================================

-- 1a. The two circular journey gates no longer exist as pre-launch
-- requirements: caller evidence for them is rejected outright.
do $$
begin
  begin
    perform public.record_final_certification_evidence(
      (select id from cert_a), 'client_portal_access', 'passed',
      'office://portal/client-a-access-verified', 'Operator Person',
      'Verified real client portal access end to end for this certification.',
      'manual', 'production', jsonb_build_object('client_id', (select id from client_a)));
    raise exception 'ASSERTION FAILED (journey.portal_gate_retired): bypass succeeded';
  exception
    when others then
      if sqlerrm like 'ASSERTION FAILED%' then raise; end if;
      perform pg_temp.assert_that('journey.portal_gate_retired', sqlerrm like '%Unsupported certification check%', left(sqlerrm, 120));
  end;

  begin
    perform public.record_final_certification_evidence(
      (select id from cert_a), 'real_lead_client_journey', 'passed',
      'office://journey/client-a-verified', 'Operator Person',
      'Attested a real lead-to-client progression for this certification.',
      'manual', 'production', jsonb_build_object('client_id', (select id from client_a)));
    raise exception 'ASSERTION FAILED (journey.progression_gate_retired): bypass succeeded';
  exception
    when others then
      if sqlerrm like 'ASSERTION FAILED%' then raise; end if;
      perform pg_temp.assert_that('journey.progression_gate_retired', sqlerrm like '%Unsupported certification check%', left(sqlerrm, 120));
  end;
end $$;

-- 1b. The post-launch milestone subsystem starts pending: nothing may claim
-- a customer journey that does not genuinely exist in authoritative records.
select pg_temp.assert_that('milestone.pending_before_any_genuine_journey',
  not exists(select 1 from public.launch_phase_milestone_state
             where milestone_key='first_real_customer_journey_validation' and validated)
  and not exists(select 1 from public.launch_phase_milestones));

do $$ begin perform automation.observe_post_launch_milestones(); end $$;
do $$ begin perform automation.observe_post_launch_milestones(); end $$;

-- Alice's journey IS genuine production: accepted portal contact, open deal,
-- production classifications. The observer detects and pins it automatically;
-- callers supply nothing.
do $$
declare v_state record; v_lineage record;
begin
  perform automation.observe_post_launch_milestones();

  select * into v_state from public.launch_phase_milestone_state
   where milestone_key='first_real_customer_journey_validation';

  select * into v_lineage from automation.final_certification_journey_lineage((select id from cert_a));

  perform pg_temp.assert_that('milestone.validated_automatically',
    v_state.validated and not v_state.invalidated);
  perform pg_temp.assert_that('milestone.bound_to_canonical_client',
    v_state.client_id = (select id from client_a) and v_state.client_id = v_lineage.client_id);
  perform pg_temp.assert_that('milestone.binds_full_chain',
    v_state.lead_id is not null and v_state.prospect_id is not null
    and v_state.contact_id is not null and v_state.portal_invitation_id is not null);
  perform pg_temp.assert_that('milestone.evidence_records_acceptance_authority',
    v_state.evidence->>'portal_acceptance_authority' = 'client_contacts.accepted_at');
end $$;

-- Component milestones bind to the SAME canonical client.
select pg_temp.assert_that('milestone.components_share_client',
  (select client_id from public.launch_phase_milestone_state where milestone_key='first_real_client')
    = (select client_id from public.launch_phase_milestone_state where milestone_key='first_real_customer_journey_validation'));

-- 1c. Current-world revalidation: reclassifying the bound account away from
-- production immediately stops the milestone reporting validated - while its
-- immutable history row is preserved.
insert into public.production_record_classifications(record_type, record_id, classification, reason, actor, evidence)
values ('prospect', (select id from prospect_a), 'research_seed',
        'Suite scenario: account demoted to research seed pending verified-interest re-review.', 'operator@teamtastic.test',
        jsonb_build_object('scenario', 'milestone_invalidation'));

do $$
declare v_state record;
begin
  select * into v_state from public.launch_phase_milestone_state
   where milestone_key='first_real_customer_journey_validation';
  perform pg_temp.assert_that('milestone.invalidated_when_world_changes',
    v_state.achieved and not v_state.validated and v_state.invalidated,
    format('achieved=%s validated=%s', v_state.achieved, v_state.validated));
end $$;

-- Immutable history survives the invalidation.
select pg_temp.assert_that('milestone.history_row_immutable_and_present',
  exists(select 1 from public.launch_phase_milestones
         where milestone_key='first_real_customer_journey_validation'));

do $$
begin
  begin
    update public.launch_phase_milestones set observed_by='tampered' where milestone_key='first_real_engaged_lead';
    raise exception 'ASSERTION FAILED (milestone.update_blocked): succeeded';
  exception when others then
    if sqlerrm like 'ASSERTION FAILED%' then raise; end if;
    perform pg_temp.assert_that('milestone.update_blocked', sqlerrm like '%append-only and immutable%', left(sqlerrm,120));
  end;
end $$;

-- Trusted promotion is the ONLY sanctioned way back into the lifecycle, and
-- it restores current-world validity immediately.
do $$
declare v_result jsonb; v_validated boolean;
begin
  v_result := automation.promote_research_seed_to_production(
    (select id from prospect_a),
    'Operator Person',
    'Human review confirmed genuine inbound interest and payment history for this account.',
    jsonb_build_object('reviewed_invoice', true));
  perform pg_temp.assert_that('promotion.trusted_workflow_succeeds', (v_result->>'promoted')::boolean);

  select validated into v_validated from public.launch_phase_milestone_state
   where milestone_key='first_real_customer_journey_validation';
  perform pg_temp.assert_that('milestone.revalidates_after_promotion', v_validated);
end $$;

do $$
begin
  begin
    perform automation.promote_research_seed_to_production(
      (select id from prospect_b), 'automation', 'Automated actors can never promote records into the production lifecycle.', '{}');
    raise exception 'ASSERTION FAILED (promotion.named_actor_required): succeeded';
  exception when others then
    if sqlerrm like 'ASSERTION FAILED%' then raise; end if;
    perform pg_temp.assert_that('promotion.named_actor_required', sqlerrm like '%named human actor%', left(sqlerrm,120));
  end;

  begin
    perform automation.promote_research_seed_to_production(
      (select id from prospect_b), 'Operator Person', 'too short', '{}');
    raise exception 'ASSERTION FAILED (promotion.reason_required): succeeded';
  exception when others then
    if sqlerrm like 'ASSERTION FAILED%' then raise; end if;
    perform pg_temp.assert_that('promotion.reason_required', sqlerrm like '%evidentiary reason%', left(sqlerrm,120));
  end;

  begin
    perform automation.promote_research_seed_to_production(
      (select id from prospect_b), 'Operator Person',
      'Prospect B was never a research seed, so promotion must be rejected here.', '{}');
    raise exception 'ASSERTION FAILED (promotion.only_from_seed): succeeded';
  exception when others then
    if sqlerrm like 'ASSERTION FAILED%' then raise; end if;
    perform pg_temp.assert_that('promotion.only_from_seed', sqlerrm like '%not classified research_seed%', left(sqlerrm,120));
  end;
end $$;

-- 1d. A fully synthetic journey can never satisfy the post-launch milestone.
insert into public.final_production_certifications(started_by, preflight_evidence, known_limitations)
values ('synthetic-check@teamtastic.test', '{}'::jsonb, '[]'::jsonb);
update public.final_production_certifications
set started_at = now() - interval '26 hours', observation_ends_at = now() - interval '2 hours'
where started_by = 'synthetic-check@teamtastic.test';
create temp table cert_syn as select id from public.final_production_certifications where started_by='synthetic-check@teamtastic.test';

insert into public.prospects(full_name, email, source, status, metadata)
values ('Cert Buyer Synthetic', 'cert.synthetic@example.test', 'inbound', 'new',
        jsonb_build_object('synthetic_test', true));
create temp table prospect_syn as select id from public.prospects where email_normalized='cert.synthetic@example.test';

insert into public.leads(submission_id, name, email, email_normalized, lead_source, status, context, prospect_id, created_at)
values (gen_random_uuid(), 'Cert Buyer Synthetic', 'cert.synthetic@example.test', 'cert.synthetic@example.test',
        'holiday_party_money_page', 'new',
        jsonb_build_object('synthetic_test', true, 'certification_run_id', (select id from cert_syn)),
        (select id from prospect_syn), now() - interval '25 hours');

insert into public.clients(name, primary_prospect_id) select 'Synthetic Client', id from prospect_syn;
create temp table client_syn as
  select c.id from public.clients c join public.prospects p on p.id=c.primary_prospect_id
  where p.email_normalized='cert.synthetic@example.test';
insert into public.client_contacts(client_id, name, email, accepted_at)
select id, 'Synthetic Contact', 'cert.synthetic@example.test', now() from client_syn;
create temp table contact_syn as select cc.id from public.client_contacts cc join client_syn on client_syn.id=cc.client_id;
insert into public.portal_invitations(client_contact_id, idempotency_key, status, sent_at, created_at)
select id, 'invite-syn-stub', 'sent', now(), now() from contact_syn;

-- The holiday SLA trigger auto-creates the open progression deal for this
-- synthetic capture path; no manual deal insert is needed here.

do $$
declare v_canonical record; v_state record;
begin
  perform automation.observe_post_launch_milestones();

  select * into v_canonical from automation.first_production_customer_journey();
  perform pg_temp.assert_that('milestone.synthetic_journey_excluded',
    v_canonical.lead_id is null or v_canonical.client_id <> (select id from client_syn));

  select * into v_state from public.launch_phase_milestone_state
   where milestone_key='first_real_customer_journey_validation';
  perform pg_temp.assert_that('milestone.still_bound_to_genuine_journey',
    v_state.validated and v_state.client_id = (select id from client_a));
end $$;

-- 1e. Evidence metadata pointing at another certification is rejected.
do $$
begin
  begin
    perform public.record_final_certification_evidence(
      (select id from cert_a), 'operational_owner_attestation', 'passed',
      'office://owner/cross-cert-attempt', 'Operator Person',
      'Named operational owner accepted accountability for launch operations.',
      'manual', 'production',
      jsonb_build_object('certification_id', (select id from cert_syn)));
    raise exception 'ASSERTION FAILED (portal.other_certification_rejected): succeeded';
  exception
    when others then
      if sqlerrm like 'ASSERTION FAILED%' then raise; end if;
      perform pg_temp.assert_that('portal.other_certification_rejected', sqlerrm like '%different certification%', left(sqlerrm,120));
  end;
end $$;

-- 1f. Manual gates reject automated-method evidence.
do $$
begin
  begin
    perform public.record_final_certification_evidence(
      (select id from cert_a), 'office_access_verified', 'passed',
      'office://auth/session-verified-ok', 'Operator Person',
      'Authenticated sales office access verified in a production browser.',
      'automated', 'production', '{}'::jsonb);
    raise exception 'ASSERTION FAILED (gate.manual_method_required): succeeded';
  exception
    when others then
      if sqlerrm like 'ASSERTION FAILED%' then raise; end if;
      perform pg_temp.assert_that('gate.manual_method_required', sqlerrm like '%method does not match%', left(sqlerrm,120));
  end;
end $$;

-- 1g. Final sign-off cannot be smuggled through the evidence RPC.
do $$
begin
  begin
    perform public.record_final_certification_evidence(
      (select id from cert_a), 'final_named_signoff', 'passed',
      'office://final-certification/self', 'Operator Person',
      'Self-approved sign-off attempt through the evidence recording path.',
      'manual', 'production', '{}'::jsonb);
    raise exception 'ASSERTION FAILED (signoff.rpc_guard): succeeded';
  exception
    when others then
      if sqlerrm like 'ASSERTION FAILED%' then raise; end if;
      perform pg_temp.assert_that('signoff.rpc_guard', sqlerrm like '%named sign-off RPC%', left(sqlerrm,120));
  end;
end $$;

-- ===========================================================================
-- Section 2. Synthetic leads vs legacy notification delivery
-- ===========================================================================

truncate public.__test_net_calls;

-- 2a. Real production lead keeps normal delivery behavior: queued rows plus
-- an outbound dispatch attempt to the notification worker.
insert into public.prospects(full_name, email, source, status)
values ('Real Customer Rita', 'rita.real@example.test', 'inbound', 'new');
create temp table prospect_rita as select id from public.prospects where email_normalized='rita.real@example.test';

insert into public.leads(submission_id, name, email, email_normalized, lead_source, status, prospect_id)
values (gen_random_uuid(), 'Real Customer Rita', 'rita.real@example.test', 'rita.real@example.test', 'event_quiz', 'new',
        (select id from prospect_rita));

select pg_temp.assert_that('notify.real_lead_enqueued_and_dispatched',
  (select count(*) from public.notification_deliveries d
     join public.leads l on l.id=d.lead_id
    where l.email_normalized='rita.real@example.test' and d.status='pending') = 2
  and (select count(*) from public.__test_net_calls) >= 1,
  format('calls=%s', (select count(*) from public.__test_net_calls)));

-- 2b. Certification lead (native synthetic marker at creation time) is fully
-- suppressed at the trigger boundary: auditable rows, zero dispatch attempts.
truncate public.__test_net_calls;

insert into public.b2b_certification_runs(started_by) values ('operator@teamtastic.test');
create temp table b2b_run as select id from public.b2b_certification_runs order by created_at desc limit 1;

insert into public.leads(submission_id, name, email, email_normalized, lead_source, status, context)
values (gen_random_uuid(), 'Certification Buyer One', 'cert+runner1@example.com', 'cert+runner1@example.com', 'holiday_party_money_page', 'new',
        jsonb_build_object('synthetic_test', true, 'certification_run_id', (select id from b2b_run)));

select pg_temp.assert_that('notify.certification_lead_suppressed_at_trigger',
  (select count(*) from public.notification_deliveries d
     join public.leads l on l.id=d.lead_id
    where l.email_normalized='cert+runner1@example.com' and d.status='test_suppressed') = 2
  and (select count(*) from public.__test_net_calls) = 0,
  format('calls=%s', (select count(*) from public.__test_net_calls)));

-- 2c. Legacy create-now-classify-later window: a clean lead is queued, then
-- the operator classifies it test_qa. Queued rows must flip to suppression
-- and the retry worker must not dispatch them.
insert into public.leads(submission_id, name, email, email_normalized, lead_source, status)
values (gen_random_uuid(), 'Later Classified Lou', 'lou.late@example.test', 'lou.late@example.test', 'website', 'new');

select pg_temp.assert_that('notify.late_lead_initially_queued',
  (select count(*) from public.notification_deliveries d
     join public.leads l on l.id=d.lead_id
    where l.email_normalized='lou.late@example.test' and d.status='pending') = 2);

truncate public.__test_net_calls;

insert into public.production_record_classifications(record_type, record_id, classification, reason, actor, evidence)
select 'lead', l.id, 'test_qa', 'Manual certification form submission confirmed as browser test residue.', 'operator@teamtastic.test',
       jsonb_build_object('owner_confirmed_test', true)
from public.leads l where l.email_normalized='lou.late@example.test';

select public.retry_pending_lead_notifications();

select pg_temp.assert_that('notify.late_classification_suppresses_queue',
  (select count(*) from public.notification_deliveries d
     join public.leads l on l.id=d.lead_id
    where l.email_normalized='lou.late@example.test' and d.status='pending') = 0
  and (select count(*) from public.notification_deliveries d
     join public.leads l on l.id=d.lead_id
    where l.email_normalized='lou.late@example.test' and d.status='test_suppressed') = 2
  and not exists(
        select 1 from public.__test_net_calls c
        where c.body->>'lead_id' = (select l.id::text from public.leads l where l.email_normalized='lou.late@example.test')),
  format('lou_calls=%s',
    (select count(*) from public.__test_net_calls c
     where c.body->>'lead_id' = (select l.id::text from public.leads l where l.email_normalized='lou.late@example.test'))));

-- 2d. Late synthetic flag arriving via a context UPDATE sweeps the queue too.
insert into public.leads(submission_id, name, email, email_normalized, lead_source, status)
values (gen_random_uuid(), 'Flagged Later Fay', 'fay.flagged@example.test', 'fay.flagged@example.test', 'website', 'new');

update public.leads
set context = jsonb_build_object('synthetic_test', true, 'certification_run_id', (select id from b2b_run))
where email_normalized='fay.flagged@example.test';

select pg_temp.assert_that('notify.context_flag_update_suppresses_queue',
  (select count(*) from public.notification_deliveries d
     join public.leads l on l.id=d.lead_id
    where l.email_normalized='fay.flagged@example.test' and d.status='test_suppressed') = 2);

-- 2e. Mixed/unresolved prospect provenance fails closed for further leads.
insert into public.production_record_classifications(record_type, record_id, classification, reason, actor, evidence)
values ('prospect', (select id from prospect_rita), 'unresolved',
        'Conflicting signals across linked records require human resolution.', 'operator@teamtastic.test',
        '{}'::jsonb);

insert into public.leads(submission_id, name, email, email_normalized, lead_source, status, prospect_id)
values (gen_random_uuid(), 'Rita Second Contact', 'rita.second@example.test', 'rita.second@example.test', 'website', 'new',
        (select id from prospect_rita));

select pg_temp.assert_that('notify.unresolved_prospect_fails_closed',
  (select count(*) from public.notification_deliveries d
     join public.leads l on l.id=d.lead_id
    where l.email_normalized='rita.second@example.test' and d.status='test_suppressed') = 2);

-- Restore Rita's prospect so nothing downstream sees unresolved lineage.
insert into public.production_record_classifications(record_type, record_id, classification, reason, actor, evidence)
values ('prospect', (select id from prospect_rita), 'production',
        'Human review completed: verified genuine customer with matching history.', 'operator@teamtastic.test',
        jsonb_build_object('reviewed_as_production', true));

-- 2f. Classification decides — never names or emails. A realistic
-- "cert-looking" submission without markers stays on the normal path; an
-- innocuous-named lead with a test_qa ledger entry is suppressed.
insert into public.leads(submission_id, name, email, email_normalized, lead_source, status)
values (gen_random_uuid(), 'Certification Buyer Two', 'cert+lookalike@example.com', 'cert+lookalike@example.com', 'holiday_party_money_page', 'new');

select pg_temp.assert_that('notify.name_pattern_does_not_block',
  (select count(*) from public.notification_deliveries d
     join public.leads l on l.id=d.lead_id
    where l.email_normalized='cert+lookalike@example.com' and d.status='pending') = 2);

insert into public.production_record_classifications(record_type, record_id, classification, reason, actor, evidence)
select 'lead', l.id, 'test_qa', 'Duplicate QA fixture identified during launch hygiene review sweep.', 'operator@teamtastic.test',
       jsonb_build_object('linked_test_classification', true)
from public.leads l where l.email_normalized='cert+lookalike@example.com';

select pg_temp.assert_that('notify.ledger_blocks_regardless_of_name',
  (select count(*) from public.notification_deliveries d
     join public.leads l on l.id=d.lead_id
    where l.email_normalized='cert+lookalike@example.com' and d.status='test_suppressed') = 2);

-- 2g. research_seed provenance fails closed at the delivery boundary too:
-- leads under a seed account are suppressed, never dispatched.
insert into public.production_record_classifications(record_type, record_id, classification, reason, actor, evidence)
values ('prospect', (select id from prospect_rita), 'research_seed',
        'Suite scenario: demoted to research seed while interest is re-verified by a human reviewer.', 'operator@teamtastic.test',
        jsonb_build_object('scenario', 'research_seed_suppression'));

insert into public.leads(submission_id, name, email, email_normalized, lead_source, status, prospect_id)
values (gen_random_uuid(), 'Rita Seed Contact', 'rita.seed@example.test', 'rita.seed@example.test', 'website', 'new',
        (select id from prospect_rita));

select pg_temp.assert_that('notify.research_seed_prospect_fails_closed',
  (select count(*) from public.notification_deliveries d
     join public.leads l on l.id=d.lead_id
    where l.email_normalized='rita.seed@example.test' and d.status='test_suppressed') = 2);

insert into public.production_record_classifications(record_type, record_id, classification, reason, actor, evidence)
values ('prospect', (select id from prospect_rita), 'production',
        'Human review completed: verified genuine customer with matching history.', 'operator@teamtastic.test',
        jsonb_build_object('reviewed_as_production', true));

-- ===========================================================================
-- Section 3. Sign-off concurrency, immutability, and authority
-- ===========================================================================

-- Build certification A to full pre-launch readiness using authoritative
-- writers. No customer journey is required anymore: the journey gates are
-- post-launch milestones now.

-- Nine automated gates that need only a canonical execution key.
do $$
declare c text;
begin
  foreach c in array array['automated_tests_passed','production_build_passed','stripe_verified','scheduled_automations_verified','controlled_load_passed','chromium_public_lead_form','firefox_public_lead_form','mobile_viewport_basics','server_confirmed_lead_persistence']
  loop
    perform automation.record_automated_certification_result(
      (select id from cert_a), c, 'passed', 'ci://run/stub-'||c,
      'Stubbed canonical runner result captured by the regression suite.',
      '{}'::jsonb, now(), 'execution', now(), null, 'suite:'||c);
  end loop;
end $$;

-- Email gates require correlated signed provider evidence scoped to the cert.
insert into public.email_delivery_evidence(provider_message_id, evidence_stage, evidence_source, source_event_id, evidence_reference, observed_at, recorded_by, metadata)
values ('pm-cert-suite-1', 'api_accepted', 'resend_api', 'evt-accept-1', 'resend://accepted/pm-cert-suite-1', now() - interval '3 hours', 'automation:final-certification',
        jsonb_build_object('certification_id', (select id from cert_a), 'recipient_classification', 'teamtastic_owned_test_mailbox',
                           'execution_id', 'exec-suite-1', 'sender_identity', 'hello@teamtastic.events', 'provider_acceptance_result', 'accepted')),
       ('pm-cert-suite-1', 'provider_delivered', 'resend_webhook', 'evt-deliver-1', 'resend://delivered/pm-cert-suite-1', now() - interval '3 hours' + interval '4 seconds', 'automation:final-certification',
        jsonb_build_object('certification_id', (select id from cert_a)));

do $$
begin
  perform automation.record_automated_certification_result((select id from cert_a),'email_api_accepted','passed','provider://stub','Resend accepted a certification-scoped message.','{}'::jsonb,now(),'execution',now(),null,'suite:email_api_accepted');
  perform automation.record_automated_certification_result((select id from cert_a),'email_provider_delivered','passed','provider://stub','Signed webhook delivered the certification-scoped message.','{}'::jsonb,now(),'execution',now(),null,'suite:email_provider_delivered');
  perform automation.record_automated_certification_result((select id from cert_a),'authenticated_email_delivery','passed','provider://stub','Authenticated SMTP delivery verified for the controlled mailbox.','{}'::jsonb,now(),'execution',now(),null,'suite:authenticated_email_delivery');
end $$;

-- Booking gate requires a qualifying synthetic certification booking record.
insert into public.booking_types(slug, name, duration_minutes, active)
values ('suite-cert-type', 'Suite certification booking', 60, true);

insert into public.bookings(booking_type_id, prospect_id, name, email, visitor_timezone, starts_at, ends_at,
                            blocked_starts_at, blocked_ends_at, status, manage_token_hash, source, context)
select bt.id, ps.id, 'Teamtastic Certification', 'cert.mailbox@teamtastic.test', 'America/New_York',
       now() - interval '4 hours', now() - interval '3 hours',
       now() - interval '4 hours', now() - interval '3 hours',
       'completed', md5(random()::text), 'final_certification',
       jsonb_build_object('synthetic_test', true, 'certification_id', (select id from cert_a),
                          'execution_key', 'suite-booking-1', 'recipient_classification', 'teamtastic_owned_test_mailbox')
from public.booking_types bt cross join prospect_syn ps
where bt.slug='suite-cert-type';

do $$ begin
  perform automation.record_automated_certification_result((select id from cert_a),'booking_workflow','passed','booking://stub','Certification booking exercised native persistence safely.','{}'::jsonb,now(),'execution',now(),null,'suite:booking_workflow');
end $$;

-- Manual gates (9 before sign-off). calendar_zoom_workflow is now decoupled
-- from live customer lineage: it records as a named-operator verification
-- without any journey metadata.
do $$
declare m text;
begin
  foreach m in array array['office_access_verified','security_advisors_reviewed','safari_public_lead_form','turnstile_success_behavior','turnstile_rejection_behavior','email_mailbox_receipt','real_inbox_placement','calendar_zoom_workflow','operational_owner_attestation']
  loop
    perform public.record_final_certification_evidence(
      (select id from cert_a), m, 'passed', 'office://manual/suite-'||m, 'Operator Person',
      'Named operator verified this gate directly in production during the suite.',
      'manual', 'production', '{}'::jsonb);
  end loop;
end $$;

-- 3a. With every pre-launch gate satisfied - and NO real-customer-journey
-- requirement - readiness upgrades; sign-off succeeds and records the exact
-- certified state snapshot.
do $$
declare v_status text; v_milestone_validated boolean;
begin
  perform automation.observe_final_production_certifications();
  select status into v_status from public.final_production_certifications where id=(select id from cert_a);
  perform pg_temp.assert_that('signoff.ready_after_full_gates', v_status = 'ready_for_signoff', v_status);

  -- The genuine Alice journey exists, so the post-launch milestone is already
  -- validated - but that state is informational here, never a prerequisite.
  select validated into v_milestone_validated from public.launch_phase_milestone_state
    where milestone_key='first_real_customer_journey_validation';
  perform pg_temp.assert_that('milestone.informational_during_signoff', v_milestone_validated);
end $$;

do $$
declare v_result jsonb;
begin
  v_result := public.sign_off_final_production_certification((select id from cert_a), 'Michael Scott');
  perform pg_temp.assert_that('signoff.passes_with_named_actor', (v_result->>'passed')::boolean);
end $$;

do $$
declare v_row public.final_production_certifications%rowtype; v_gates int; v_all_satisfied boolean;
begin
  select * into v_row from public.final_production_certifications where id=(select id from cert_a);
  perform pg_temp.assert_that('signoff.records_actor_and_timestamp',
    v_row.signed_off_by='Michael Scott' and v_row.signed_off_at is not null and v_row.completed_at is not null);
  perform pg_temp.assert_that('signoff.records_state_snapshot', v_row.signed_off_state is not null and v_row.signed_off_state ? 'gates');
  select count(*) into v_gates from jsonb_array_elements(v_row.signed_off_state->'gates');
  perform pg_temp.assert_that('signoff.snapshot_has_all_23_prelaunch_gates', v_gates = 23, v_gates::text);
  perform pg_temp.assert_that('signoff.snapshot_records_policy_version', v_row.signed_off_state->>'policy_version' = 'v6.2-pre-launch');
  perform pg_temp.assert_that('signoff.snapshot_records_post_launch_state',
    v_row.signed_off_state ? 'post_launch_journey_state'
    and (v_row.signed_off_state->'post_launch_journey_state'->>'first_real_customer_journey_validation') is not null);
  select bool_and(g->>'satisfied'='true') into v_all_satisfied from jsonb_array_elements(v_row.signed_off_state->'gates') g;
  perform pg_temp.assert_that('signoff.snapshot_all_satisfied', coalesce(v_all_satisfied,false));
  perform pg_temp.assert_that('signoff.snapshot_records_evidence_version', v_row.signed_off_state ? 'evidence_version');
  perform pg_temp.assert_that('signoff.signoff_evidence_carries_snapshot',
    exists(select 1 from public.final_certification_evidence
           where certification_id=v_row.id and check_name='final_named_signoff'
             and metadata ? 'certified_state'));
end $$;

-- 3b. Evidence is immutable after sign-off.
do $$
begin
  begin
    update public.final_certification_evidence
    set notes='Tampered post-signoff evidence note.'
    where certification_id=(select id from cert_a) and check_name='office_access_verified';
    raise exception 'ASSERTION FAILED (immutable.update_blocked): update succeeded';
  exception when others then
    if sqlerrm like 'ASSERTION FAILED%' then raise; end if;
    perform pg_temp.assert_that('immutable.update_blocked', sqlerrm like '%immutable after final sign-off%', left(sqlerrm,120));
  end;

  begin
    delete from public.final_certification_evidence
    where certification_id=(select id from cert_a) and check_name='office_access_verified';
    raise exception 'ASSERTION FAILED (immutable.delete_blocked): delete succeeded';
  exception when others then
    if sqlerrm like 'ASSERTION FAILED%' then raise; end if;
    perform pg_temp.assert_that('immutable.delete_blocked', sqlerrm like '%immutable after final sign-off%', left(sqlerrm,120));
  end;

  begin
    insert into public.final_certification_evidence(certification_id,check_name,status,evidence_reference,performed_by,notes,evidence_method,environment)
    values ((select id from cert_a),'operational_owner_attestation','passed','office://late/addition','Late Adder','Post-signoff evidence addition should be impossible here.','manual','production');
    raise exception 'ASSERTION FAILED (immutable.insert_blocked): insert succeeded';
  exception when others then
    if sqlerrm like 'ASSERTION FAILED%' then raise; end if;
    perform pg_temp.assert_that('immutable.insert_blocked', sqlerrm like '%cannot be added after final sign-off%', left(sqlerrm,120));
  end;
end $$;

-- 3c. Duplicate sign-offs serialize safely: the loser fails without damage.
do $$
begin
  begin
    perform public.sign_off_final_production_certification((select id from cert_a), 'Dwight Schrute');
    raise exception 'ASSERTION FAILED (signoff.duplicate_rejected): second sign-off succeeded';
  exception when others then
    if sqlerrm like 'ASSERTION FAILED%' then raise; end if;
    perform pg_temp.assert_that('signoff.duplicate_rejected', sqlerrm like '%already signed off%', left(sqlerrm,120));
  end;
end $$;

-- 3d. Sign-off fields and snapshot are protected outside the RPC.
do $$
begin
  begin
    update public.final_production_certifications
    set signed_off_by='Forged Actor', signed_off_at=now(), signed_off_state='{"forged":true}'::jsonb
    where id=(select id from cert_syn);
    raise exception 'ASSERTION FAILED (signoff.fields_protected): direct write succeeded';
  exception when others then
    if sqlerrm like 'ASSERTION FAILED%' then raise; end if;
    perform pg_temp.assert_that('signoff.fields_protected', sqlerrm like '%protected%', left(sqlerrm,120));
  end;
end $$;

-- 3e. An incomplete certification cannot reach ready_for_signoff nor sign-off.
do $$
declare v_status text;
begin
  begin
    perform public.sign_off_final_production_certification((select id from cert_syn), 'Pam Beesly');
    raise exception 'ASSERTION FAILED (signoff.incomplete_rejected): incomplete sign-off succeeded';
  exception when others then
    if sqlerrm like 'ASSERTION FAILED%' then raise; end if;
    perform pg_temp.assert_that('signoff.incomplete_rejected', sqlerrm like '%not complete%', left(sqlerrm,120));
  end;

  select status into v_status from public.final_production_certifications where id=(select id from cert_syn);
  perform pg_temp.assert_that('signoff.incomplete_stays_running', v_status = 'running', v_status);
end $$;

-- 3f. Readiness downgrade enforcement: give the synthetic cert one automated
-- gate, expire it, then confirm the upgrade path refuses to report ready.
do $$
declare v_status text;
begin
  perform automation.record_automated_certification_result(
    (select id from cert_syn), 'automated_tests_passed', 'passed', 'ci://run/stub-expirable',
    'Expirable runner result used to exercise validity-based downgrade.',
    '{}'::jsonb, now(), 'execution', now(), now() + interval '1 hour', 'suite:expirable');

  update public.final_production_certifications set status='ready_for_signoff'
  where id=(select id from cert_syn)
    and exists(select 1 from public.final_certification_gate_status
               where certification_id=final_production_certifications.id and check_name='automated_tests_passed' and satisfied);

  update public.final_certification_evidence
  set valid_until = now() - interval '1 hour'
  where certification_id=(select id from cert_syn) and execution_key='suite:expirable';

  update public.final_production_certifications set status='ready_for_signoff'
  where id=(select id from cert_syn);

  select status into v_status from public.final_production_certifications where id=(select id from cert_syn);
  perform pg_temp.assert_that('readiness.downgrade_enforced', v_status = 'running', v_status);
end $$;

-- 3g. THE core policy regression: a certification whose ONLY missing piece
-- would once have been the real-customer journey now reaches ready_for_signoff
-- and passes with every remaining pre-launch gate satisfied. The synthetic
-- journey (even with an accepted portal contact) never satisfies the
-- post-launch milestone, which stays bound to the genuine journey.
do $$
declare c text; m text; v_status text; v_result jsonb; v_row public.final_production_certifications%rowtype; v_state record;
begin
  -- Correlated signed provider evidence scoped to this certification.
  insert into public.email_delivery_evidence(provider_message_id, evidence_stage, evidence_source, source_event_id, evidence_reference, observed_at, recorded_by, metadata)
  values ('pm-cert-syn-1', 'api_accepted', 'resend_api', 'evt-syn-accept-1', 'resend://accepted/pm-cert-syn-1', now() - interval '3 hours', 'automation:final-certification',
          jsonb_build_object('certification_id', (select id from cert_syn), 'recipient_classification', 'teamtastic_owned_test_mailbox',
                             'execution_id', 'exec-syn-1', 'sender_identity', 'hello@teamtastic.events', 'provider_acceptance_result', 'accepted')),
         ('pm-cert-syn-1', 'provider_delivered', 'resend_webhook', 'evt-syn-deliver-1', 'resend://delivered/pm-cert-syn-1', now() - interval '3 hours' + interval '4 seconds', 'automation:final-certification',
          jsonb_build_object('certification_id', (select id from cert_syn)));

  foreach c in array array['automated_tests_passed','production_build_passed','stripe_verified','scheduled_automations_verified','controlled_load_passed','chromium_public_lead_form','firefox_public_lead_form','mobile_viewport_basics','server_confirmed_lead_persistence','email_api_accepted','email_provider_delivered','authenticated_email_delivery']
  loop
    perform automation.record_automated_certification_result(
      (select id from cert_syn), c, 'passed', 'ci://run/syn-'||c,
      'Canonical runner result for the journey-free readiness scenario.',
      '{}'::jsonb, now(), 'execution', now(), null, 'syn-suite:'||c);
  end loop;

  -- Booking gate for the synthetic cert needs its own qualifying booking.
  insert into public.bookings(booking_type_id, prospect_id, name, email, visitor_timezone, starts_at, ends_at,
                              blocked_starts_at, blocked_ends_at, status, manage_token_hash, source, context)
  select bt.id, ps.id, 'Teamtastic Certification', 'cert.mailbox@teamtastic.test', 'America/New_York',
         now() - interval '5 hours', now() - interval '4 hours',
         now() - interval '5 hours', now() - interval '4 hours',
         'completed', md5(random()::text), 'final_certification',
         jsonb_build_object('synthetic_test', true, 'certification_id', (select id from cert_syn),
                            'execution_key', 'syn-booking-1', 'recipient_classification', 'teamtastic_owned_test_mailbox')
  from public.booking_types bt cross join prospect_syn ps
  where bt.slug='suite-cert-type';

  perform automation.record_automated_certification_result((select id from cert_syn),'booking_workflow','passed','booking://syn-stub','Certification booking exercised native persistence safely.','{}'::jsonb,now(),'execution',now(),null,'syn-suite:booking_workflow');

  foreach m in array array['office_access_verified','security_advisors_reviewed','safari_public_lead_form','turnstile_success_behavior','turnstile_rejection_behavior','email_mailbox_receipt','real_inbox_placement','calendar_zoom_workflow','operational_owner_attestation']
  loop
    perform public.record_final_certification_evidence(
      (select id from cert_syn), m, 'passed', 'office://manual/syn-'||m, 'Operator Person',
      'Named operator verified this gate directly in production during the suite.',
      'manual', 'production', '{}'::jsonb);
  end loop;

  perform automation.observe_final_production_certifications();
  select status into v_status from public.final_production_certifications where id=(select id from cert_syn);
  perform pg_temp.assert_that('signoff.ready_without_real_customer_journey', v_status = 'ready_for_signoff', v_status);

  v_result := public.sign_off_final_production_certification((select id from cert_syn), 'Michael Scott');
  perform pg_temp.assert_that('signoff.passes_without_customer_journey', (v_result->>'passed')::boolean);

  select * into v_row from public.final_production_certifications where id=(select id from cert_syn);
  perform pg_temp.assert_that('signoff.journeyfree_snapshot_records_post_launch_truth',
    (v_row.signed_off_state->'post_launch_journey_state'->>'first_real_customer_journey_validation')
      = (automation.post_launch_milestone_summary()->>'first_real_customer_journey_validation'));

  -- The post-launch milestone remains bound to the GENUINE journey only; the
  -- synthetic chain (even with an accepted portal contact) never claimed it.
  select * into v_state from public.launch_phase_milestone_state
   where milestone_key='first_real_customer_journey_validation';
  perform pg_temp.assert_that('milestone.visible_and_not_a_prelaunch_blocker',
    not v_state.invalidated and v_state.client_id = (select id from client_a));
end $$;

-- 3h. The controlled-scale phase gate refuses to open while the milestone is
-- still pending (transition authority is exercised in launch_phase_policy.sql;
-- here we prove the summary feed it consumes is truthful).
select pg_temp.assert_that('scale_gate_feed_truthful',
  not ((automation.post_launch_milestone_summary()->>'first_real_customer_journey_validation')::boolean)
  or exists(select 1 from public.launch_phase_milestones
            where milestone_key='first_real_customer_journey_validation'));

-- ===========================================================================
-- Section 4. Authority surface
-- ===========================================================================

select pg_temp.assert_that('authority.service_role_cannot_write_evidence',
  not has_table_privilege('service_role', 'public.final_certification_evidence', 'INSERT')
  and not has_table_privilege('service_role', 'public.final_certification_evidence', 'UPDATE')
  and not has_table_privilege('service_role', 'public.final_certification_evidence', 'DELETE'));

select pg_temp.assert_that('authority.service_role_can_call_trusted_rpcs',
  has_function_privilege('service_role', 'public.record_final_certification_evidence(uuid,text,text,text,text,text,text,text,jsonb)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.sign_off_final_production_certification(uuid,text)', 'EXECUTE'));

select pg_temp.assert_that('authority.lock_helper_not_public',
  not has_function_privilege('anon', 'automation.lock_final_certification_state(uuid)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'automation.lock_final_certification_state(uuid)', 'EXECUTE'));

select pg_temp.assert_that('authority.view_exposes_live_lineage',
  exists(select 1 from information_schema.columns
         where table_schema='public' and table_name='final_certification_gate_status'
            and column_name in ('lineage_valid','lineage_invalid_reason')));

select pg_temp.assert_that('authority.milestones_service_role_read_only',
  has_table_privilege('service_role', 'public.launch_phase_milestones', 'SELECT')
  and not has_table_privilege('service_role', 'public.launch_phase_milestones', 'INSERT')
  and not has_table_privilege('service_role', 'public.launch_phase_milestones', 'UPDATE')
  and not has_table_privilege('service_role', 'public.launch_phase_milestones', 'DELETE'));

select pg_temp.assert_that('authority.milestone_state_readable_by_service_role',
  has_table_privilege('service_role', 'public.launch_phase_milestone_state', 'SELECT'));

select pg_temp.assert_that('authority.promotion_and_observer_restricted',
  has_function_privilege('service_role', 'automation.promote_research_seed_to_production(uuid,text,text,jsonb)', 'EXECUTE')
  and not has_function_privilege('anon', 'automation.promote_research_seed_to_production(uuid,text,text,jsonb)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'automation.observe_post_launch_milestones()', 'EXECUTE'));

select pg_temp.assert_that('authority.lifecycle_helpers_restricted',
  not has_function_privilege('anon', 'automation.derive_sales_lifecycle_stage(uuid)', 'EXECUTE')
  and has_function_privilege('service_role', 'automation.first_production_customer_journey()', 'EXECUTE'));

commit;

select 'ALL ASSERTIONS PASSED' as result, count(*) as assertions from test_results;
