-- Convert a verified hosted-event deposit into CRM client onboarding records.
-- Conversion is idempotent, gated by Phase 4, and has no email-sending path.

alter table public.stripe_events
  add column if not exists lifecycle_status text not null default 'pending'
    check (lifecycle_status in ('pending', 'converted', 'needs_lead_match', 'needs_event_details', 'skipped', 'failed')),
  add column if not exists lifecycle_attempts integer not null default 0 check (lifecycle_attempts >= 0),
  add column if not exists lifecycle_error text,
  add column if not exists lifecycle_processed_at timestamptz;

create table public.client_conversions (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id uuid not null unique references public.stripe_events(id) on delete restrict,
  lead_id uuid references public.leads(id) on delete set null,
  prospect_id uuid references public.prospects(id) on delete set null,
  company_id uuid references public.companies(id) on delete set null,
  client_id uuid references public.clients(id) on delete restrict,
  event_id uuid references public.events(id) on delete set null,
  status text not null check (status in ('converted', 'needs_lead_match', 'needs_event_details', 'failed')),
  amount numeric(12,2) not null default 0 check (amount >= 0),
  currency text not null default 'usd',
  decision jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index client_conversions_status_idx
  on public.client_conversions(status, created_at desc);
create index client_conversions_client_idx
  on public.client_conversions(client_id, created_at desc)
  where client_id is not null;

create or replace function public.process_paid_conversion(p_stripe_event_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  config public.system_config%rowtype;
  payment public.stripe_events%rowtype;
  lead_record public.leads%rowtype;
  existing_conversion public.client_conversions%rowtype;
  prospect_record public.prospects%rowtype;
  company_record public.companies%rowtype;
  client_record public.clients%rowtype;
  event_record public.events%rowtype;
  preferred_date date;
  conversion_status text;
  amount_paid numeric(12,2);
begin
  select * into config from public.system_config where id = true;
  if config.id is null or not config.master_enabled then
    return jsonb_build_object('converted', false, 'reason', 'master_kill_switch');
  end if;
  if not config.phase4_lifecycle_enabled then
    return jsonb_build_object('converted', false, 'reason', 'phase4_lifecycle_disabled');
  end if;

  select * into payment
  from public.stripe_events
  where id = p_stripe_event_id
  for update;
  if payment.id is null then
    return jsonb_build_object('converted', false, 'reason', 'stripe_event_not_found');
  end if;
  if payment.product_key <> 'hosted_event_deposit' or payment.payment_status <> 'paid' then
    return jsonb_build_object('converted', false, 'reason', 'not_a_paid_hosted_event_deposit');
  end if;

  select * into existing_conversion
  from public.client_conversions
  where stripe_event_id = payment.id;
  if existing_conversion.id is not null then
    return jsonb_build_object(
      'converted', existing_conversion.client_id is not null,
      'duplicate', true,
      'status', existing_conversion.status,
      'client_id', existing_conversion.client_id,
      'event_id', existing_conversion.event_id
    );
  end if;

  if payment.lead_id is not null then
    select * into lead_record from public.leads where id = payment.lead_id;
  end if;
  if lead_record.id is null and payment.customer_email is not null then
    select * into lead_record
    from public.leads
    where email_normalized = lower(trim(payment.customer_email))
    order by created_at desc
    limit 1;
  end if;

  amount_paid := round(payment.amount_total::numeric / 100, 2);
  if lead_record.id is null then
    insert into public.client_conversions(
      stripe_event_id, status, amount, currency, decision
    ) values (
      payment.id, 'needs_lead_match', amount_paid, payment.currency,
      jsonb_build_object('reason', 'no_matching_lead', 'send_enabled', false)
    ) returning * into existing_conversion;
    return jsonb_build_object('converted', false, 'status', 'needs_lead_match');
  end if;

  if lead_record.prospect_id is not null then
    select * into prospect_record from public.prospects where id = lead_record.prospect_id;
  end if;
  if prospect_record.id is null then
    insert into public.prospects(full_name, email, phone, source, status, last_inbound_at, metadata)
    values (
      lead_record.name, lead_record.email_normalized, lead_record.phone,
      'inbound', 'converted', lead_record.created_at,
      jsonb_build_object('converted_from_lead_id', lead_record.id)
    )
    on conflict (email_normalized) where email_normalized is not null
    do update set status = 'converted', updated_at = now()
    returning * into prospect_record;
    update public.leads set prospect_id = prospect_record.id where id = lead_record.id;
  end if;

  if prospect_record.company_id is not null then
    select * into company_record from public.companies where id = prospect_record.company_id;
  elsif nullif(trim(lead_record.company), '') is not null then
    select * into company_record
    from public.companies
    where lower(name) = lower(trim(lead_record.company))
    order by created_at
    limit 1;
    if company_record.id is null then
      insert into public.companies(name, lifecycle_stage, source, metadata)
      values (trim(lead_record.company), 'client', 'paid_deposit', jsonb_build_object('converted_from_lead_id', lead_record.id))
      returning * into company_record;
    end if;
    update public.prospects set company_id = company_record.id where id = prospect_record.id;
  end if;

  select * into client_record
  from public.clients
  where primary_prospect_id = prospect_record.id
     or lower(coalesce(primary_contact_email, email, '')) = lead_record.email_normalized
  order by created_at
  limit 1
  for update;
  if client_record.id is null then
    insert into public.clients(
      name, email, primary_contact_name, primary_contact_email,
      company_id, primary_prospect_id, first_closed_at, lifetime_value, metadata
    ) values (
      coalesce(nullif(trim(lead_record.company), ''), lead_record.name),
      lead_record.email_normalized, lead_record.name, lead_record.email_normalized,
      company_record.id, prospect_record.id, payment.paid_at, amount_paid,
      jsonb_build_object('created_from', 'paid_deposit', 'stripe_event_id', payment.id)
    ) returning * into client_record;
  else
    update public.clients
    set company_id = coalesce(company_id, company_record.id),
        primary_prospect_id = coalesce(primary_prospect_id, prospect_record.id),
        first_closed_at = coalesce(first_closed_at, payment.paid_at),
        lifetime_value = lifetime_value + amount_paid,
        updated_at = now()
    where id = client_record.id
    returning * into client_record;
  end if;

  if company_record.id is not null then
    update public.companies set lifecycle_stage = 'client', updated_at = now() where id = company_record.id;
  end if;
  update public.prospects set status = 'converted', updated_at = now() where id = prospect_record.id;
  update public.leads set status = 'converted', updated_at = now() where id = lead_record.id;

  if coalesce(lead_record.context->>'preferredEventDate', '') ~ '^\d{4}-\d{2}-\d{2}$' then
    preferred_date := (lead_record.context->>'preferredEventDate')::date;
    insert into public.events(
      host_code, status, client_id, title, event_type, scheduled_start_time,
      contact_email, value, lifecycle_metadata
    ) values (
      'paid-' || left(replace(gen_random_uuid()::text, '-', ''), 16),
      'scheduled', client_record.id,
      coalesce(nullif(trim(lead_record.occasion), ''), 'Teamtastic event'),
      'teamtastic', (preferred_date + time '12:00') at time zone 'America/New_York',
      lead_record.email_normalized, amount_paid,
      jsonb_build_object('created_from', 'paid_deposit', 'stripe_event_id', payment.id, 'time_needs_confirmation', true)
    ) returning * into event_record;
  end if;

  conversion_status := case when event_record.id is null then 'needs_event_details' else 'converted' end;
  insert into public.client_conversions(
    stripe_event_id, lead_id, prospect_id, company_id, client_id, event_id,
    status, amount, currency, decision
  ) values (
    payment.id, lead_record.id, prospect_record.id, company_record.id, client_record.id, event_record.id,
    conversion_status, amount_paid, payment.currency,
    jsonb_build_object('send_enabled', false, 'event_time_needs_confirmation', event_record.id is not null)
  );

  insert into public.tasks(
    prospect_id, client_id, event_id, title, description, priority, due_at, source, fingerprint
  ) values (
    prospect_record.id, client_record.id, event_record.id,
    'Start paid client onboarding: ' || client_record.name,
    case when event_record.id is null
      then 'Deposit received. Confirm the event date, time, format, attendee count, goals, and facilitator requirements.'
      else 'Deposit received. Confirm the proposed event date and time, format, attendee count, goals, and facilitator requirements.'
    end,
    'urgent', now(), 'phase4_paid_conversion', 'phase4:paid_onboarding:' || payment.id::text
  ) on conflict (fingerprint) where fingerprint is not null do nothing;

  return jsonb_build_object(
    'converted', true,
    'duplicate', false,
    'status', conversion_status,
    'client_id', client_record.id,
    'event_id', event_record.id,
    'send_enabled', false
  );
end;
$$;

drop trigger if exists client_conversions_touch_updated_at on public.client_conversions;
create trigger client_conversions_touch_updated_at
before update on public.client_conversions
for each row execute function automation.touch_updated_at();

alter table public.client_conversions enable row level security;
revoke all on table public.client_conversions from anon, authenticated;
grant select, insert, update, delete on table public.client_conversions to service_role;

revoke all on function public.process_paid_conversion(uuid) from public, anon, authenticated;
grant execute on function public.process_paid_conversion(uuid) to service_role;
