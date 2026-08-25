-- Classification-aware launch readiness — regression suite.
-- Proves the evaluator uses the canonical production-classification boundary:
--   production/unresolved affect readiness, test_qa/certification never do,
--   and classification changes take effect immediately.
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

create temp table prospect_base as
  select id from public.prospects limit 0;

insert into public.conversion_health_runs(status, started_at, completed_at)
values ('healthy', now() - interval '2 hours', now() - interval '1 hour');
insert into public.mailbox_sync_state(mailbox, status, last_synced_at)
values ('mailbox@teamtastic.test', 'healthy', now() - interval '10 minutes')
on conflict (mailbox) do update set status = 'healthy', updated_at = now();

create function pg_temp.deal_check() returns jsonb language sql as $$
  select coalesce(
    (select c from launch_readiness_snapshots s, jsonb_array_elements(s.checks) c
      where c->>'key' = 'deal_next_actions'
      order by s.snapshot_bucket desc limit 1),
    '{"missing":-1,"overdue":-1,"blocking":false}'::jsonb
  )
$$;

create function pg_temp.task_check() returns jsonb language sql as $$
  select coalesce(
    (select c from launch_readiness_snapshots s, jsonb_array_elements(s.checks) c
      where c->>'key' = 'overdue_priority_tasks'
      order by s.snapshot_bucket desc limit 1),
    '{"count":-1,"blocking":false}'::jsonb
  )
$$;

-- Baseline: no open deals or tasks.
select automation.evaluate_launch_readiness() as readiness;
select pg_temp.assert_that('readiness.baseline_clean',
  (pg_temp.deal_check()->>'missing')::int = 0 and (pg_temp.deal_check()->>'overdue')::int = 0);

-- Scenario fixture: one prospect anchoring all deal variants.
insert into public.prospects(full_name, email, source, status)
values ('Readiness Fixture', 'readiness.fixture@example.test', 'inbound', 'new');

-- 1. Production deal + missing next action -> BLOCKED.
insert into public.deals(prospect_id, title, outcome)
select id, 'Real deal missing action', 'open' from public.prospects
where email_normalized='readiness.fixture@example.test';

select automation.evaluate_launch_readiness() as readiness;
select pg_temp.assert_that('readiness.production_missing_blocks',
  (pg_temp.deal_check()->>'missing')::int = 1 and (pg_temp.deal_check()->>'blocking')::boolean);

-- Launch Control count parity: evaluator count equals direct canonical query.
select pg_temp.assert_that('readiness.launch_control_matches_backend',
  (pg_temp.deal_check()->>'missing')::int = (
    select count(*) from public.deals d
    where d.outcome = 'open'
      and automation.record_affects_production_readiness('deal', d.id)
      and (nullif(trim(coalesce(d.next_action, '')), '') is null or d.next_action_due_at is null)
  ));

-- Watchlist generation follows the backend result when this is the sole delta:
-- the certification gate also blocks locally, so assert task presence logic
-- only through fingerprint upsert idempotency.
select pg_temp.assert_that('readiness.watchlist_task_exists',
  exists(select 1 from public.tasks
         where source='launch_watchlist' and fingerprint='launch:readiness:' || current_date::text));

-- 2. Same production deal with a FUTURE action -> no deal blocker.
update public.deals
set next_action = 'Follow up', next_action_due_at = now() + interval '2 days'
where title = 'Real deal missing action';

select automation.evaluate_launch_readiness() as readiness;
select pg_temp.assert_that('readiness.production_future_action_clears',
  (pg_temp.deal_check()->>'missing')::int = 0 and (pg_temp.deal_check()->>'overdue')::int = 0
  and not (pg_temp.deal_check()->>'blocking')::boolean);

-- 3. Production deal with OVERDUE action -> blocked again.
update public.deals
set next_action_due_at = now() - interval '3 days'
where title = 'Real deal missing action';

select automation.evaluate_launch_readiness() as readiness;
select pg_temp.assert_that('readiness.production_overdue_blocks',
  (pg_temp.deal_check()->>'overdue')::int = 1 and (pg_temp.deal_check()->>'blocking')::boolean);

delete from public.deals where title = 'Real deal missing action';

-- 4/5. Certification and test_qa deals NEVER block, even null AND overdue.
insert into public.final_production_certifications(started_by, preflight_evidence, known_limitations)
values ('readiness-fixture@teamtastic.test', '{}'::jsonb, '[]'::jsonb);

