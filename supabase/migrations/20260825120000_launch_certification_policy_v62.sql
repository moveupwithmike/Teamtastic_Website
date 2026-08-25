-- Launch certification policy correction (V6.2): decouple the first genuine
-- customer journey from PRE-LAUNCH certification.
--
-- Business problem: the previous policy required a REAL post-certification
-- customer journey (real_lead_client_journey + client_portal_access gates)
-- before controlled outbound could begin. A brand-new sales motion cannot
-- always obtain that customer without tightly controlled prospecting, so the
-- policy was circular. This migration corrects the ORDER of controls without
-- weakening any technical safety boundary:
--
--   PRE-LAUNCH  : every technical/operational control that can truthfully be
--                 demonstrated without a real customer (13 automated gates +
--                 9 manual operational gates + named atomic sign-off).
--   POST-LAUNCH : the first genuine production customer journey becomes the
--                 immutable `first_real_customer_journey_validation`
--                 milestone. It no longer blocks starting the CONTROLLED
--                 OUTBOUND PILOT; it blocks progression to CONTROLLED SCALE.
--
-- Preserved hardening (unchanged semantics):
--   canonical production classification + synthetic/test suppression,
--   fail-closed delivery authority, portal-lineage discipline, evidence
--   provenance/integrity, sign-off concurrency locks, immutable signed-off
--   snapshots, sending caps, human approval, and every kill switch.
--
-- New in this migration:
--   1. Canonical business-data class `research_seed` (discovered company or
--      contact that may suit prospecting but has shown NO verified interest;
--      never a lead, never pipeline, never a blocker until trusted promotion).
--   2. Canonical sales lifecycle documentation + derivation + a trusted
--      promotion workflow out of research_seed.
--   3. Journey gates moved out of pre-launch requirements into the append-only
--      post-launch milestone subsystem (automatic detection, fully auditable).
--   4. Controlled-scale phase gated on the journey milestone; controlled
--      outbound pilot capped at five individually approved messages per day.
--   5. Retired-draft terminal protection + retirement of the four
--      pre-architecture July drafts; research_seed reclassification of the
--      four Apollo discovery prospects (evidence preserved, nothing deleted).
--
-- Outbound remains OFF: no flag flips here, no sends, no fabricated journeys.

-- ---------------------------------------------------------------------------
-- 1. Canonical business-data classes
-- ---------------------------------------------------------------------------

-- Widen the classification vocabulary with `research_seed`. Existing classes
-- and every existing row keep their meaning; test_qa terminology is preserved
-- to avoid pointless migration churn.
alter table public.production_record_classifications
  drop constraint if exists production_record_classifications_classification_check;
alter table public.production_record_classifications
  add constraint production_record_classifications_classification_check
  check (classification = any (array[
    'production'::text,
    'test_qa'::text,
    'certification'::text,
    'research_seed'::text,
    'unresolved'::text
  ]));

-- Single canonical readiness predicate. research_seed records (and every
-- record descending from a research_seed prospect) never create launch
-- blockers; unresolved still fails closed like production.
create or replace function automation.record_affects_production_readiness(
  p_record_type text,
  p_record_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1
    from public.production_record_classification_status status
    where status.record_type = p_record_type
      and status.record_id = p_record_id
      and status.classification in ('test_qa', 'certification', 'research_seed')
  )
  and not exists (
    -- Research-seed subtree rule: sales records descending from a seed stay
    -- outside real-business truth until the seed is explicitly promoted.
    -- (test_qa/certification subtrees keep their existing native-marker
    -- inheritance and are deliberately NOT extended here.)
    select 1
    from public.production_record_classification_status ancestor
    where ancestor.record_type = 'prospect'
      and ancestor.classification = 'research_seed'
      and ancestor.record_id = case p_record_type
        when 'lead'    then (select l.prospect_id from public.leads l where l.id = p_record_id)
        when 'deal'    then (select d.prospect_id from public.deals d where d.id = p_record_id)
        when 'task'    then (select t.prospect_id from public.tasks t where t.id = p_record_id)
        when 'client'  then (select c.primary_prospect_id from public.clients c where c.id = p_record_id)
        when 'booking' then (select b.prospect_id from public.bookings b where b.id = p_record_id)
      end
  );
$$;

