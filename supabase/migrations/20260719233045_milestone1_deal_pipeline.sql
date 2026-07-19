-- Milestone 1: revenue deal pipeline. Data-only; no email path is added.

create table public.deals (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid references public.prospects(id) on delete set null,
  company_id uuid references public.companies(id) on delete set null,
  primary_booking_id uuid unique references public.bookings(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  event_id uuid references public.events(id) on delete set null,
  title text not null,
  stage text not null default 'new_lead' check (stage in (
    'new_lead', 'qualified', 'call_booked', 'call_completed',
    'proposal_needed', 'proposal_sent', 'decision_pending',
    'deposit_paid', 'event_scheduled', 'completed', 'rebooking', 'closed_lost'
  )),
  outcome text not null default 'open' check (outcome in ('open', 'won', 'lost')),
  expected_value numeric(12,2) check (expected_value is null or expected_value >= 0),
  currency text not null default 'usd' check (currency ~ '^[a-z]{3}$'),
  next_action text,
  next_action_due_at timestamptz,
  decision_date date,
  won_at timestamptz,
  lost_at timestamptz,
  lost_reason text,
  stage_source text not null default 'manual',
  stage_source_id text,
  source text not null default 'crm',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (outcome <> 'won' or won_at is not null),
  check (outcome <> 'lost' or (lost_at is not null and nullif(trim(lost_reason), '') is not null)),
  check (stage <> 'closed_lost' or outcome = 'lost')
);

create unique index deals_one_open_per_prospect_idx
  on public.deals(prospect_id) where prospect_id is not null and outcome = 'open';
create index deals_company_idx on public.deals(company_id, updated_at desc);
create index deals_client_idx on public.deals(client_id, updated_at desc) where client_id is not null;
create index deals_event_idx on public.deals(event_id) where event_id is not null;
create index deals_open_stage_idx on public.deals(stage, next_action_due_at nulls first)
  where outcome = 'open';
create index deals_decision_date_idx on public.deals(decision_date) where outcome = 'open';

create table public.deal_stage_history (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  from_stage text,
  to_stage text not null,
  entered_at timestamptz not null default now(),
  exited_at timestamptz,
  duration_seconds bigint check (duration_seconds is null or duration_seconds >= 0),
  source text not null,
  source_id text,
  fingerprint text not null unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (exited_at is null or exited_at >= entered_at)
);

create index deal_stage_history_deal_timeline_idx
  on public.deal_stage_history(deal_id, entered_at desc);
create index deal_stage_history_open_stage_idx
  on public.deal_stage_history(deal_id) where exited_at is null;

create table public.deal_payments (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  stripe_event_id uuid not null unique references public.stripe_events(id) on delete restrict,
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null check (currency ~ '^[a-z]{3}$'),
  payment_kind text not null default 'deposit' check (payment_kind in ('deposit', 'balance', 'other')),
  paid_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index deal_payments_deal_idx on public.deal_payments(deal_id, paid_at desc);

create or replace function automation.deal_stage_rank(p_stage text)
returns integer
language sql
immutable
security invoker
set search_path = ''
as $$
  select case p_stage
    when 'new_lead' then 10 when 'qualified' then 20 when 'call_booked' then 30
    when 'call_completed' then 40 when 'proposal_needed' then 50
    when 'proposal_sent' then 60 when 'decision_pending' then 70
    when 'deposit_paid' then 80 when 'event_scheduled' then 90
    when 'completed' then 100 when 'rebooking' then 110
    when 'closed_lost' then 1000 else 0 end;
$$;

create or replace function automation.record_deal_stage_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  change_time timestamptz := now();
  history_fingerprint text;
begin
  if tg_op = 'INSERT' then
    history_fingerprint := new.id::text || ':created:' || new.stage;
    insert into public.deal_stage_history(
      deal_id, from_stage, to_stage, entered_at, source, source_id, fingerprint
    ) values (
      new.id, null, new.stage, new.created_at, new.stage_source, new.stage_source_id,
      history_fingerprint
    ) on conflict (fingerprint) do nothing;
    return new;
  end if;

  if new.stage is distinct from old.stage then
    update public.deal_stage_history
    set exited_at = change_time,
        duration_seconds = greatest(0, extract(epoch from (change_time - entered_at))::bigint)
    where deal_id = new.id and exited_at is null;

    history_fingerprint := new.id::text || ':' || new.stage || ':' ||
      coalesce(new.stage_source, 'unknown') || ':' ||
      coalesce(new.stage_source_id, gen_random_uuid()::text);
    insert into public.deal_stage_history(
      deal_id, from_stage, to_stage, entered_at, source, source_id, fingerprint
    ) values (
      new.id, old.stage, new.stage, change_time,
      coalesce(new.stage_source, 'unknown'), new.stage_source_id, history_fingerprint
    ) on conflict (fingerprint) do nothing;
  end if;
  return new;
end;
$$;

create or replace function automation.resolve_deal_company(
  p_prospect_id uuid,
  p_company_name text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_company_id uuid;
  clean_name text := nullif(trim(p_company_name), '');
begin
  select p.company_id into v_company_id from public.prospects p where p.id = p_prospect_id;
  if v_company_id is not null or clean_name is null then return v_company_id; end if;

  perform pg_advisory_xact_lock(hashtextextended(lower(clean_name), 0));
  select c.id into v_company_id from public.companies c
  where lower(c.name) = lower(clean_name) order by c.created_at limit 1;
  if v_company_id is null then
    insert into public.companies(name, lifecycle_stage, source, metadata)
    values (clean_name, 'opportunity', 'deal_pipeline', jsonb_build_object('created_from', 'deal_pipeline'))
    returning id into v_company_id;
  end if;
  update public.prospects set company_id = v_company_id, updated_at = now()
  where id = p_prospect_id and company_id is null;
  return v_company_id;
end;
$$;

create or replace function automation.sync_booking_deal(p_booking_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  booking_record public.bookings%rowtype;
  lead_record public.leads%rowtype;
  v_company_id uuid;
  deal_record public.deals%rowtype;
  deal_title text;
begin
  select * into booking_record from public.bookings where id = p_booking_id for update;
  if booking_record.id is null or booking_record.status <> 'confirmed' then return null; end if;
  perform pg_advisory_xact_lock(hashtextextended(booking_record.prospect_id::text, 1));
  if booking_record.lead_id is not null then
    select * into lead_record from public.leads where id = booking_record.lead_id;
  end if;
  v_company_id := automation.resolve_deal_company(
    booking_record.prospect_id,
    coalesce(nullif(booking_record.company, ''), lead_record.company)
  );
  deal_title := coalesce(nullif(booking_record.company, ''), nullif(lead_record.company, ''), booking_record.name) ||
    ' — Teamtastic opportunity';

  select * into deal_record from public.deals
  where primary_booking_id = booking_record.id for update;
  if deal_record.id is null then
    select * into deal_record from public.deals
    where prospect_id = booking_record.prospect_id and outcome = 'open'
    order by created_at desc limit 1 for update;
  end if;

  if deal_record.id is null then
    insert into public.deals(
      prospect_id, company_id, primary_booking_id, title, stage, outcome,
      next_action, next_action_due_at, stage_source, stage_source_id, source, metadata, created_at
    ) values (
      booking_record.prospect_id, v_company_id, booking_record.id, deal_title,
      'call_booked', 'open', 'Hold the booked discovery call', booking_record.starts_at,
      'booking_confirmed', booking_record.id::text, 'native_booking',
      jsonb_build_object('booking_id', booking_record.id), coalesce(booking_record.confirmed_at, now())
    ) returning * into deal_record;
  else
    update public.deals set
      company_id = coalesce(public.deals.company_id, v_company_id),
      primary_booking_id = coalesce(public.deals.primary_booking_id, booking_record.id),
      title = coalesce(nullif(public.deals.title, ''), deal_title),
      stage = case when automation.deal_stage_rank(public.deals.stage) < 30 then 'call_booked' else public.deals.stage end,
      next_action = case when automation.deal_stage_rank(public.deals.stage) < 30 then 'Hold the booked discovery call' else public.deals.next_action end,
      next_action_due_at = case when automation.deal_stage_rank(public.deals.stage) < 30 then booking_record.starts_at else public.deals.next_action_due_at end,
      stage_source = case when automation.deal_stage_rank(public.deals.stage) < 30 then 'booking_confirmed' else public.deals.stage_source end,
      stage_source_id = case when automation.deal_stage_rank(public.deals.stage) < 30 then booking_record.id::text else public.deals.stage_source_id end,
      metadata = public.deals.metadata || jsonb_build_object('booking_id', booking_record.id),
      updated_at = now()
    where id = deal_record.id returning * into deal_record;
  end if;
  return deal_record.id;
end;
$$;

create or replace function automation.on_booking_deal_sync()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status = 'confirmed' and (tg_op = 'INSERT' or old.status is distinct from 'confirmed') then
    perform automation.sync_booking_deal(new.id);
  end if;
  return new;
end;
$$;

create or replace function automation.sync_stripe_deal(p_stripe_event_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  payment public.stripe_events%rowtype;
  lead_record public.leads%rowtype;
  prospect_record public.prospects%rowtype;
  v_company_id uuid;
  deal_record public.deals%rowtype;
  amount_paid numeric(12,2);
begin
  select * into payment from public.stripe_events where id = p_stripe_event_id for update;
  if payment.id is null or payment.product_key <> 'hosted_event_deposit' or payment.payment_status <> 'paid' then
    return null;
  end if;
  select d.* into deal_record from public.deals d
  join public.deal_payments dp on dp.deal_id = d.id
  where dp.stripe_event_id = payment.id for update;
  if deal_record.id is not null then return deal_record.id; end if;

  if payment.lead_id is not null then select * into lead_record from public.leads where id = payment.lead_id; end if;
  if lead_record.id is null and payment.customer_email is not null then
    select * into lead_record from public.leads
    where email_normalized = lower(trim(payment.customer_email)) order by created_at desc limit 1;
  end if;
  if lead_record.prospect_id is not null then
    select * into prospect_record from public.prospects where id = lead_record.prospect_id;
  end if;
  if prospect_record.id is null and payment.customer_email is not null then
    select * into prospect_record from public.prospects
    where email_normalized = lower(trim(payment.customer_email)) limit 1;
  end if;
  if prospect_record.id is null and payment.customer_email is not null then
    insert into public.prospects(full_name, email, source, status, last_inbound_at, metadata)
    values (
      coalesce(nullif(lead_record.name, ''), payment.customer_email), lower(trim(payment.customer_email)),
      'stripe_deposit', 'interested', payment.paid_at,
      jsonb_build_object('created_from', 'stripe_deposit', 'stripe_event_id', payment.id)
    ) on conflict (email_normalized) where email_normalized is not null
      do update set updated_at = now()
    returning * into prospect_record;
    if lead_record.id is not null and lead_record.prospect_id is null then
      update public.leads set prospect_id = prospect_record.id where id = lead_record.id;
    end if;
  end if;

  if prospect_record.id is not null then
    perform pg_advisory_xact_lock(hashtextextended(prospect_record.id::text, 1));
  else
    perform pg_advisory_xact_lock(hashtextextended(coalesce(payment.customer_email, payment.id::text), 1));
  end if;

  v_company_id := automation.resolve_deal_company(prospect_record.id, lead_record.company);
  if prospect_record.id is not null then
    select * into deal_record from public.deals
    where prospect_id = prospect_record.id and outcome = 'open'
    order by created_at desc limit 1 for update;
  end if;
  amount_paid := round(payment.amount_total::numeric / 100, 2);

  if deal_record.id is null then
    insert into public.deals(
      prospect_id, company_id, title, stage, outcome, expected_value, currency,
      next_action, next_action_due_at, won_at, stage_source, stage_source_id, source, metadata
    ) values (
      prospect_record.id, v_company_id,
      coalesce(nullif(lead_record.company, ''), nullif(lead_record.name, ''), payment.customer_email, 'Paid Teamtastic event') || ' — Teamtastic opportunity',
      'deposit_paid', 'won', amount_paid, lower(payment.currency),
      'Confirm event date, time, format, and attendee details', now(), payment.paid_at,
      'stripe_deposit', payment.id::text, 'stripe_deposit',
      jsonb_build_object('first_stripe_event_id', payment.id)
    ) returning * into deal_record;
  else
    update public.deals set
      company_id = coalesce(public.deals.company_id, v_company_id),
      stage = case when automation.deal_stage_rank(public.deals.stage) < 80 then 'deposit_paid' else public.deals.stage end,
      outcome = 'won', won_at = coalesce(public.deals.won_at, payment.paid_at),
      expected_value = greatest(coalesce(public.deals.expected_value, 0), amount_paid),
      currency = lower(payment.currency),
      next_action = case when automation.deal_stage_rank(public.deals.stage) < 90 then 'Confirm event date, time, format, and attendee details' else public.deals.next_action end,
      next_action_due_at = case when automation.deal_stage_rank(public.deals.stage) < 90 then now() else public.deals.next_action_due_at end,
      stage_source = case when automation.deal_stage_rank(public.deals.stage) < 80 then 'stripe_deposit' else public.deals.stage_source end,
      stage_source_id = case when automation.deal_stage_rank(public.deals.stage) < 80 then payment.id::text else public.deals.stage_source_id end,
      metadata = public.deals.metadata || jsonb_build_object('latest_stripe_event_id', payment.id),
      updated_at = now()
    where id = deal_record.id returning * into deal_record;
  end if;

  insert into public.deal_payments(deal_id, stripe_event_id, amount, currency, payment_kind, paid_at)
  values (deal_record.id, payment.id, amount_paid, lower(payment.currency), 'deposit', payment.paid_at)
  on conflict (stripe_event_id) do nothing;
  return deal_record.id;
end;
$$;

create or replace function automation.on_stripe_deal_sync()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.product_key = 'hosted_event_deposit' and new.payment_status = 'paid' then
    perform automation.sync_stripe_deal(new.id);
  end if;
  return new;
end;
$$;

create or replace function automation.on_conversion_deal_sync()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  deal_id uuid;
begin
  select dp.deal_id into deal_id from public.deal_payments dp
  where dp.stripe_event_id = new.stripe_event_id;
  if deal_id is null then deal_id := automation.sync_stripe_deal(new.stripe_event_id); end if;
  if deal_id is not null then
    update public.deals set
      prospect_id = coalesce(public.deals.prospect_id, new.prospect_id),
      company_id = coalesce(public.deals.company_id, new.company_id),
      client_id = coalesce(public.deals.client_id, new.client_id),
      event_id = coalesce(public.deals.event_id, new.event_id),
      stage = case when new.event_id is not null and automation.deal_stage_rank(public.deals.stage) < 90
        then 'event_scheduled' else public.deals.stage end,
      next_action = case when new.event_id is not null then 'Complete client onboarding and confirm event readiness' else public.deals.next_action end,
      next_action_due_at = case when new.event_id is not null then now() else public.deals.next_action_due_at end,
      stage_source = case when new.event_id is not null and automation.deal_stage_rank(public.deals.stage) < 90 then 'client_conversion' else public.deals.stage_source end,
      stage_source_id = case when new.event_id is not null and automation.deal_stage_rank(public.deals.stage) < 90 then new.id::text else public.deals.stage_source_id end,
      updated_at = now()
    where id = deal_id;
  end if;
  return new;
end;
$$;

drop trigger if exists deals_touch_updated_at on public.deals;
create trigger deals_touch_updated_at before update on public.deals
for each row execute function automation.touch_updated_at();
drop trigger if exists deals_stage_history on public.deals;
create trigger deals_stage_history after insert or update of stage on public.deals
for each row execute function automation.record_deal_stage_change();
drop trigger if exists bookings_deal_sync on public.bookings;
create trigger bookings_deal_sync after insert or update of status on public.bookings
for each row execute function automation.on_booking_deal_sync();
drop trigger if exists stripe_events_deal_sync on public.stripe_events;
create trigger stripe_events_deal_sync after insert or update of payment_status,product_key on public.stripe_events
for each row execute function automation.on_stripe_deal_sync();
drop trigger if exists client_conversions_deal_sync on public.client_conversions;
create trigger client_conversions_deal_sync after insert or update of status,event_id,client_id on public.client_conversions
for each row execute function automation.on_conversion_deal_sync();

alter table public.deals enable row level security;
alter table public.deal_stage_history enable row level security;
alter table public.deal_payments enable row level security;
revoke all on table public.deals, public.deal_stage_history, public.deal_payments from anon, authenticated;
grant select, insert, update, delete on table public.deals, public.deal_stage_history, public.deal_payments to service_role;

revoke all on function automation.deal_stage_rank(text) from public, anon, authenticated;
revoke all on function automation.resolve_deal_company(uuid,text) from public, anon, authenticated;
revoke all on function automation.sync_booking_deal(uuid) from public, anon, authenticated;
revoke all on function automation.sync_stripe_deal(uuid) from public, anon, authenticated;
revoke all on function automation.record_deal_stage_change() from public, anon, authenticated;
revoke all on function automation.on_booking_deal_sync() from public, anon, authenticated;
revoke all on function automation.on_stripe_deal_sync() from public, anon, authenticated;
revoke all on function automation.on_conversion_deal_sync() from public, anon, authenticated;
grant execute on function automation.deal_stage_rank(text) to service_role;
grant execute on function automation.resolve_deal_company(uuid,text) to service_role;
grant execute on function automation.sync_booking_deal(uuid) to service_role;
grant execute on function automation.sync_stripe_deal(uuid) to service_role;
grant execute on function automation.record_deal_stage_change() to service_role;
grant execute on function automation.on_booking_deal_sync() to service_role;
grant execute on function automation.on_stripe_deal_sync() to service_role;
grant execute on function automation.on_conversion_deal_sync() to service_role;

-- Backfill all currently confirmed native bookings. At rollout this resolves
-- Alan's real booking without embedding a generated ID or email in the migration.
do $$
declare booking_id uuid;
begin
  for booking_id in select id from public.bookings where status = 'confirmed' loop
    perform automation.sync_booking_deal(booking_id);
  end loop;
end $$;

-- Backfill any verified deposits that arrived before this pipeline existed.
do $$
declare stripe_event_id uuid;
begin
  for stripe_event_id in
    select id from public.stripe_events
    where product_key = 'hosted_event_deposit' and payment_status = 'paid'
  loop
    perform automation.sync_stripe_deal(stripe_event_id);
  end loop;
end $$;