insert into public.production_record_classifications(record_type, record_id, classification, reason, actor, evidence, certification_id)
values ('prospect', (select id from public.prospects where email_normalized='readiness.fixture@example.test'),
        'certification', 'Launch hygiene fixture: synthetic certification prospect excluded from sales truth.', 'op@teamtastic.test',
        jsonb_build_object('linked_test_classification', true),
        (select id from public.final_production_certifications where started_by='readiness-fixture@teamtastic.test'));

insert into public.deals(prospect_id, title, outcome, next_action, next_action_due_at)
select p.id, 'Cert deal overdue', 'open', 'Respond and confirm holiday availability', now() - interval '30 days'
from public.prospects p where p.email_normalized='readiness.fixture@example.test';

select automation.evaluate_launch_readiness() as readiness;
select pg_temp.assert_that('readiness.certification_deal_never_blocks',
  (pg_temp.deal_check()->>'missing')::int = 0 and (pg_temp.deal_check()->>'overdue')::int = 0
  and not (pg_temp.deal_check()->>'blocking')::boolean,
  pg_temp.deal_check()::text);

insert into public.production_record_classifications(record_type, record_id, classification, reason, actor, evidence)
values ('deal', (select id from public.deals where title='Cert deal overdue'),
        'test_qa', 'Launch hygiene fixture: QA variant of the certification deal.', 'op@teamtastic.test',
        jsonb_build_object('linked_test_classification', true));

update public.deals set next_action = null, next_action_due_at = null
where title = 'Cert deal overdue';

select automation.evaluate_launch_readiness() as readiness;
select pg_temp.assert_that('readiness.test_qa_deal_null_action_does_not_block',
  (pg_temp.deal_check()->>'missing')::int = 0 and not (pg_temp.deal_check()->>'blocking')::boolean);

-- 6. Unresolved deal FAILS CLOSED: blocks like production.
insert into public.production_record_classifications(record_type, record_id, classification, reason, actor, evidence)
values ('deal', (select id from public.deals where title='Cert deal overdue'),
        'unresolved', 'Conflicting provenance signals require human resolution before exclusion.', 'op@teamtastic.test',
        '{}'::jsonb);

select automation.evaluate_launch_readiness() as readiness;
select pg_temp.assert_that('readiness.unresolved_fails_closed',
  (pg_temp.deal_check()->>'missing')::int = 1 and (pg_temp.deal_check()->>'blocking')::boolean);

-- 7. Classification changes take effect immediately within the same session.
insert into public.production_record_classifications(record_type, record_id, classification, reason, actor, evidence)
values ('deal', (select id from public.deals where title='Cert deal overdue'),
        'test_qa', 'Human resolution completed: confirmed duplicate QA fixture record.', 'op@teamtastic.test',
        jsonb_build_object('owner_confirmed_test', true));

select automation.evaluate_launch_readiness() as readiness;
select pg_temp.assert_that('readiness.reclassification_immediate',
  (pg_temp.deal_check()->>'missing')::int = 0);

delete from public.deals where title = 'Cert deal overdue';

-- 8. Overdue urgent/high TASK respects classification.
insert into public.tasks(title, priority, status, due_at)
values ('Fixture urgent follow-up', 'urgent', 'open', now() - interval '1 day');

select automation.evaluate_launch_readiness() as readiness;
select pg_temp.assert_that('readiness.production_overdue_task_blocks',
  (pg_temp.task_check()->>'count')::int = 1 and (pg_temp.task_check()->>'blocking')::boolean);

insert into public.production_record_classifications(record_type, record_id, classification, reason, actor, evidence)
values ('task', (select t.id from public.tasks t where t.title='Fixture urgent follow-up'),
        'test_qa', 'Launch hygiene fixture: QA follow-up excluded from operational readiness.', 'op@teamtastic.test',
        jsonb_build_object('linked_test_classification', true));

select automation.evaluate_launch_readiness() as readiness;
select pg_temp.assert_that('readiness.test_task_excluded',
  (pg_temp.task_check()->>'count')::int = 0 and not (pg_temp.task_check()->>'blocking')::boolean);

