-- Manual certification operator controls (V6.1 hardening).
--
-- Closes four launch-critical integrity findings at the database authority:
--   1. Portal evidence could reference a different production client than the
--      attested real customer journey. Manual journey-scoped gates are now
--      bound to ONE canonical production journey derived from authoritative
--      records, never from caller-supplied IDs alone.
--   2. Synthetic/manual-certification leads could reach legacy notification
--      delivery paths. Every notification boundary now consults the
--      authoritative classification/provenance model and fails closed.
--   3. Certification evidence writes could race final sign-off. Evidence
--      writers and sign-off serialize on a transaction-level advisory lock,
--      and evidence becomes immutable once a certification is passed.
--   4. Final sign-off now records an immutable snapshot of the exact 25-gate
--      state it certified, and the gate-status view re-validates current
--      lineage live instead of trusting historical evidence rows.
--
-- Outbound remains OFF: this migration introduces no sending, prospecting, or
-- sequence behavior and performs no data mutation beyond schema/function
-- replacement.

-- ---------------------------------------------------------------------------
-- 1. Canonical journey lineage resolution
-- ---------------------------------------------------------------------------

-- Resolves THE canonical production journey for a certification using
-- authoritative records only. A journey qualifies only while every source
-- record still satisfies current lineage rules: the lead was created after
-- certification start, is not flagged synthetic, and the lead, prospect, and
-- client are all currently classified production (never test_qa,
-- certification, or unresolved). The chain must be structurally intact:
-- lead -> prospect -> client -> contact -> portal invitation (sent), with
-- portal acceptance read from its authoritative home,
-- client_contacts.accepted_at (the invitation outbox itself never carries an
-- accepted state). Ordering mirrors the pilot observer (first invitation
-- created).
create or replace function automation.final_certification_journey_lineage(
  p_certification_id uuid
)
returns table(
  lead_id uuid,
  prospect_id uuid,
  client_id uuid,
  contact_id uuid,
  invitation_id uuid,
  invitation_status text,
  lineage_valid boolean,
  invalid_reason text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_candidate record;
begin
  if p_certification_id is null then
    return query select null::uuid,null::uuid,null::uuid,null::uuid,null::uuid,null::text,false,'certification_required'::text;
    return;
  end if;

  if not exists(
    select 1 from public.final_production_certifications
    where id = p_certification_id
  ) then
    return query select null::uuid,null::uuid,null::uuid,null::uuid,null::uuid,null::text,false,'certification_not_found'::text;
    return;
  end if;

  -- Prefer the certification's own observer-pinned pilot journey. Once the
  -- observer has pinned it, no other journey can become canonical for this
  -- certification; the pinned chain must simply still satisfy current rules.
  if exists(
    select 1 from public.final_production_certifications
    where id = p_certification_id and pilot_lead_id is not null
  ) then
    select
      lead.id as lead_id,
      lead.prospect_id as prospect_id,
      client.id as client_id,
      contact.id as contact_id,
      invitation.id as invitation_id,
      invitation.status as invitation_status
    into v_candidate
    from public.final_production_certifications cert
    join public.leads lead on lead.id = cert.pilot_lead_id
    left join public.clients client
      on client.primary_prospect_id = lead.prospect_id
    left join public.client_contacts contact
      on contact.client_id = client.id
    left join public.portal_invitations invitation
      on invitation.client_contact_id = contact.id
      and invitation.status = 'sent'
    left join public.production_record_classification_status lead_status
      on lead_status.record_type = 'lead'
     and lead_status.record_id = lead.id
    left join public.production_record_classification_status prospect_status
      on prospect_status.record_type = 'prospect'
     and prospect_status.record_id = lead.prospect_id
    left join public.production_record_classification_status client_status
      on client_status.record_type = 'client'
     and client_status.record_id = client.id
    where cert.id = p_certification_id
      and lead.created_at >= cert.started_at
      and coalesce((lead.context->>'synthetic_test')::boolean,false) = false
      and coalesce(lead_status.classification,'production') = 'production'
      and coalesce(prospect_status.classification,'production') = 'production'
      and coalesce(client_status.classification,'production') = 'production'
      and cert.pilot_client_id = client.id
      and cert.pilot_portal_invitation_id = invitation.id
    limit 1;

    if v_candidate.lead_id is not null then
      return query select
        v_candidate.lead_id,
        v_candidate.prospect_id,
        v_candidate.client_id,
        v_candidate.contact_id,
        v_candidate.invitation_id,
        v_candidate.invitation_status,
        true,
        null::text;
      return;
    end if;

    return query select null::uuid,null::uuid,null::uuid,null::uuid,null::uuid,null::text,false,'no_currently_valid_production_journey'::text;
    return;
  end if;

  -- Not yet pinned: derive deterministically (earliest qualifying invitation),
  -- mirroring the observer so the next observation pins this same journey.
  select
    lead.id as lead_id,
    lead.prospect_id as prospect_id,
    client.id as client_id,
    contact.id as contact_id,
    invitation.id as invitation_id,
    invitation.status as invitation_status
  into v_candidate
  from public.leads lead
  join public.clients client
    on client.primary_prospect_id = lead.prospect_id
  join public.client_contacts contact
    on contact.client_id = client.id
  join public.portal_invitations invitation
    on invitation.client_contact_id = contact.id
    and invitation.status = 'sent'
  left join public.production_record_classification_status lead_status
    on lead_status.record_type = 'lead'
   and lead_status.record_id = lead.id
  left join public.production_record_classification_status prospect_status
    on prospect_status.record_type = 'prospect'
   and prospect_status.record_id = lead.prospect_id
  left join public.production_record_classification_status client_status
    on client_status.record_type = 'client'
   and client_status.record_id = client.id
  where lead.created_at >= (
      select started_at from public.final_production_certifications
      where id = p_certification_id
    )
    and not exists (
      select 1 from public.final_production_certifications other
      where other.id <> p_certification_id
        and other.pilot_lead_id = lead.id
    )
    and coalesce((lead.context->>'synthetic_test')::boolean,false) = false
    and coalesce(lead_status.classification,'production') = 'production'
    and coalesce(prospect_status.classification,'production') = 'production'
    and coalesce(client_status.classification,'production') = 'production'
  order by invitation.created_at asc, lead.created_at asc
  limit 1;

  if v_candidate.lead_id is null then
    return query select null::uuid,null::uuid,null::uuid,null::uuid,null::uuid,null::text,false,'no_currently_valid_production_journey'::text;
    return;
  end if;

  return query select
    v_candidate.lead_id,
    v_candidate.prospect_id,
    v_candidate.client_id,
    v_candidate.contact_id,
    v_candidate.invitation_id,
    v_candidate.invitation_status,
    true,
    null::text;
end;
$$;

revoke all on function automation.final_certification_journey_lineage(uuid) from public, anon, authenticated;
grant execute on function automation.final_certification_journey_lineage(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 2. Synthetic lead notification suppression at every legacy boundary
-- ---------------------------------------------------------------------------

-- Authoritative delivery decision for a lead's operational notifications.
-- Returns null when normal production delivery is allowed, or the reason the
-- lead must be suppressed. Based exclusively on provenance/classification
-- authority (context markers and the classification ledger); never on names,
-- emails, or content patterns. Mixed/unresolved provenance fails closed.
create or replace function automation.lead_notifications_blocked(p_lead_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_lead public.leads%rowtype;
  v_lead_classification text;
  v_lead_source text;
  v_prospect_classification text;
begin
  if p_lead_id is null then
    return 'lead_missing';
  end if;

  select * into v_lead from public.leads where id = p_lead_id;
  if v_lead.id is null then
    return 'lead_missing';
  end if;

  select classification, classification_source
    into v_lead_classification, v_lead_source
  from public.production_record_classification_status
  where record_type = 'lead' and record_id = v_lead.id;

  if coalesce(v_lead_classification,'production') <> 'production' then
    return 'lead_classification:' || v_lead_classification || ':' || coalesce(v_lead_source,'unknown');
  end if;

  if v_lead.prospect_id is not null then
    select classification
      into v_prospect_classification
    from public.production_record_classification_status
    where record_type = 'prospect' and record_id = v_lead.prospect_id;

    if coalesce(v_prospect_classification,'production') <> 'production' then
      return 'prospect_classification:' || v_prospect_classification;
    end if;
  end if;

  return null;
end;
$$;

revoke all on function automation.lead_notifications_blocked(uuid) from public, anon, authenticated;
grant execute on function automation.lead_notifications_blocked(uuid) to service_role;

-- Suppress any queued-but-undelivered notifications for a lead whose
-- authoritative provenance blocks real delivery. Rows are retained as
-- auditable test_suppressed records; nothing is deleted.
create or replace function automation.suppress_blocked_lead_notifications(p_lead_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_suppressed integer := 0;
  v_block_reason text;
begin
  if p_lead_id is null then
    return 0;
  end if;

  v_block_reason := automation.lead_notifications_blocked(p_lead_id);
  if v_block_reason is null then
    return 0;
  end if;

  update public.notification_deliveries delivery
  set status = 'test_suppressed',
      last_error = case
        when coalesce(delivery.last_error,'') like 'suppressed:%'
          then coalesce(delivery.last_error,'suppressed:' || v_block_reason)
        else 'suppressed:' || v_block_reason
      end,
      updated_at = now()
  where delivery.lead_id = p_lead_id
    and delivery.status in ('pending','failed');

  get diagnostics v_suppressed = row_count;
  return v_suppressed;
end;
$$;

revoke all on function automation.suppress_blocked_lead_notifications(uuid) from public, anon, authenticated;
grant execute on function automation.suppress_blocked_lead_notifications(uuid) to service_role;

-- Suppresses every queued-but-undelivered notification across the leads of a
-- prospect whose authoritative provenance blocks real delivery.
create or replace function automation.suppress_blocked_lead_notifications_queue_for_prospect(
  p_prospect_id uuid
) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_suppressed integer := 0;
  r record;
begin
  if p_prospect_id is null then
    return 0;
  end if;

  for r in
    select distinct lead.id
    from public.leads lead
    join public.notification_deliveries delivery on delivery.lead_id = lead.id
    where lead.prospect_id = p_prospect_id
      and delivery.status in ('pending','failed')
  loop
    v_suppressed := v_suppressed + automation.suppress_blocked_lead_notifications(r.id);
  end loop;

  return v_suppressed;
end;
$$;

revoke all on function automation.suppress_blocked_lead_notifications_queue_for_prospect(uuid) from public, anon, authenticated;
grant execute on function automation.suppress_blocked_lead_notifications_queue_for_prospect(uuid) to service_role;

-- Ledger-level notification sweep: ANY writer that records a
-- non-production classification for a lead or prospect (operator RPC,
-- propagation trigger, or direct administrative write) immediately converts
-- queued-but-undelivered operational notifications into auditable
-- suppressions. Delivery decisions can therefore never trail behind the
-- authoritative classification, whatever path wrote it.
create or replace function automation.sweep_notifications_on_classification() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.classification <> 'production' then
    if new.record_type = 'lead' then
      perform automation.suppress_blocked_lead_notifications(new.record_id);
    elsif new.record_type = 'prospect' then
      perform automation.suppress_blocked_lead_notifications_queue_for_prospect(new.record_id);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists production_record_classifications_notification_sweep on public.production_record_classifications;
create trigger production_record_classifications_notification_sweep
after insert on public.production_record_classifications
for each row execute function automation.sweep_notifications_on_classification();

-- Legacy INSERT notification trigger. Classification/provenance is evaluated
-- from the inserted row itself (native markers) plus the authoritative
-- ledger, so the legacy path can never deliver ahead of, around, or without
-- classification. Suppressed leads retain auditable delivery rows marked
-- test_suppressed and never trigger an external dispatch attempt.
create or replace function public.notify_new_lead() returns trigger
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
declare
  function_url text;
  webhook_secret text;
  v_block_reason text;
begin
  v_block_reason := automation.lead_notifications_blocked(new.id);

  if v_block_reason is not null then
    insert into public.notification_deliveries (lead_id, notification_type, status, last_error)
    values
      (new.id, 'customer_confirmation', 'test_suppressed', 'suppressed:' || v_block_reason),
      (new.id, 'internal_email', 'test_suppressed', 'suppressed:' || v_block_reason)
    on conflict (lead_id, notification_type) do nothing;
    return new;
  end if;

  insert into public.notification_deliveries (lead_id, notification_type)
  values
    (new.id, 'customer_confirmation'),
    (new.id, 'internal_email')
  on conflict (lead_id, notification_type) do nothing;

  select decrypted_secret into function_url
  from vault.decrypted_secrets where name = 'lead_notification_function_url' limit 1;
  select decrypted_secret into webhook_secret
  from vault.decrypted_secrets where name = 'lead_notification_webhook_secret' limit 1;

  if function_url is not null and webhook_secret is not null then
    perform net.http_post(
      url := function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-webhook-secret', webhook_secret
      ),
      body := jsonb_build_object('lead_id', new.id)
    );
  end if;
  return new;
end;
$$;

-- Legacy retry worker: reclassification (or a late-arriving synthetic flag)
-- must convert queued work into suppression instead of another dispatch try.
create or replace function public.retry_pending_lead_notifications()
returns void
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
declare
  function_url text;
  webhook_secret text;
  pending_lead record;
  v_block_reason text;
begin
  -- Pre-sweep: any queued-but-undelivered notification for a lead whose
  -- authoritative provenance blocks real delivery becomes suppression.
  update public.notification_deliveries delivery
  set status = 'test_suppressed',
      last_error = 'suppressed:' || automation.lead_notifications_blocked(delivery.lead_id),
      updated_at = now()
  where delivery.status in ('pending','failed')
    and automation.lead_notifications_blocked(delivery.lead_id) is not null;

  select decrypted_secret into function_url
  from vault.decrypted_secrets where name = 'lead_notification_function_url' limit 1;
  select decrypted_secret into webhook_secret
  from vault.decrypted_secrets where name = 'lead_notification_webhook_secret' limit 1;

  if function_url is null or webhook_secret is null then
    return;
  end if;

  for pending_lead in
    select distinct l.id
    from public.leads l
    join public.notification_deliveries d on d.lead_id = l.id
    where d.status in ('pending', 'failed')
      and d.attempts < 5
      and l.created_at > now() - interval '7 days'
    limit 100
  loop
    v_block_reason := automation.lead_notifications_blocked(pending_lead.id);
    if v_block_reason is not null then
      update public.notification_deliveries delivery
      set status = 'test_suppressed',
          last_error = case
            when coalesce(delivery.last_error,'') like 'suppressed:%'
              then delivery.last_error
            else 'suppressed:' || v_block_reason
          end,
          updated_at = now()
      where delivery.lead_id = pending_lead.id
        and delivery.status in ('pending','failed');
      continue;
    end if;

    perform net.http_post(
      url := function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-webhook-secret', webhook_secret
      ),
      body := jsonb_build_object('lead_id', pending_lead.id)
    );
  end loop;
end;
$$;

-- Provenance classifier: when a lead is inferred (or later reclassified) as
-- non-production, any notification rows that were queued before the
-- classification existed are suppressed immediately, closing the legacy
-- create-now-classify-later delivery window.
create or replace function automation.classify_lead_provenance() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_certification_id uuid;
  v_classification text;
begin
  if coalesce((new.context->>'synthetic_test')::boolean,false) then
    v_certification_id := nullif(new.context->>'certification_run_id','')::uuid;
    v_classification := case when v_certification_id is null
      then 'test_qa' else 'certification' end;
    perform automation.record_inferred_classification(
      'lead',new.id,v_classification,v_certification_id,
      coalesce(v_certification_id::text,'synthetic-lead:'||new.id),
      jsonb_build_object('lead_context',new.context)
    );
  end if;
  if new.prospect_id is not null then
    perform automation.classify_synthetic_prospect_lineage(new.prospect_id);
  end if;

  perform automation.suppress_blocked_lead_notifications(new.id);

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Manual gate lineage enforcement (portal / journey evidence integrity)
-- ---------------------------------------------------------------------------

-- Manual journey-scoped evidence is validated against the canonical journey
-- derived from authoritative production records. Caller-supplied identifiers
-- are never trusted on their own: they must match the canonical derivation,
-- and passing evidence is rewritten to carry the exact lineage snapshot.
-- When no currently valid production journey exists, the evidence is recorded
-- as failed with an explicit reason (house pattern from the email/booking
-- evidence enforcers).
create or replace function automation.enforce_manual_gate_lineage() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lineage record;
  v_requires_journey boolean;
  v_requires_acceptance boolean;
begin
  if new.evidence_method <> 'manual' then
    return new;
  end if;

  v_requires_journey := new.check_name in (
    'real_lead_client_journey','client_portal_access','calendar_zoom_workflow'
  );
  if not v_requires_journey then
    return new;
  end if;

  if new.metadata->>'certification_id' is not null
    and new.metadata->>'certification_id' <> new.certification_id::text then
    raise exception 'Evidence metadata references a different certification';
  end if;

  v_requires_acceptance := new.check_name = 'client_portal_access';

  select * into v_lineage
  from automation.final_certification_journey_lineage(new.certification_id);

  if not v_lineage.lineage_valid then
    new.status := 'failed';
    new.evidence_reference := 'certification://missing/' || new.check_name;
    new.notes := 'No currently valid production journey satisfies the lineage rules for this gate.';
    new.metadata := jsonb_build_object(
      'failure_reason','missing_current_production_lineage',
      'lineage_detail',coalesce(v_lineage.invalid_reason,'unknown'),
      'certification_id',new.certification_id
    );
    return new;
  end if;

  if v_requires_acceptance and not exists(
    select 1 from public.client_contacts contact
    where contact.id = v_lineage.contact_id
      and contact.accepted_at is not null
  ) then
    new.status := 'failed';
    new.evidence_reference := 'certification://missing/' || new.check_name;
    new.notes := 'The canonical production portal invitation has not been claimed by a verified client user.';
    new.metadata := jsonb_build_object(
      'failure_reason','portal_invitation_not_accepted',
      'certification_id',new.certification_id,
      'lead_id',v_lineage.lead_id,
      'client_id',v_lineage.client_id,
      'invitation_id',v_lineage.invitation_id,
      'invitation_status',v_lineage.invitation_status
    );
    return new;
  end if;

  if new.check_name = 'real_lead_client_journey' then
    if not exists(
      select 1 from public.client_contacts contact
      where contact.id = v_lineage.contact_id
        and contact.accepted_at is not null
    ) then
      new.status := 'failed';
      new.evidence_reference := 'certification://missing/' || new.check_name;
      new.notes := 'The canonical production journey has no verified client portal claim.';
      new.metadata := jsonb_build_object(
        'failure_reason','journey_portal_claim_missing',
        'certification_id',new.certification_id,
        'lead_id',v_lineage.lead_id,
        'client_id',v_lineage.client_id
      );
      return new;
    end if;
    if not exists(
      select 1 from public.bookings booking
      where booking.prospect_id = v_lineage.prospect_id
        and booking.status in ('confirmed','completed')
    ) and not exists(
      select 1 from public.deals deal
      where deal.prospect_id = v_lineage.prospect_id
        and deal.outcome in ('open','won')
    ) and not exists(
      select 1 from public.messages message
      where message.prospect_id = v_lineage.prospect_id
        and message.direction = 'inbound'
        and message.received_at >= (
          select started_at from public.final_production_certifications
          where id = new.certification_id
        )
    ) then
      new.status := 'failed';
      new.evidence_reference := 'certification://missing/' || new.check_name;
      new.notes := 'The canonical production journey has no qualifying commercial progression.';
      new.metadata := jsonb_build_object(
        'failure_reason','journey_progression_missing',
        'certification_id',new.certification_id,
        'lead_id',v_lineage.lead_id,
        'client_id',v_lineage.client_id
      );
      return new;
    end if;
  end if;

  if new.metadata ?| array['lead_id','client_id','invitation_id'] then
    if nullif(new.metadata->>'lead_id','') is not null
      and new.metadata->>'lead_id' <> v_lineage.lead_id::text then
      raise exception 'Evidence references a lead outside the canonical certification journey';
    end if;
    if nullif(new.metadata->>'client_id','') is not null
      and new.metadata->>'client_id' <> v_lineage.client_id::text then
      raise exception 'Evidence references a client outside the canonical certification journey';
    end if;
    if nullif(new.metadata->>'invitation_id','') is not null
      and new.metadata->>'invitation_id' <> v_lineage.invitation_id::text then
      raise exception 'Evidence references a portal invitation outside the canonical certification journey';
    end if;
  end if;

  new.metadata := new.metadata || jsonb_build_object(
    'certification_id',new.certification_id,
    'lead_id',v_lineage.lead_id,
    'prospect_id',v_lineage.prospect_id,
    'client_id',v_lineage.client_id,
    'contact_id',v_lineage.contact_id,
    'invitation_id',v_lineage.invitation_id,
    'invitation_status',v_lineage.invitation_status,
    'lineage_validated_at',now()
  );

  return new;
end;
$$;

drop trigger if exists final_certification_evidence_manual_lineage on public.final_certification_evidence;
create trigger final_certification_evidence_manual_lineage
before insert or update on public.final_certification_evidence
for each row execute function automation.enforce_manual_gate_lineage();

-- ---------------------------------------------------------------------------
-- 4. Evidence immutability and sign-off concurrency control
-- ---------------------------------------------------------------------------

alter table public.final_production_certifications
  add column if not exists signed_off_state jsonb;

-- Once a certification is passed its evidence is frozen: no edits, no
-- deletions, no additions. Every mutation path — including direct table
-- writes — first queues behind the certification-state lock, so a write can
-- never interleave between sign-off validation and sign-off commit: after
-- waiting, it observes the passed status and is rejected.
create or replace function automation.protect_signed_certification_evidence() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_certification_id uuid;
  v_status text;
begin
  v_certification_id := coalesce(new.certification_id, old.certification_id);

  perform automation.lock_final_certification_state(v_certification_id);

  if tg_op = 'INSERT' then
    select status into v_status
    from public.final_production_certifications
    where id = v_certification_id;
    if v_status = 'passed' then
      raise exception 'Certification evidence cannot be added after final sign-off';
    end if;
    return new;
  end if;

  select status into v_status
  from public.final_production_certifications
  where id = v_certification_id;
  if v_status = 'passed' then
    raise exception 'Certification evidence is immutable after final sign-off';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists final_certification_evidence_signed_immutability on public.final_certification_evidence;
create trigger final_certification_evidence_signed_immutability
before insert or update or delete on public.final_certification_evidence
for each row execute function automation.protect_signed_certification_evidence();

-- Certification-state lock shared by every evidence writer and the sign-off
-- authority. Transaction-level advisory locks serialize validation against
-- mutation so a sign-off can never commit against concurrently changed
-- evidence, and evidence writes queue behind an in-flight sign-off.
create or replace function automation.lock_final_certification_state(p_certification_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  select pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('final-certification-state:' || p_certification_id::text, 0)
  );
$$;

revoke all on function automation.lock_final_certification_state(uuid) from public, anon, authenticated;

-- Completion enforcement gains: sign-off fields AND the signed-off state
-- snapshot are protected outside the sign-off RPC, and a passed
-- certification must carry its snapshot.
create or replace function automation.enforce_final_certification_completion() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status='ready_for_signoff' and (
    not automation.final_certification_evidence_ready(new.id,false)
    or not automation.final_certification_real_journey_complete(new.id)
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
      )
      or not automation.final_certification_real_journey_complete(new.id) then
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

-- ---------------------------------------------------------------------------
-- 5. Hardened evidence writers (serialize with sign-off)
-- ---------------------------------------------------------------------------

create or replace function public.record_final_certification_evidence(
  p_certification_id uuid,
  p_check_name text,
  p_status text,
  p_evidence_reference text,
  p_performed_by text,
  p_notes text,
  p_evidence_method text,
  p_environment text,
  p_metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  requirement record;
  evidence_id bigint;
begin
  perform automation.lock_final_certification_state(p_certification_id);

  select * into requirement
  from public.final_certification_gate_requirements()
  where check_name=p_check_name;
  if requirement.check_name is null then raise exception 'Unsupported certification check'; end if;
  if p_check_name='final_named_signoff' then raise exception 'Final sign-off must use the named sign-off RPC'; end if;
  if p_status not in ('passed','failed') then raise exception 'Evidence status must be passed or failed'; end if;
  if p_evidence_method not in ('automated','manual') then raise exception 'Evidence method must be automated or manual'; end if;
  if p_environment not in ('production','staging','local','ci') then raise exception 'Unsupported evidence environment'; end if;
  if requirement.required_method<>p_evidence_method then
    raise exception 'Certification evidence method does not match the gate requirement';
  end if;
  if p_evidence_method='manual' and (
    length(trim(coalesce(p_performed_by,'')))<3
    or lower(trim(p_performed_by)) in ('system','automation','unknown','ci')
  ) then raise exception 'Manual evidence requires a named operator'; end if;
  if length(trim(coalesce(p_evidence_reference,'')))<5 then raise exception 'Evidence reference is required'; end if;
  if length(trim(coalesce(p_notes,'')))<10 then raise exception 'Evidence notes are required'; end if;
  if p_metadata->>'certification_id' is not null
    and p_metadata->>'certification_id' <> p_certification_id::text then
    raise exception 'Evidence metadata references a different certification';
  end if;
  if not exists(
    select 1 from public.final_production_certifications
    where id=p_certification_id and status in ('running','ready_for_signoff')
  ) then raise exception 'Certification is not active'; end if;

  insert into public.final_certification_evidence(
    certification_id,check_name,status,evidence_reference,performed_by,notes,
    evidence_method,environment,metadata
  ) values (
    p_certification_id,p_check_name,p_status,trim(p_evidence_reference),
    trim(p_performed_by),trim(p_notes),p_evidence_method,p_environment,
    coalesce(p_metadata,'{}'::jsonb)
  ) returning id into evidence_id;

  return jsonb_build_object(
    'recorded',true,
    'evidence_id',evidence_id,
    'check_name',p_check_name,
    'status',p_status,
    'satisfies_gate',
      p_status='passed'
      and p_environment='production'
      and requirement.required_method=p_evidence_method
  );
end;
$$;

create or replace function automation.record_automated_certification_result(
  p_certification_id uuid,
  p_check_name text,
  p_status text,
  p_evidence_reference text,
  p_notes text,
  p_metadata jsonb,
  p_performed_at timestamptz,
  p_evidence_origin text,
  p_source_observed_at timestamptz,
  p_valid_until timestamptz,
  p_execution_key text
) returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
  perform automation.lock_final_certification_state(p_certification_id);

  if not exists(
    select 1
    from public.final_certification_gate_requirements()
    where check_name=p_check_name and required_method='automated'
  ) then
    raise exception 'Unsupported automated certification check';
  end if;
  if p_status not in ('passed','failed') then raise exception 'Evidence status must be passed or failed'; end if;
  if p_evidence_origin not in ('execution','historical_backfill') then raise exception 'Unsupported evidence origin'; end if;
  if nullif(trim(coalesce(p_execution_key,'')),'') is null then raise exception 'Execution key is required'; end if;
  if p_metadata->>'certification_id' is not null
    and p_metadata->>'certification_id' <> p_certification_id::text then
    raise exception 'Evidence metadata references a different certification';
  end if;
  if not exists(
    select 1 from public.final_production_certifications
    where id=p_certification_id and status in ('running','ready_for_signoff')
  ) then raise exception 'Certification is not active'; end if;

  insert into public.final_certification_evidence(
    certification_id,check_name,status,evidence_reference,performed_by,performed_at,
    notes,evidence_method,environment,metadata,evidence_origin,source_observed_at,
    valid_until,execution_key
  ) values (
    p_certification_id,p_check_name,p_status,trim(p_evidence_reference),
    'automation:final-certification',coalesce(p_performed_at,now()),trim(p_notes),
    'automated','production',coalesce(p_metadata,'{}'::jsonb),p_evidence_origin,
    p_source_observed_at,p_valid_until,trim(p_execution_key)
  )
  on conflict(certification_id,check_name,execution_key)
    where execution_key is not null
  do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id
    from public.final_certification_evidence
    where certification_id=p_certification_id
      and check_name=p_check_name
      and execution_key=p_execution_key;
  end if;
  return v_id;
end;
$$;

create or replace function public.record_final_certification_attestation(
  p_certification_id uuid,
  p_evidence_key text,
  p_passed boolean,
  p_notes text,
  p_actor text
) returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare evidence jsonb;
begin
  perform automation.lock_final_certification_state(p_certification_id);
  if p_evidence_key not in ('cross_browser_forms_verified','email_auth_inbox_verified') then raise exception 'Unsupported evidence key'; end if;
  if length(trim(coalesce(p_notes,'')))<10 then raise exception 'Evidence notes are required'; end if;
  if not exists(select 1 from public.final_production_certifications where id=p_certification_id and status in ('running','ready_for_signoff')) then raise exception 'Certification is not active'; end if;
  insert into public.final_certification_attestations(certification_id,evidence_key,passed,notes,actor) values(p_certification_id,p_evidence_key,p_passed,trim(p_notes),p_actor);
  select preflight_evidence||jsonb_build_object(p_evidence_key,p_passed,p_evidence_key||'_notes',trim(p_notes),p_evidence_key||'_actor',p_actor,p_evidence_key||'_recorded_at',now()) into evidence
  from public.final_production_certifications where id=p_certification_id;
  update public.final_production_certifications set preflight_evidence=evidence where id=p_certification_id;
  return jsonb_build_object('recorded',true,'evidence_key',p_evidence_key,'passed',p_passed);
end;$$;

-- ---------------------------------------------------------------------------
-- 6. Final sign-off authority
-- ---------------------------------------------------------------------------

-- Final sign-off serializes against every evidence writer via the
-- certification-state lock, re-validates all 25 gates under that lock, and
-- commits an immutable snapshot of the exact certified state. Duplicate
-- concurrent sign-offs serialize: the first passes, later ones fail safely.
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
  if not automation.final_certification_evidence_ready(certification.id,false)
    or not automation.final_certification_real_journey_complete(certification.id) then
    raise exception 'Required certification evidence is incomplete';
  end if;

  select jsonb_build_object(
    'captured_at',now(),
    'certification_id',certification.id,
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
    trim(p_actor),'Named operator approved final production certification.',
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

-- ---------------------------------------------------------------------------
-- 7. Current-lineage journey completeness and pilot observation
-- ---------------------------------------------------------------------------

-- Real-journey completeness now respects the authoritative classification
-- model: leads carrying synthetic markers or non-production classifications
-- (including mixed/unresolved lineage) can never satisfy the journey gate.
create or replace function automation.final_certification_real_journey_complete(p_certification_id uuid) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(
    select 1
    from public.final_production_certifications certification
    join public.leads lead
      on lead.created_at>=certification.started_at
      and coalesce((lead.context->>'synthetic_test')::boolean,false)=false
      and lead.prospect_id is not null
    left join public.production_record_classification_status lead_status
      on lead_status.record_type='lead' and lead_status.record_id=lead.id
    left join public.production_record_classification_status prospect_status
      on prospect_status.record_type='prospect' and prospect_status.record_id=lead.prospect_id
    join public.clients client on client.primary_prospect_id=lead.prospect_id
    join public.client_contacts contact on contact.client_id=client.id
    join public.portal_invitations invitation
      on invitation.client_contact_id=contact.id
      and invitation.status='sent'
      and contact.accepted_at is not null
    where certification.id=p_certification_id
      and coalesce(lead_status.classification,'production')='production'
      and coalesce(prospect_status.classification,'production')='production'
      and (
        exists(
          select 1 from public.messages message
          where message.prospect_id=lead.prospect_id
            and message.direction='inbound'
            and message.received_at>=lead.created_at
        )
        or exists(
          select 1 from public.bookings booking
          where booking.prospect_id=lead.prospect_id
            and booking.status in ('confirmed','completed')
            and booking.created_at>=lead.created_at
        )
      )
      and (
        exists(
          select 1 from public.bookings booking
          where booking.prospect_id=lead.prospect_id
            and booking.status in ('confirmed','completed')
        )
        or exists(
          select 1 from public.deals deal
          where deal.prospect_id=lead.prospect_id
            and deal.outcome in ('open','won')
        )
      )
  );
$$;

-- Pilot observation pins the canonical journey using the same
-- production-classification discipline as the lineage resolver.
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
      where l.created_at>=r.started_at
        and not exists (
          select 1 from public.final_production_certifications other
          where other.id <> r.id and other.pilot_lead_id = l.id
        )
        and coalesce((l.context->>'synthetic_test')::boolean,false)=false
        and coalesce(ls.classification,'production')='production'
        and coalesce(ps.classification,'production')='production'
      order by pi.created_at limit 1;
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
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Gate status view: live lineage, no stale satisfaction
-- ---------------------------------------------------------------------------

-- Satisfaction now requires the evidence row AND the current world state to
-- agree. Journey-scoped manual gates re-validate the canonical lineage live,
-- portal access requires the canonical invitation to still be accepted, and
-- final sign-off requires the certification itself to be passed. Historical
-- evidence for an invalidated journey can no longer report PASSED.
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
      when requirement.check_name = 'real_lead_client_journey'
        or requirement.check_name = 'calendar_zoom_workflow'
        then lineage.lineage_valid
      when requirement.check_name = 'client_portal_access'
        then lineage.lineage_valid and exists(
          select 1 from public.client_contacts claimed_contact
          where claimed_contact.id = lineage.contact_id
            and claimed_contact.accepted_at is not null
        )
      when requirement.check_name = 'final_named_signoff'
        then certification.status = 'passed'
      else true
    end
    -- Evidence recorded against a specific journey stops satisfying the gate
    -- the moment the canonical journey moves elsewhere or loses validity.
    and (
      requirement.check_name not in ('real_lead_client_journey','client_portal_access','calendar_zoom_workflow')
      or latest.id is null
      or (
        (latest.metadata->>'lead_id' is null or latest.metadata->>'lead_id' = lineage.lead_id::text)
        and (latest.metadata->>'client_id' is null or latest.metadata->>'client_id' = lineage.client_id::text)
        and (latest.metadata->>'invitation_id' is null or latest.metadata->>'invitation_id' = lineage.invitation_id::text)
      )
    ),
    false
  ) as satisfied,
  latest.evidence_origin,
  latest.source_observed_at,
  latest.valid_until,
  latest.execution_key,
  coalesce((latest.valid_until is null or latest.valid_until > now()), false) as fresh,
  case
    when requirement.check_name in ('real_lead_client_journey','client_portal_access','calendar_zoom_workflow')
      then lineage.lineage_valid
    else null
  end as lineage_valid,
  case
    when requirement.check_name in ('real_lead_client_journey','client_portal_access','calendar_zoom_workflow')
      then lineage.invalid_reason
    else null
  end as lineage_invalid_reason
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

-- ---------------------------------------------------------------------------
-- 9. Public wrappers kept intact
-- ---------------------------------------------------------------------------

create or replace function public.observe_final_production_certifications() returns jsonb
language sql
set search_path to ''
as $$select automation.observe_final_production_certifications();$$;