revoke all on function automation.record_affects_production_readiness(text, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Canonical sales lifecycle
-- ---------------------------------------------------------------------------
-- research_seed -> approved prospect -> contacted prospect -> engaged prospect
--   -> lead -> opportunity -> client
--
-- Semantic rules (authoritative):
--   * Apollo discovery alone NEVER makes something a lead.
--   * Outbound contact alone NEVER makes something a lead.
--   * A lead requires verified interest/engagement through a real capture path
--     and a production classification.
--   * An opportunity requires genuine commercial progression (open/won deal).
--   * A client requires an actual client/customer record.
-- Implemented strictly on the existing domain model (prospects / leads /
-- deals / clients); no parallel state is introduced.
create or replace function automation.sales_lifecycle_reference()
returns table(stage text, stage_order integer, promotion_condition text)
language sql
stable
set search_path = ''
as $$
  select *
  from (values
    ('research_seed', 1,
     'Discovered company/contact that may suit prospecting but has shown no verified interest (Apollo discovery, researched account, intent candidate, manually sourced target). Never a lead; excluded from real-business metrics until promoted.'),
    ('approved_prospect', 2,
     'A human reviewer approved the seed for controlled outreach after ICP/scoring review (prospects.status = ''qualified'' with production classification). Still NOT a lead.'),
    ('contacted_prospect', 3,
     'One or more individually approved outbound contacts were sent (prospects.last_outbound_at is not null). Outbound contact alone never promotes to lead.'),
    ('engaged_prospect', 4,
     'Verified two-way engagement exists: a meaningful inbound reply, a confirmed/completed booking, or an equivalent verified interest signal (prospects.last_inbound_at / messages / bookings).'),
    ('lead', 5,
     'A production-classified lead record exists from a real capture path. Requires the verified interest of the previous stages; synthetic/test_qa/certification/research_seed records never qualify.'),
    ('opportunity', 6,
     'Genuine commercial progression: an open or won production deal exists for the account.'),
    ('client', 7,
     'An actual client/customer record exists (clients.primary_prospect_id) with production classification.')
  ) as lifecycle(stage, stage_order, promotion_condition);
$$;

revoke all on function automation.sales_lifecycle_reference() from public, anon, authenticated;
grant execute on function automation.sales_lifecycle_reference() to service_role;

-- Derives the highest lifecycle stage an account has truthfully reached using
-- authoritative records and the canonical classification boundary only.
create or replace function automation.derive_sales_lifecycle_stage(p_prospect_id uuid)
returns table(prospect_id uuid, lifecycle_stage text, stage_order integer, classification text)
language sql
stable
security definer
set search_path = ''
as $$
  with account as (
    select
      p.id,
      coalesce(status.classification, 'production') as classification,
      p.status,
      p.last_inbound_at,
      p.last_outbound_at
    from public.prospects p
    left join public.production_record_classification_status status
      on status.record_type = 'prospect' and status.record_id = p.id
    where p.id = p_prospect_id
  ),
  signals as (
    select
      exists(
        select 1 from public.leads lead
        left join public.production_record_classification_status ls
          on ls.record_type = 'lead' and ls.record_id = lead.id
        where lead.prospect_id = account.id
          and coalesce((lead.context->>'synthetic_test')::boolean, false) = false
          and coalesce(ls.classification, 'production') = 'production'
      ) as has_lead,
      exists(
        select 1 from public.deals deal
        left join public.production_record_classification_status ds
          on ds.record_type = 'deal' and ds.record_id = deal.id
        where deal.prospect_id = account.id
          and deal.outcome in ('open', 'won')
          and coalesce(ds.classification, 'production') = 'production'
      ) as has_opportunity,
      exists(select 1 from public.clients client where client.primary_prospect_id = account.id) as has_client,
      exists(
        select 1 from public.bookings booking
        left join public.production_record_classification_status bs
          on bs.record_type = 'booking' and bs.record_id = booking.id
        where booking.prospect_id = account.id
          and booking.status in ('confirmed', 'completed')
          and coalesce(bs.classification, 'production') = 'production'
      ) as has_confirmed_booking,
      exists(
        select 1 from public.messages message
        where message.prospect_id = account.id
          and message.direction = 'inbound'
      ) as has_inbound_message
    from account
  )
  select
    account.id,
    case
      when account.classification = 'research_seed' then 'research_seed'
      when signals.has_client then 'client'
      when signals.has_opportunity then 'opportunity'
      when signals.has_lead then 'lead'
      when signals.has_inbound_message or signals.has_confirmed_booking or account.last_inbound_at is not null then 'engaged_prospect'
      when account.last_outbound_at is not null then 'contacted_prospect'
      when account.status = 'qualified' then 'approved_prospect'
      else 'research_seed'
    end,
    case
      when account.classification = 'research_seed' then 1
      when signals.has_client then 7
      when signals.has_opportunity then 6
      when signals.has_lead then 5
      when signals.has_inbound_message or signals.has_confirmed_booking or account.last_inbound_at is not null then 4
      when account.last_outbound_at is not null then 3
      when account.status = 'qualified' then 2
      else 1
    end,
    account.classification
  from account cross join signals;
$$;

revoke all on function automation.derive_sales_lifecycle_stage(uuid) from public, anon, authenticated;
grant execute on function automation.derive_sales_lifecycle_stage(uuid) to service_role;

-- Trusted promotion workflow: the ONLY sanctioned way to move a research seed
-- into the production lifecycle. Requires a named human actor and a stated
-- evidentiary reason; the classification ledger itself is the immutable audit
-- trail. Caller-supplied classifications elsewhere remain impossible to spoof:
-- every consumer reads the ledger/status view, never caller input.
create or replace function automation.promote_research_seed_to_production(
  p_prospect_id uuid,
  p_actor text,
  p_reason text,
  p_evidence jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current text;
begin
  if length(trim(coalesce(p_actor, ''))) < 3
    or lower(trim(p_actor)) in ('system', 'automation', 'unknown', 'ci') then
    raise exception 'Research-seed promotion requires a named human actor';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 20 then
    raise exception 'Research-seed promotion requires a stated evidentiary reason (min 20 chars)';
  end if;
  if p_prospect_id is null then
    raise exception 'Prospect is required';
  end if;

  select classification into v_current
  from public.production_record_classification_status
  where record_type = 'prospect' and record_id = p_prospect_id;

  if coalesce(v_current, 'production') <> 'research_seed' then
    raise exception 'Record is not classified research_seed (current: %)', coalesce(v_current, 'production');
  end if;

  insert into public.production_record_classifications(
    record_type, record_id, classification, reason, actor, evidence, correlation_id
  ) values (
    'prospect', p_prospect_id, 'production',
    trim(p_reason), trim(p_actor),
    jsonb_build_object('promotion_workflow', 'research_seed_trusted_promotion') || coalesce(p_evidence, '{}'::jsonb),
    'research-seed-promotion:' || p_prospect_id::text
  );

  return jsonb_build_object(
    'promoted', true,
    'record_type', 'prospect',
    'record_id', p_prospect_id,
    'classification', 'production',
    'promoted_by', trim(p_actor),
    'lifecycle_stage', (select lifecycle_stage from automation.derive_sales_lifecycle_stage(p_prospect_id))
  );
end;
$$;

revoke all on function automation.promote_research_seed_to_production(uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function automation.promote_research_seed_to_production(uuid, text, text, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- 3. Pre-launch gate requirements: journey gates move to post-launch
-- ---------------------------------------------------------------------------

-- `real_lead_client_journey` and `client_portal_access` leave the pre-launch
-- requirement set entirely. They are replaced by the append-only
-- `first_real_customer_journey_validation` milestone (section 5), which is
-- detected automatically from authoritative records and cannot be claimed by
-- callers. Every remaining pre-launch gate is unchanged, including
-- `calendar_zoom_workflow`, which stays a named-operator manual gate but no
-- longer depends on an existing real-client lineage (that dependency was part
-- of the circular policy).
create or replace function public.final_certification_gate_requirements()
returns table(check_name text, label text, category text, required_method text, sort_order integer)
language sql
stable
set search_path = ''
as $$
  select *
  from (values
    ('automated_tests_passed','Automated application and database tests','engineering','automated',10),
    ('production_build_passed','Production application build','engineering','automated',20),
    ('office_access_verified','Authenticated Sales Office access','engineering','manual',30),
    ('stripe_verified','Stripe verification and reconciliation','engineering','automated',40),
    ('scheduled_automations_verified','Scheduled production automations','engineering','automated',50),
    ('security_advisors_reviewed','Security advisor review','engineering','manual',60),
    ('controlled_load_passed','Controlled production load test','engineering','automated',70),
    ('chromium_public_lead_form','Chromium public lead form','browser','automated',100),
    ('safari_public_lead_form','Safari public lead form','browser','manual',110),
    ('firefox_public_lead_form','Firefox public lead form','browser','automated',120),
    ('mobile_viewport_basics','Mobile viewport basics','browser','automated',130),
    ('turnstile_success_behavior','Turnstile success behavior','turnstile','manual',200),
    ('turnstile_rejection_behavior','Turnstile failure and rejection behavior','turnstile','manual',210),
    ('server_confirmed_lead_persistence','Server-confirmed lead persistence','lead','automated',300),
    ('email_api_accepted','Email API accepted message','email','automated',400),
    ('email_provider_delivered','Email provider delivered event','email','automated',410),
    ('authenticated_email_delivery','Authenticated email delivery','email','automated',420),
    ('email_mailbox_receipt','Authenticated mailbox receipt','email','manual',430),
    ('real_inbox_placement','Real inbox placement','email','manual',440),
    ('booking_workflow','Booking workflow','journey','automated',500),
    ('calendar_zoom_workflow','Calendar and Zoom workflow','journey','manual',510),
    ('operational_owner_attestation','Named operational owner attestation','attestation','manual',600),
    ('final_named_signoff','Final named sign-off','signoff','manual',700)
  ) requirements(check_name,label,category,required_method,sort_order);
$$;

-- Manual-evidence lineage enforcement narrows to the generic integrity guards:
-- cross-certification metadata references are still rejected outright. The
-- journey-scoped forced-failure branches retired with the journey gates; the
-- canonical journey resolver itself remains authoritative and now powers the
-- post-launch milestone subsystem (section 5).
create or replace function automation.enforce_manual_gate_lineage() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.evidence_method <> 'manual' then
    return new;
  end if;

  if new.metadata->>'certification_id' is not null
    and new.metadata->>'certification_id' <> new.certification_id::text then
    raise exception 'Evidence metadata references a different certification';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Gate status view, completion enforcement, sign-off, observer
-- ---------------------------------------------------------------------------

-- Live gate status for the 23 pre-launch gates. Lineage columns remain
-- exposed (informational) straight from the canonical journey resolver so
-- operators can see journey posture next to the certification at any time.
create or replace view public.final_certification_gate_status
with (security_invoker = 'true') as
select certification.id as certification_id,
  requirement.check_name,
  requirement.label,
  requirement.category,
  requirement.required_method,
  requirement.sort_order,
  latest.id as evidence_id,
  latest.status,
  latest.evidence_reference,
  latest.performed_by,
  latest.performed_at,
  latest.notes,
  latest.evidence_method,
  latest.environment,
  latest.metadata,
  coalesce(
    latest.status = 'passed'
    and latest.environment = 'production'
    and latest.evidence_method = requirement.required_method
    and (requirement.required_method <> 'automated' or latest.execution_key is not null)
    and (latest.valid_until is null or latest.valid_until > now())
    and case
      when requirement.check_name = 'final_named_signoff'
        then certification.status = 'passed'
      else true
    end,
    false
  ) as satisfied,
  latest.evidence_origin,
  latest.source_observed_at,
  latest.valid_until,
  latest.execution_key,
  coalesce((latest.valid_until is null or latest.valid_until > now()), false) as fresh,
  lineage.lineage_valid,
  lineage.invalid_reason as lineage_invalid_reason
from public.final_production_certifications certification
cross join public.final_certification_gate_requirements() requirement
left join lateral automation.final_certification_journey_lineage(certification.id) lineage on true
left join lateral (
  select evidence.*
  from public.final_certification_evidence evidence
  where evidence.certification_id = certification.id
    and evidence.check_name = requirement.check_name
  order by evidence.performed_at desc, evidence.id desc
  limit 1
) latest on true;

grant select on public.final_certification_gate_status to service_role;

-- Completion enforcement no longer demands a real customer journey: reaching
-- ready_for_signoff and passing requires the full PRE-LAUNCH evidence set
-- under the same concurrency lock, immutability, and named-actor rules.
create or replace function automation.enforce_final_certification_completion() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status='ready_for_signoff' and (
    not automation.final_certification_evidence_ready(new.id,false)
  ) then
    new.status:='running';
  end if;

  if new.status='passed' and (tg_op='INSERT' or old.status is distinct from 'passed') then
    if current_setting('app.final_certification_signoff',true) is distinct from new.id::text then
      raise exception 'Final certification must use the named sign-off RPC';
    end if;
    -- All non-signoff gates are validated through the live view; the
    -- sign-off row itself is verified directly, because its view-level
    -- satisfaction definitionally requires the passed status that this very
    -- transition is establishing.
    if not automation.final_certification_evidence_ready(new.id,false)
      or not exists(
        select 1 from public.final_certification_evidence
        where certification_id=new.id
          and check_name='final_named_signoff'
          and status='passed'
          and environment='production'
      ) then
      raise exception 'Required certification evidence is incomplete';
    end if;
    if nullif(trim(coalesce(new.signed_off_by,'')),'') is null or new.signed_off_at is null then
      raise exception 'Named final sign-off is required';
    end if;
    if new.signed_off_state is null or jsonb_typeof(new.signed_off_state) <> 'object' then
      raise exception 'Final sign-off must record the certified state snapshot';
    end if;
  end if;

  if tg_op='UPDATE' and (
    new.signed_off_by is distinct from old.signed_off_by
    or new.signed_off_at is distinct from old.signed_off_at
    or new.signed_off_state is distinct from old.signed_off_state
  ) and current_setting('app.final_certification_signoff',true) is distinct from new.id::text then
    raise exception 'Final sign-off fields are protected';
  end if;
  if tg_op='INSERT' and (
    new.signed_off_by is not null
    or new.signed_off_at is not null
    or new.signed_off_state is not null
  ) then
    raise exception 'Final sign-off fields are protected';
  end if;
  return new;
end;
$$;

-- Final sign-off authority: identical serialization (advisory-lock against
-- every evidence writer), identical immutable snapshot, identical named-actor
-- and fail-closed rules — minus the circular real-customer prerequisite. The
-- snapshot records the exact certified pre-launch state, including the live
-- post-launch journey posture, so what was signed is provable forever.
create or replace function public.sign_off_final_production_certification(p_certification_id uuid, p_actor text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  certification public.final_production_certifications%rowtype;
  v_snapshot jsonb;
begin
  if length(trim(coalesce(p_actor,'')))<3
    or lower(trim(p_actor)) in ('system','automation','unknown','ci') then
    raise exception 'Named final sign-off is required';
  end if;

  perform automation.lock_final_certification_state(p_certification_id);

  perform automation.observe_final_production_certifications();
  select * into certification
  from public.final_production_certifications
  where id=p_certification_id
  for update;
  if certification.id is null then raise exception 'Certification not found'; end if;
  if certification.status='passed' then
    raise exception 'Final certification is already signed off';
  end if;
  if certification.status<>'ready_for_signoff' then
    raise exception 'Final certification gates are not complete';
  end if;
  if not automation.final_certification_evidence_ready(certification.id,false) then
    raise exception 'Required certification evidence is incomplete';
  end if;

  select jsonb_build_object(
    'captured_at',now(),
    'certification_id',certification.id,
    'policy_version','v6.2-pre-launch',
    'post_launch_journey_state',automation.post_launch_milestone_summary(),
    'evidence_version',(
      select coalesce(max(id),0)::text
      from public.final_certification_evidence
      where certification_id=certification.id
    ),
    'evidence_count',(
      select count(*)::int
      from public.final_certification_evidence
      where certification_id=certification.id
    ),
    'gates',(
      select jsonb_agg(jsonb_build_object(
        'check_name',gate.check_name,
        'evidence_id',gate.evidence_id,
        'status',gate.status,
        'environment',gate.environment,
        'performed_at',gate.performed_at,
        'valid_until',gate.valid_until,
        -- The sign-off gate is definitionally satisfied by the transaction
        -- capturing this snapshot; every other gate reflects live state.
        'satisfied',gate.satisfied or gate.check_name='final_named_signoff'
      ) order by gate.sort_order)
      from public.final_certification_gate_status gate
      where gate.certification_id=certification.id
    )
  ) into v_snapshot;

  insert into public.final_certification_evidence(
    certification_id,check_name,status,evidence_reference,performed_by,notes,
    evidence_method,environment,metadata
  ) values (
    certification.id,'final_named_signoff','passed',
    'office://final-certification/'||certification.id::text,
    trim(p_actor),'Named operator approved the pre-launch certification for the controlled pilot.',
    'manual','production',jsonb_build_object(
      'signed_off_at',now(),
      'certified_state',v_snapshot
    )
  );

  perform set_config('app.final_certification_signoff',certification.id::text,true);
  update public.final_production_certifications
  set status='passed',
      signed_off_by=trim(p_actor),
      signed_off_at=now(),
      completed_at=now(),
      signed_off_state=v_snapshot
  where id=certification.id;

  return jsonb_build_object(
    'passed',true,
    'certification_id',certification.id,
    'signed_off_by',trim(p_actor),
    'certified_state',v_snapshot
  );
end;
$$;

-- Pilot observation: the production-journey check becomes informational. The
-- observer still pins the canonical journey whenever one genuinely appears,
-- but a missing journey no longer holds the certification hostage: once the
-- 24-hour window completes cleanly, the certification reaches ready_for_signoff.
create or replace function automation.observe_final_production_certifications() returns jsonb
language plpgsql
security definer
set search_path = ''
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
      from public.leads l
      join public.clients c on c.primary_prospect_id=l.prospect_id
      join public.client_contacts cc on cc.client_id=c.id
      join public.portal_invitations pi on pi.client_contact_id=cc.id and pi.status='sent' and cc.accepted_at is not null
      left join public.production_record_classification_status ls on ls.record_type='lead' and ls.record_id=l.id
      left join public.production_record_classification_status ps on ps.record_type='prospect' and ps.record_id=l.prospect_id
      left join public.production_record_classification_status cs on cs.record_type='client' and cs.record_id=c.id
      where l.created_at>=r.started_at
        and not exists (
          select 1 from public.final_production_certifications other
          where other.id <> r.id and other.pilot_lead_id = l.id
        )
        and coalesce((l.context->>'synthetic_test')::boolean,false)=false
        and coalesce(ls.classification,'production')='production'
        and coalesce(ps.classification,'production')='production'
        and coalesce(cs.classification,'production')='production'
      order by pi.created_at limit 1;
    checks:=jsonb_build_array(
      jsonb_build_object('key','observation_window','passed',now()>=r.observation_ends_at,'detail',case when now()>=r.observation_ends_at then '24-hour observation complete' else 'Observation remains in progress' end),
      jsonb_build_object('key','critical_incidents','passed',criticals=0,'detail',criticals||' unresolved critical incidents during pilot'),
      jsonb_build_object('key','core_jobs','passed',jobs=0,'detail',jobs||' failed core scheduled-job runs during pilot'),
      jsonb_build_object('key','notifications','passed',notifications=0,'detail',notifications||' failed lead notifications during pilot'),
      jsonb_build_object('key','stripe_reconciliation','passed',stripe_issues=0,'detail',stripe_issues||' Stripe reconciliation issues during pilot'),
      jsonb_build_object('key','conversion_health','passed',health='healthy','detail','Latest conversion health: '||coalesce(health,'missing')),
      jsonb_build_object('key','mailbox_sync','passed',mailbox='healthy','detail','Latest mailbox sync: '||coalesce(mailbox,'missing')),
      jsonb_build_object('key','production_journey','passed',journey.lead_id is not null,'detail',case when journey.lead_id is null then 'No real customer journey observed yet - tracked as the post-launch first_real_customer_journey_validation milestone, not a pre-launch blocker' else 'Production lead reached client portal onboarding' end)
    );
    insert into public.final_certification_observations(certification_id,critical_incidents,failed_core_jobs,failed_notifications,stripe_reconciliation_issues,health_status,mailbox_status,snapshot)
    values(r.id,criticals,jobs,notifications,stripe_issues,health,mailbox,checks);
    update public.final_production_certifications set latest_checks=checks,pilot_lead_id=journey.lead_id,pilot_client_id=journey.client_id,
      pilot_portal_invitation_id=journey.invitation_id,status=case when now()>=r.observation_ends_at and criticals=0 and jobs=0 and notifications=0 and stripe_issues=0
        and health='healthy' and mailbox='healthy' then 'ready_for_signoff' else 'running' end where id=r.id;
    observed:=observed+1;
  end loop;
  perform automation.observe_post_launch_milestones();
  return jsonb_build_object('observed',observed);
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Post-launch customer-journey milestone subsystem
-- ---------------------------------------------------------------------------

-- Append-only record of achieved launch-phase milestones. There is no mutable
-- status to corrupt: absence of a row means pending; presence means the
-- milestone was reached and the full lineage snapshot is frozen forever.
create table if not exists public.launch_phase_milestones (
  id uuid primary key default gen_random_uuid(),
  milestone_key text not null unique
    check (milestone_key in (
      'first_real_engaged_lead',
      'first_real_client',
      'first_real_customer_journey_validation'
    )),
  lead_id uuid,
  prospect_id uuid,
  client_id uuid,
  contact_id uuid,
  portal_invitation_id uuid,
  progression jsonb not null default '{}'::jsonb,
  evidence jsonb not null default '{}'::jsonb,
  observed_by text not null,
  observed_at timestamptz not null default now()
);

alter table public.launch_phase_milestones enable row level security;
revoke all on public.launch_phase_milestones from public, anon, authenticated, service_role;
grant select on public.launch_phase_milestones to service_role;

create or replace function automation.protect_launch_milestones() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'Launch milestones are append-only and immutable';
end;
$$;

drop trigger if exists launch_phase_milestones_immutable on public.launch_phase_milestones;
create trigger launch_phase_milestones_immutable
  before update or delete on public.launch_phase_milestones
  for each row execute function automation.protect_launch_milestones();

-- Canonical FIRST genuine production customer journey, derived exclusively
-- from authoritative records: production-classified lead (never synthetic,
-- test_qa, certification, research_seed, or unresolved) -> commercial
-- progression -> client -> contact -> SENT portal invitation ACCEPTED by the
-- verified client user (acceptance read solely from client_contacts.accepted_at).
-- No time bound: the structural chain plus classification discipline IS the
-- qualification, so the first genuine journey ever made wins.
create or replace function automation.first_production_customer_journey()
returns table(
  lead_id uuid,
  prospect_id uuid,
  client_id uuid,
  contact_id uuid,
  invitation_id uuid,
  invitation_status text,
  progression jsonb,
  journey_valid boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    lead.id,
    lead.prospect_id,
    client.id,
    contact.id,
    invitation.id,
    invitation.status,
    jsonb_build_object(
      'inbound_reply', exists(
        select 1 from public.messages message
        where message.prospect_id = lead.prospect_id
          and message.direction = 'inbound'
          and message.received_at >= lead.created_at
      ),
      'confirmed_booking', exists(
        select 1 from public.bookings booking
        where booking.prospect_id = lead.prospect_id
          and booking.status in ('confirmed','completed')
          and booking.created_at >= lead.created_at
      ),
      'open_or_won_deal', exists(
        select 1 from public.deals deal
        where deal.prospect_id = lead.prospect_id
          and deal.outcome in ('open','won')
      )
    ),
    true
  from public.leads lead
  join public.production_record_classification_status lead_status
    on lead_status.record_type = 'lead' and lead_status.record_id = lead.id
  join public.production_record_classification_status prospect_status
    on prospect_status.record_type = 'prospect' and prospect_status.record_id = lead.prospect_id
  join public.clients client
    on client.primary_prospect_id = lead.prospect_id
  join public.production_record_classification_status client_status
    on client_status.record_type = 'client' and client_status.record_id = client.id
  join public.client_contacts contact
    on contact.client_id = client.id
  join public.portal_invitations invitation
    on invitation.client_contact_id = contact.id
    and invitation.status = 'sent'
  where coalesce((lead.context->>'synthetic_test')::boolean, false) = false
    and contact.accepted_at is not null
    and coalesce(lead_status.classification, 'production') = 'production'
    and coalesce(prospect_status.classification, 'production') = 'production'
    and coalesce(client_status.classification, 'production') = 'production'
    and (
      exists(
        select 1 from public.messages message
        where message.prospect_id = lead.prospect_id
          and message.direction = 'inbound'
          and message.received_at >= lead.created_at
      )
      or exists(
        select 1 from public.bookings booking
        where booking.prospect_id = lead.prospect_id
          and booking.status in ('confirmed','completed')
          and booking.created_at >= lead.created_at
      )
      or exists(
        select 1 from public.deals deal
        where deal.prospect_id = lead.prospect_id
          and deal.outcome in ('open','won')
      )
    )
  order by invitation.created_at asc, lead.created_at asc
  limit 1;
$$;

revoke all on function automation.first_production_customer_journey() from public, anon, authenticated;
grant execute on function automation.first_production_customer_journey() to service_role;

-- Milestone detector: evaluates the component milestones and the composite
-- journey, freezing immutable evidence rows for anything achieved. Fully
-- idempotent; safe to run from Launch Control refreshes and the cron monitor.
create or replace function automation.observe_post_launch_milestones()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_journey record;
  v_engaged record;
  v_client record;
  v_written integer := 0;
begin
  select * into v_journey from automation.first_production_customer_journey();

  if v_journey.lead_id is not null then
    insert into public.launch_phase_milestones(
      milestone_key, lead_id, prospect_id, client_id, contact_id, portal_invitation_id,
      progression, evidence, observed_by
    ) values (
      'first_real_customer_journey_validation',
      v_journey.lead_id, v_journey.prospect_id, v_journey.client_id,
      v_journey.contact_id, v_journey.invitation_id,
      v_journey.progression,
      jsonb_build_object(
        'resolver', 'automation.first_production_customer_journey',
        'invitation_status', v_journey.invitation_status,
        'portal_acceptance_authority', 'client_contacts.accepted_at',
        'excluded_classifications', jsonb_build_array('test_qa','certification','research_seed','unresolved'),
        'detected_at', now()
      ),
      'automation:post-launch-milestone-observer'
    ) on conflict (milestone_key) do nothing;
    if found then v_written := v_written + 1; end if;

    -- Component milestones bind to the SAME canonical client as the journey.
    insert into public.launch_phase_milestones(
      milestone_key, lead_id, prospect_id, client_id, contact_id, portal_invitation_id,
      progression, evidence, observed_by
    ) values (
      'first_real_client',
      v_journey.lead_id, v_journey.prospect_id, v_journey.client_id,
      v_journey.contact_id, v_journey.invitation_id,
      v_journey.progression,
      jsonb_build_object('resolver','automation.first_production_customer_journey','component_of','first_real_customer_journey_validation','detected_at',now()),
      'automation:post-launch-milestone-observer'
    ) on conflict (milestone_key) do nothing;
    if found then v_written := v_written + 1; end if;

    insert into public.launch_phase_milestones(
      milestone_key, lead_id, prospect_id, client_id, contact_id, portal_invitation_id,
      progression, evidence, observed_by
    ) values (
      'first_real_engaged_lead',
      v_journey.lead_id, v_journey.prospect_id, v_journey.client_id,
      v_journey.contact_id, v_journey.invitation_id,
      v_journey.progression,
      jsonb_build_object('resolver','automation.first_production_customer_journey','component_of','first_real_customer_journey_validation','detected_at',now()),
      'automation:post-launch-milestone-observer'
    ) on conflict (milestone_key) do nothing;
    if found then v_written := v_written + 1; end if;
  else
    -- Independent detection of the earlier-stage components while the full
    -- journey is still pending.
    select lead.id, lead.prospect_id
      into v_engaged
      from public.leads lead
      join public.production_record_classification_status lead_status
        on lead_status.record_type='lead' and lead_status.record_id=lead.id
      join public.production_record_classification_status prospect_status
        on prospect_status.record_type='prospect' and prospect_status.record_id=lead.prospect_id
      where coalesce((lead.context->>'synthetic_test')::boolean,false)=false
        and coalesce(lead_status.classification,'production')='production'
        and coalesce(prospect_status.classification,'production')='production'
        and (
          exists(select 1 from public.messages message where message.prospect_id=lead.prospect_id and message.direction='inbound' and message.received_at>=lead.created_at)
          or exists(select 1 from public.bookings booking where booking.prospect_id=lead.prospect_id and booking.status in ('confirmed','completed') and booking.created_at>=lead.created_at)
        )
      order by lead.created_at asc limit 1;

    if v_engaged.id is not null then
      insert into public.launch_phase_milestones(
        milestone_key, lead_id, prospect_id, progression, evidence, observed_by
      ) values (
        'first_real_engaged_lead', v_engaged.id, v_engaged.prospect_id,
        jsonb_build_object('verified_engagement', true),
        jsonb_build_object('resolver','automation.observe_post_launch_milestones','component','engaged_lead','detected_at',now()),
        'automation:post-launch-milestone-observer'
      ) on conflict (milestone_key) do nothing;
      if found then v_written := v_written + 1; end if;
    end if;

    select client.id, client.primary_prospect_id into v_client
      from public.clients client
      join public.production_record_classification_status client_status
        on client_status.record_type='client' and client_status.record_id=client.id
      join public.production_record_classification_status prospect_status
        on prospect_status.record_type='prospect' and prospect_status.record_id=client.primary_prospect_id
      where coalesce(client_status.classification,'production')='production'
        and coalesce(prospect_status.classification,'production')='production'
      order by client.created_at asc limit 1;

    if v_client.id is not null then
      insert into public.launch_phase_milestones(
        milestone_key, prospect_id, client_id, progression, evidence, observed_by
      ) values (
        'first_real_client', v_client.primary_prospect_id, v_client.id,
        jsonb_build_object('client_account', true),
        jsonb_build_object('resolver','automation.observe_post_launch_milestones','component','client','detected_at',now()),
        'automation:post-launch-milestone-observer'
      ) on conflict (milestone_key) do nothing;
      if found then v_written := v_written + 1; end if;
    end if;
  end if;

  return jsonb_build_object(
    'written', v_written,
    'journey_validated', v_journey.lead_id is not null,
    'summary', automation.post_launch_milestone_summary()
  );
end;
$$;

revoke all on function automation.observe_post_launch_milestones() from public, anon, authenticated;
grant execute on function automation.observe_post_launch_milestones() to service_role;

-- Compact read model used by Launch Control, sign-off snapshots, and the
-- scale-phase gate.
create or replace function automation.post_launch_milestone_summary()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'first_real_engaged_lead',
      (select (milestone_key is not null) from public.launch_phase_milestones where milestone_key='first_real_engaged_lead'),
    'first_real_client',
      (select (milestone_key is not null) from public.launch_phase_milestones where milestone_key='first_real_client'),
    'first_real_customer_journey_validation',
      (select (milestone_key is not null) from public.launch_phase_milestones where milestone_key='first_real_customer_journey_validation')
  );
$$;

revoke all on function automation.post_launch_milestone_summary() from public, anon, authenticated;
grant execute on function automation.post_launch_milestone_summary() to service_role;

-- Visible Launch Control read model: every canonical milestone, achieved or
-- pending. Like the certification gate-status view, satisfaction follows
-- CURRENT world state: an achieved milestone whose bound chain later loses
-- validity (reclassification, withdrawn acceptance, cancelled invitation)
-- stops reporting validated immediately, while its immutable history row is
-- retained for audit. Pending milestones surface as POST-LAUNCH progress,
-- never as pre-launch technical failures.
create or replace view public.launch_phase_milestone_state
with (security_invoker = 'true') as
with expected(milestone_key, sort_order, label, description, gates_controlled_scale) as (
  values
    ('first_real_engaged_lead', 10, 'First real engaged lead',
     'Earliest production lead with verified engagement (meaningful inbound reply or confirmed booking).', false),
    ('first_real_client', 20, 'First real client',
     'Earliest production client account.', false),
    ('first_real_customer_journey_validation', 30, 'First real customer journey validation',
     'Production lead -> commercial progression -> client -> portal invitation accepted, all bound to the same verified client.', true)
),
validity as (
  select
    milestone.id as milestone_row_id,
    milestone.milestone_key,
    exists(
      select 1
      from public.leads lead
      join public.production_record_classification_status lead_status
        on lead_status.record_type = 'lead' and lead_status.record_id = lead.id
      join public.production_record_classification_status prospect_status
        on prospect_status.record_type = 'prospect' and prospect_status.record_id = lead.prospect_id
      join public.clients client
        on client.primary_prospect_id = lead.prospect_id and client.id = milestone.client_id
      join public.production_record_classification_status client_status
        on client_status.record_type = 'client' and client_status.record_id = client.id
      join public.client_contacts contact
        on contact.client_id = client.id and contact.id = milestone.contact_id
        and contact.accepted_at is not null
      join public.portal_invitations invitation
        on invitation.client_contact_id = contact.id
        and invitation.id = milestone.portal_invitation_id
        and invitation.status = 'sent'
      where milestone.lead_id is not null
        and lead.id = milestone.lead_id
        and coalesce((lead.context->>'synthetic_test')::boolean, false) = false
        and coalesce(lead_status.classification, 'production') = 'production'
        and coalesce(prospect_status.classification, 'production') = 'production'
        and coalesce(client_status.classification, 'production') = 'production'
    ) as full_chain_valid,
    exists(
      select 1
      from public.leads lead
      join public.production_record_classification_status lead_status
        on lead_status.record_type = 'lead' and lead_status.record_id = lead.id
      join public.production_record_classification_status prospect_status
        on prospect_status.record_type = 'prospect' and prospect_status.record_id = lead.prospect_id
      where lead.id = milestone.lead_id
        and coalesce((lead.context->>'synthetic_test')::boolean, false) = false
        and coalesce(lead_status.classification, 'production') = 'production'
        and coalesce(prospect_status.classification, 'production') = 'production'
        and (
          exists(select 1 from public.messages message
                 where message.prospect_id = lead.prospect_id and message.direction = 'inbound'
                   and message.received_at >= lead.created_at)
          or exists(select 1 from public.bookings booking
                    where booking.prospect_id = lead.prospect_id
                      and booking.status in ('confirmed','completed')
                      and booking.created_at >= lead.created_at)
        )
    ) as engagement_valid,
    exists(
      select 1
      from public.clients client
      join public.production_record_classification_status client_status
        on client_status.record_type = 'client' and client_status.record_id = client.id
      join public.production_record_classification_status prospect_status
        on prospect_status.record_type = 'prospect' and prospect_status.record_id = client.primary_prospect_id
      where client.id = milestone.client_id
        and coalesce(client_status.classification, 'production') = 'production'
        and coalesce(prospect_status.classification, 'production') = 'production'
    ) as client_valid
  from public.launch_phase_milestones milestone
)
select
  expected.milestone_key,
  expected.sort_order,
  expected.label,
  expected.description,
  expected.gates_controlled_scale,
  achieved.id is not null as achieved,
  (achieved.id is not null and coalesce(
    case expected.milestone_key
      when 'first_real_customer_journey_validation' then validity.full_chain_valid
      when 'first_real_client' then coalesce(validity.full_chain_valid, validity.client_valid)
      when 'first_real_engaged_lead' then coalesce(validity.full_chain_valid, validity.engagement_valid)
    end, false)) as validated,
  (achieved.id is not null and not coalesce(
    case expected.milestone_key
      when 'first_real_customer_journey_validation' then validity.full_chain_valid
      when 'first_real_client' then coalesce(validity.full_chain_valid, validity.client_valid)
      when 'first_real_engaged_lead' then coalesce(validity.full_chain_valid, validity.engagement_valid)
    end, false)) as invalidated,
  achieved.lead_id,
  achieved.prospect_id,
  achieved.client_id,
  achieved.contact_id,
  achieved.portal_invitation_id,
  achieved.progression,
  achieved.evidence,
  achieved.observed_at,
  achieved.observed_by
from expected
left join public.launch_phase_milestones achieved
  on achieved.milestone_key = expected.milestone_key
left join validity
  on validity.milestone_row_id = achieved.id;

revoke all on public.launch_phase_milestone_state from public, anon, authenticated, service_role;
grant select on public.launch_phase_milestone_state to service_role;

do $job$
declare v_job_id bigint;
begin
  if to_regprocedure('cron.schedule(text,text,text)') is null then return; end if;
  select jobid into v_job_id from cron.job where jobname='launch-phase-milestone-monitor' limit 1;
  if v_job_id is not null then perform cron.unschedule(v_job_id); end if;
  perform cron.schedule(
    'launch-phase-milestone-monitor',
    '*/15 * * * *',
    $sql$select automation.observe_post_launch_milestones();$sql$
  );
end $job$;

-- ---------------------------------------------------------------------------
-- 6. Launch phases: controlled outbound pilot (max 5/day) + controlled scale
-- ---------------------------------------------------------------------------

alter table public.b2b_launch_state
  drop constraint if exists b2b_launch_state_phase_check;
alter table public.b2b_launch_state
  add constraint b2b_launch_state_phase_check
  check (phase = any (array[
    'off'::text,
    'inbound_pilot'::text,
    'proposal_pilot'::text,
    'live'::text,
    'controlled_scale'::text,
    'paused'::text,
    'rolled_back'::text
  ]));

-- Phase mapping (existing enum extended minimally):
--   off -> begin_pilot -> inbound_pilot        (Phase A: inbound pilot)
--   inbound_pilot -> enable_proposals -> proposal_pilot (Phase B: proposal pilot)
--   proposal_pilot -> enable_outbound -> live  (Phase C: CONTROLLED OUTBOUND PILOT,
--                                               hard cap five approved messages/day)
--   live -> enable_scale -> controlled_scale   (Phase E: requires the
--                                               first_real_customer_journey_validation
--                                               milestone plus healthy readiness;
--                                               Phase D is the milestone itself,
--                                               observed, not a switch).
create or replace function public.transition_b2b_launch(p_action text, p_actor text, p_reason text default null, p_daily_cap integer default 5)
returns jsonb
language plpgsql
set search_path to ''
as $$
declare
  v_state public.b2b_launch_state%rowtype;
  v_config public.system_config%rowtype;
  v_readiness public.launch_readiness_snapshots%rowtype;
  v_cert public.b2b_certification_runs%rowtype;
  v_gate jsonb;
  v_before jsonb;
  v_after jsonb;
  v_to text;
  v_prior jsonb;
begin
  if nullif(trim(p_actor),'') is null then return jsonb_build_object('changed',false,'reason','actor_required'); end if;
  perform pg_advisory_xact_lock(hashtextextended('b2b-controlled-launch',1));
  select * into v_state from public.b2b_launch_state where id=true for update;
  select * into v_config from public.system_config where id=true for update;
  v_gate := public.get_launch_readiness();
  select * into v_readiness from public.launch_readiness_snapshots order by created_at desc limit 1;
  select * into v_cert from public.b2b_certification_runs order by started_at desc limit 1;
  v_before:=jsonb_build_object('master_enabled',v_config.master_enabled,'gmail_ingestion_enabled',v_config.gmail_ingestion_enabled,'daily_report_enabled',v_config.daily_report_enabled,'proposal_email_enabled',v_config.proposal_email_enabled,'prospecting_enabled',v_config.prospecting_enabled,'sequence_followups_enabled',v_config.sequence_followups_enabled,'daily_prospecting_cap',v_config.daily_prospecting_cap,'outbound_auto_paused',v_config.outbound_auto_paused);
  -- Readiness remains authoritative for every activation action: pre-launch
  -- blockers (including incomplete final certification) hold everything.
  if p_action in ('begin_pilot','enable_proposals','enable_outbound','enable_scale') and (coalesce(v_gate->>'status','blocked') = 'blocked' or coalesce((v_gate->>'blockers')::integer,1)>0) then
    return jsonb_build_object('changed',false,'reason',case when coalesce((v_gate->>'evaluation_failed')::boolean,false) then 'readiness_evaluation_failed' else 'launch_readiness_blocked' end,'readiness',v_gate);
  end if;
  if p_action='begin_pilot' then
    if v_state.phase not in ('off','paused','rolled_back') then return jsonb_build_object('changed',false,'reason','invalid_phase','phase',v_state.phase); end if;
    v_prior:=v_before;
    perform set_config('teamtastic.launch_transition','on',true);
    update public.system_config set master_enabled=true,gmail_ingestion_enabled=true,daily_report_enabled=true,proposal_email_enabled=false,prospecting_enabled=false,sequence_followups_enabled=false,updated_at=now(),updated_by=p_actor where id=true;
    v_to:='inbound_pilot';
    update public.b2b_launch_state set phase=v_to,launched_at=now(),launched_by=p_actor,paused_at=null,paused_by=null,pause_reason=null,readiness_snapshot_id=v_readiness.id,certification_run_id=v_cert.id,prior_config=v_prior,updated_at=now(),updated_by=p_actor where id=true;
  elsif p_action='enable_proposals' then
    if v_state.phase<>'inbound_pilot' then return jsonb_build_object('changed',false,'reason','inbound_pilot_required','phase',v_state.phase); end if;
    perform set_config('teamtastic.launch_transition','on',true);
    update public.system_config set proposal_email_enabled=true,updated_at=now(),updated_by=p_actor where id=true; v_to:='proposal_pilot';
    update public.b2b_launch_state set phase=v_to,readiness_snapshot_id=v_readiness.id,certification_run_id=v_cert.id,updated_at=now(),updated_by=p_actor where id=true;
  elsif p_action='enable_outbound' then
    if v_state.phase<>'proposal_pilot' then return jsonb_build_object('changed',false,'reason','proposal_pilot_required','phase',v_state.phase); end if;
    if v_config.outbound_auto_paused then return jsonb_build_object('changed',false,'reason','deliverability_auto_pause_active'); end if;
    perform set_config('teamtastic.launch_transition','on',true);
    -- Controlled outbound pilot: maximum FIVE individually approved messages
    -- per weekday, regardless of the requested cap.
    update public.system_config set prospecting_enabled=true,sequence_followups_enabled=true,daily_prospecting_cap=least(5,greatest(1,coalesce(p_daily_cap,5))),updated_at=now(),updated_by=p_actor where id=true; v_to:='live';
    update public.b2b_launch_state set phase=v_to,readiness_snapshot_id=v_readiness.id,certification_run_id=v_cert.id,updated_at=now(),updated_by=p_actor where id=true;
  elsif p_action='enable_scale' then
    if v_state.phase<>'live' then return jsonb_build_object('changed',false,'reason','controlled_outbound_pilot_required','phase',v_state.phase); end if;
    if v_config.outbound_auto_paused then return jsonb_build_object('changed',false,'reason','deliverability_auto_pause_active'); end if;
    -- Phase E (controlled scale) is earned by outcome evidence: the first
    -- genuine production customer journey must be validated RIGHT NOW
    -- (current-world agreement - an achieved-but-invalidated milestone does
    -- not unlock scale), and it must already be frozen immutably.
    if not exists(
      select 1 from public.launch_phase_milestone_state
      where milestone_key='first_real_customer_journey_validation'
        and validated
    ) then
      return jsonb_build_object('changed',false,'reason','first_real_customer_journey_validation_required','post_launch_milestones',automation.post_launch_milestone_summary());
    end if;
    perform set_config('teamtastic.launch_transition','on',true);
    update public.system_config set daily_prospecting_cap=least(10,greatest(1,coalesce(p_daily_cap,v_config.daily_prospecting_cap))),updated_at=now(),updated_by=p_actor where id=true; v_to:='controlled_scale';
    update public.b2b_launch_state set phase=v_to,readiness_snapshot_id=v_readiness.id,certification_run_id=v_cert.id,updated_at=now(),updated_by=p_actor where id=true;
  elsif p_action='pause' then
    if v_state.phase='off' then return jsonb_build_object('changed',false,'reason','already_off'); end if;
    update public.system_config set master_enabled=false,proposal_email_enabled=false,prospecting_enabled=false,sequence_followups_enabled=false,updated_at=now(),updated_by=p_actor where id=true; v_to:='paused';
    update public.b2b_launch_state set phase=v_to,paused_at=now(),paused_by=p_actor,pause_reason=coalesce(nullif(trim(p_reason),''),'Emergency pause'),updated_at=now(),updated_by=p_actor where id=true;
  elsif p_action='rollback' then
    if v_state.prior_config='{}'::jsonb then return jsonb_build_object('changed',false,'reason','no_saved_configuration'); end if;
    if coalesce((v_state.prior_config->>'master_enabled')::boolean,false)
      or coalesce((v_state.prior_config->>'proposal_email_enabled')::boolean,false)
      or coalesce((v_state.prior_config->>'prospecting_enabled')::boolean,false)
      or coalesce((v_state.prior_config->>'sequence_followups_enabled')::boolean,false) then
      if coalesce(v_gate->>'status','blocked') = 'blocked' or coalesce((v_gate->>'blockers')::integer,1)>0 then
        return jsonb_build_object('changed',false,'reason',case when coalesce((v_gate->>'evaluation_failed')::boolean,false) then 'readiness_evaluation_failed' else 'launch_readiness_blocked' end,'readiness',v_gate);
      end if;
      perform set_config('teamtastic.launch_transition','on',true);
    end if;
    update public.system_config set master_enabled=(v_state.prior_config->>'master_enabled')::boolean,gmail_ingestion_enabled=(v_state.prior_config->>'gmail_ingestion_enabled')::boolean,daily_report_enabled=(v_state.prior_config->>'daily_report_enabled')::boolean,proposal_email_enabled=(v_state.prior_config->>'proposal_email_enabled')::boolean,prospecting_enabled=(v_state.prior_config->>'prospecting_enabled')::boolean,sequence_followups_enabled=(v_state.prior_config->>'sequence_followups_enabled')::boolean,daily_prospecting_cap=(v_state.prior_config->>'daily_prospecting_cap')::integer,outbound_auto_paused=(v_state.prior_config->>'outbound_auto_paused')::boolean,updated_at=now(),updated_by=p_actor where id=true; v_to:='rolled_back';
    update public.b2b_launch_state set phase=v_to,paused_at=now(),paused_by=p_actor,pause_reason=coalesce(nullif(trim(p_reason),''),'Rolled back to pre-launch configuration'),updated_at=now(),updated_by=p_actor where id=true;
  else return jsonb_build_object('changed',false,'reason','unknown_action'); end if;
  select jsonb_build_object('master_enabled',master_enabled,'gmail_ingestion_enabled',gmail_ingestion_enabled,'daily_report_enabled',daily_report_enabled,'proposal_email_enabled',proposal_email_enabled,'prospecting_enabled',prospecting_enabled,'sequence_followups_enabled',sequence_followups_enabled,'daily_prospecting_cap',daily_prospecting_cap,'outbound_auto_paused',outbound_auto_paused) into v_after from public.system_config where id=true;
  insert into public.b2b_launch_history(action,from_phase,to_phase,actor,reason,readiness_snapshot_id,certification_run_id,before_config,after_config) values(p_action,v_state.phase,v_to,p_actor,p_reason,v_readiness.id,v_cert.id,v_before,v_after);
  return jsonb_build_object('changed',true,'phase',v_to,'previous_phase',v_state.phase,'config',v_after,'readiness',v_gate);
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Outreach drafts: retired is terminal; approval respects classification
-- ---------------------------------------------------------------------------

-- A retired draft can never be reactivated, re-approved, or sent: the send
-- path only ever selects status='approved', and the terminal trigger blocks
-- any transition out of retired. Audit/history rows are retained untouched.
create or replace function automation.enforce_outreach_draft_lifecycle() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prospect_classification text;
begin
  if tg_op = 'UPDATE' and old.status = 'retired' and new.status is distinct from 'retired' then
    raise exception 'Retired outreach drafts are terminal and cannot be reactivated';
  end if;

  if tg_op in ('INSERT','UPDATE') and new.status = 'approved' then
    select classification into v_prospect_classification
    from public.production_record_classification_status
    where record_type = 'prospect' and record_id = new.prospect_id;

    if coalesce(v_prospect_classification,'production') <> 'production' then
      raise exception 'Draft approval requires a production-classified prospect (current: %)',
        coalesce(v_prospect_classification,'production');
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists outreach_drafts_lifecycle_guard on public.outreach_drafts;
create trigger outreach_drafts_lifecycle_guard
before insert or update on public.outreach_drafts
for each row execute function automation.enforce_outreach_draft_lifecycle();

-- Retire the July drafts generated before the classification/lifecycle/
-- certification architecture stabilized. Nothing is deleted: subject, body,
-- provenance, and timestamps remain fully auditable, and the send path can
-- never select them again.
with retired as (
  update public.outreach_drafts draft
  set status = 'retired',
      approval_notes = coalesce(nullif(trim(draft.approval_notes),'') || ' | ', '')
        || 'Retired by launch-certification policy v6.2: generated before the canonical '
        || 'classification/lifecycle architecture stabilized; controlled outbound pilot '
        || 'begins from fresh research instead.',
      updated_at = now()
  where draft.status in ('draft','review')
    and exists (
      select 1 from public.prospects p
      where p.id = draft.prospect_id and p.source = 'apollo'
    )
  returning draft.id
)
insert into public.agent_log(agent_name, action, outcome, decision)
select 'launch-policy-v62', 'retire_pre_architecture_drafts', 'completed',
       jsonb_build_object('draft_ids', coalesce(jsonb_agg(retired.id), '[]'::jsonb),
                          'previous_status', 'review', 'new_status', 'retired',
                          'reason', 'pre-architecture drafts retired before controlled outbound pilot')
from retired;

-- ---------------------------------------------------------------------------
-- 8. Research-seed classification of the Apollo discovery records
-- ---------------------------------------------------------------------------
-- The four enriched/qualified Apollo discoveries were promoted purely on
-- discovery + enrichment (score 60, deterministic drafts) with ZERO verified
-- interest signals: no inbound submission, no reply, no meeting, no booking,
-- no deal, no lead. Under the corrected lifecycle they are research seeds,
-- not production prospects. Provenance, enrichment, scores, and history are
-- preserved untouched.
insert into public.production_record_classifications(
  record_type, record_id, classification, reason, actor, evidence
)
select
  'prospect',
  prospect.id,
  'research_seed',
  'Apollo discovery reclassified under lifecycle policy v6.2: no verified interest signal exists (discovery/enrichment alone never constitutes a lead).',
  'migration:20260825120000_launch_certification_policy',
  jsonb_build_object(
    'policy_version', 'v6.2',
    'discovery_source', 'apollo',
    'apollo_person_id', prospect.metadata->>'apollo_person_id',
    'company_domain', prospect.metadata->>'company_domain',
    'score_at_reclassification', prospect.score,
    'verified_interest_signals', jsonb_build_object(
      'inbound_submissions', 0,
      'meaningful_replies', 0,
      'meetings_or_bookings', 0,
      'deals', 0,
      'leads', 0
    )
  )
from public.prospects prospect
where prospect.source = 'apollo'
  and prospect.status = 'qualified'
  and not exists (
    select 1 from public.latest_production_record_classifications latest
    where latest.record_type = 'prospect' and latest.record_id = prospect.id
  )
  -- Safety re-check at execution time: only classify when truly zero
  -- verified interest signals exist right now.
  and not exists (select 1 from public.messages m where m.prospect_id = prospect.id and m.direction = 'inbound')
  and not exists (select 1 from public.bookings b where b.prospect_id = prospect.id)
  and not exists (select 1 from public.deals d where d.prospect_id = prospect.id)
  and not exists (select 1 from public.leads l where l.prospect_id = prospect.id)
  and prospect.last_inbound_at is null;

insert into public.agent_log(agent_name, action, outcome, decision)
select 'launch-policy-v62', 'classify_apollo_research_seeds', 'completed',
       jsonb_build_object(
         'classified_as', 'research_seed',
         'prospect_ids', coalesce(jsonb_agg(latest.record_id), '[]'::jsonb),
         'reason', 'discovery/enrichment alone never constitutes a lead; held for human outreach review'
       )
from public.latest_production_record_classifications latest
where latest.classification = 'research_seed'
  and latest.actor = 'migration:20260825120000_launch_certification_policy'
  and not exists (
    select 1 from public.agent_log prior
    where prior.agent_name = 'launch-policy-v62'
      and prior.action = 'classify_apollo_research_seeds'
  );

-- ---------------------------------------------------------------------------
-- 8b. Explicit test_qa classification of legacy QA artifacts
-- ---------------------------------------------------------------------------
-- Two legacy records currently pass as implicit production but are provably
-- self-facing QA infrastructure. Left unclassified they would (a) count as a
-- real customer/pipeline and (b) let the new post-launch journey milestone
-- auto-validate against a QA smoke-test artifact - a false green.
--
--   * "Teamtastic Production QA" chain: own-domain email
--     info@teamtastic.events, deal literally titled "QA Smoke Test -
--     Complete Customer Journey" (won), created during portal-lineage
--     engineering validation.
--   * "Acme Corp" client row: placeholder name, no linked prospect, no
--     deals/events/payments - an early schema seed artifact.
--
-- Classification is explicit, evidenced, and reversible through the normal
-- ledger (newer rows win). Nothing is deleted or modified beyond provenance.
insert into public.production_record_classifications(
  record_type, record_id, classification, reason, actor, evidence
)
select records.record_type, records.record_id, 'test_qa',
       'Legacy QA artifact confirmed under lifecycle policy v6.2: self-facing test infrastructure, not a genuine customer or commercial progression.',
       'migration:20260825120000_launch_certification_policy',
       jsonb_build_object(
         'policy_version', 'v6.2',
         'artifact', records.artifact,
         'evidence_summary', records.evidence_summary,
         'review_required_to_restore', true
       )
from (values
  ('client',
   (select c.id from public.clients c where c.name = 'Teamtastic Production QA'),
   'teamtastic_production_qa_client',
   'Own-domain contact (info@teamtastic.events) accepted its portal invitation; account used to exercise portal-lineage validation.'),
  ('prospect',
   (select c.primary_prospect_id from public.clients c where c.name = 'Teamtastic Production QA'),
   'teamtastic_production_qa_prospect',
   'Prospect backing the Teamtastic Production QA client; no external customer exists behind it.'),
  ('lead',
   (select l.id from public.leads l
    join public.clients c on c.primary_prospect_id = l.prospect_id
    where c.name = 'Teamtastic Production QA'
    order by l.created_at limit 1),
   'teamtastic_production_qa_lead',
   'Lead feeding the Teamtastic Production QA chain; captured for QA smoke testing only.'),
  ('deal',
   (select d.id from public.deals d
    join public.clients c on c.primary_prospect_id = d.prospect_id
    where c.name = 'Teamtastic Production QA'
    order by d.created_at limit 1),
   'teamtastic_production_qa_deal',
   'Deal titled "QA Smoke Test - Complete Customer Journey"; synthetic commercial progression for testing.'),
  ('client',
   (select c.id from public.clients c where c.name = 'Acme Corp' and c.primary_prospect_id is null),
   'acme_corp_seed_row',
   'Placeholder-named client row with no linked prospect, deals, events, or payments.')
) as records(record_type, record_id, artifact, evidence_summary)
where records.record_id is not null
  and not exists (
    select 1 from public.latest_production_record_classifications latest
    where latest.record_type = records.record_type
      and latest.record_id = records.record_id
  );

insert into public.agent_log(agent_name, action, outcome, decision)
values ('launch-policy-v62', 'classify_legacy_qa_artifacts', 'completed',
        jsonb_build_object(
          'classified_as', 'test_qa',
          'artifacts', jsonb_build_array(
            'Teamtastic Production QA (client/prospect/lead/deal)',
            'Acme Corp seed client row'
          ),
          'reason', 'Self-facing QA artifacts must never validate real-business metrics or the post-launch customer-journey milestone'
        ));

-- ---------------------------------------------------------------------------
-- 9. Refresh Launch Control truth immediately
-- ---------------------------------------------------------------------------
select automation.evaluate_launch_readiness();