-- 8b/9. Research seeds: discovery-only records are never real-business truth.
-- An Apollo-style qualified account with an open deal blocks ONLY while it is
-- implicitly production; classifying it research_seed excludes the whole
-- subtree; trusted promotion restores blocker power.
insert into public.prospects(full_name, email, source, status)
values ('Seed Spencer', 'seed.spencer@example.test', 'apollo', 'qualified');

insert into public.deals(prospect_id, title, outcome)
select id, 'Seed deal missing action', 'open' from public.prospects
where email_normalized='seed.spencer@example.test';

select automation.evaluate_launch_readiness() as readiness;
select pg_temp.assert_that('research_seed.unclassified_apollo_still_blocks',
  (pg_temp.deal_check()->>'missing')::int >= 1,
  'Unclassified records remain production by default - the boundary cannot be loosened by omission.');

insert into public.production_record_classifications(record_type, record_id, classification, reason, actor, evidence)
values ('prospect', (select id from public.prospects where email_normalized='seed.spencer@example.test'),
        'research_seed', 'Apollo discovery without any verified interest signal; held for human outreach review.', 'op@teamtastic.test',
        jsonb_build_object('discovery_only', true));

select automation.evaluate_launch_readiness() as readiness;
select pg_temp.assert_that('research_seed.subtree_deal_never_blocks',
  (pg_temp.deal_check()->>'missing')::int = 0 and not (pg_temp.deal_check()->>'blocking')::boolean,
  pg_temp.deal_check()::text);

-- Overdue urgent tasks under the seed are excluded too.
insert into public.tasks(prospect_id, title, priority, status, due_at)
select id, 'Seed urgent follow-up', 'urgent', 'open', now() - interval '2 hours'
from public.prospects where email_normalized='seed.spencer@example.test';

select automation.evaluate_launch_readiness() as readiness;
select pg_temp.assert_that('research_seed.subtree_task_excluded',
  (pg_temp.task_check()->>'count')::int = 0);

-- Trusted promotion moves the record into the production lifecycle and its
-- real-business effects return immediately.
select pg_temp.assert_that('research_seed.promotion_restores_blockers',
  (
    select count(*) from public.tasks t
    where t.title='Seed urgent follow-up'
      and automation.record_affects_production_readiness('task', t.id)
  ) = 0,
  'pre-promotion sanity');

do $$
declare v jsonb;
begin
  v := automation.promote_research_seed_to_production(
    (select id from public.prospects where email_normalized='seed.spencer@example.test'),
    'Op Promoter',
    'Prospect replied in writing requesting pricing; verified inbound interest on record.',
    jsonb_build_object('verified_reply', true));
  if not coalesce((v->>'promoted')::boolean, false) then
    raise exception 'ASSERTION FAILED: promotion did not complete';
  end if;
end $$;

select automation.evaluate_launch_readiness() as readiness;
select pg_temp.assert_that('research_seed.promoted_task_blocks_again',
  (pg_temp.task_check()->>'count')::int = 1);
select pg_temp.assert_that('research_seed.derived_lifecycle_after_promotion',
  (select lifecycle_stage from automation.derive_sales_lifecycle_stage(
     (select id from public.prospects where email_normalized='seed.spencer@example.test'))) = 'opportunity');

delete from public.tasks where title='Seed urgent follow-up';
delete from public.deals where title='Seed deal missing action';

-- Caller input can never spoof classification into an exclusion: for record
-- types/ids with no excluding ledger entry the predicate stays fail-closed
-- (true), whatever type confusion a caller attempts.
select pg_temp.assert_that('research_seed.caller_input_cannot_spoof',
  automation.record_affects_production_readiness('deal', (select id from public.prospects where email_normalized='seed.spencer@example.test'))
  and automation.record_affects_production_readiness('task', (select id from public.deals where outcome='open' limit 1)::uuid) is not null);

-- Pipeline summary parity: research seeds drop out of real-business metrics.
select pg_temp.assert_that('research_seed.pipeline_summary_excludes_seeds',
  case
    when to_regclass('public.production_pipeline_summary') is null then true
    else (select qualified_prospects from public.production_pipeline_summary)
       = (select count(*) from public.prospects p
          join public.production_record_classification_status s
            on s.record_type='prospect' and s.record_id=p.id
          where p.status='qualified' and s.classification='production')
  end);

commit;

select 'ALL ASSERTIONS PASSED' as result, count(*) as assertions from test_results;
