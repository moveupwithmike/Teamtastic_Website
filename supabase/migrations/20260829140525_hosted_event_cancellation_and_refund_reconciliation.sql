-- Hosted-event cancellation policy + Stripe refund reconciliation.
--
-- Establishes refund ELIGIBILITY (tiered by time-to-event) and reconciles actual
-- Stripe refund events into CRM state. Does NOT issue refunds automatically —
-- issuing a refund in Stripe remains an explicit, manual, owner-authorized action.
-- See src/lib/cancellation-policy.js for the tier calculation (kept in one place,
-- JS-side, so the business rule is never duplicated/drifted between app and DB).

-- 1. Capture the PaymentIntent id on every processed checkout, not only ones that
--    went through payment_requests. Refund events are keyed by PaymentIntent/charge,
--    so this is required to resolve a refund back to the payment it belongs to.
alter table public.stripe_events
  add column if not exists stripe_payment_intent_id text;

create index if not exists stripe_events_payment_intent_idx
  on public.stripe_events(stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

-- 2. The game platform owns public.clients and public.events (see
--    20260718145314_autonomous_crm_foundation.sql). Extend, don't replace: add
--    cancellation/no-show markers as new columns, and never touch their existing
--    `status` values or check constraints.
alter table public.events
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancellation_reason text,
  add column if not exists no_show_at timestamptz,
  add column if not exists no_show_marked_by text;

-- 3. public.deals is fully owned by this repo (milestone1_deal_pipeline.sql) —
--    safe to extend its stage enum directly.
alter table public.deals
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancellation_reason text,
  add column if not exists no_show boolean not null default false,
  add column if not exists refund_status text not null default 'none'
    check (refund_status in ('none', 'partial', 'full')),
  add column if not exists amount_refunded numeric(12,2) not null default 0
    check (amount_refunded >= 0),
  add column if not exists refund_eligible_percent integer
    check (refund_eligible_percent is null or refund_eligible_percent between 0 and 100),
  add column if not exists refund_eligible_amount numeric(12,2)
    check (refund_eligible_amount is null or refund_eligible_amount >= 0);

alter table public.deals drop constraint if exists deals_stage_check;
alter table public.deals add constraint deals_stage_check check (stage in (
  'new_lead', 'qualified', 'call_booked', 'call_completed',
  'proposal_needed', 'proposal_sent', 'decision_pending',
  'deposit_paid', 'event_scheduled', 'completed', 'rebooking', 'cancelled', 'closed_lost'
));

alter table public.deals add column if not exists net_revenue numeric(12,2)
  generated always as (greatest(coalesce(expected_value, 0) - amount_refunded, 0)) stored;

-- 4. One row per Stripe Refund object. Multiple partial refunds against the same
--    payment are multiple rows here, aggregated on read (see reconcile_stripe_refund
--    below) rather than as a single mutable "amount refunded" field anywhere else —
--    this is what makes "multiple partial refunds" representable without drift.
create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  stripe_refund_id text not null unique,
  stripe_event_id uuid references public.stripe_events(id) on delete set null,
  stripe_payment_intent_id text,
  stripe_charge_id text,
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'usd' check (currency = lower(currency) and length(currency) = 3),
  status text not null check (status in ('pending', 'requires_action', 'succeeded', 'failed', 'canceled')),
  reason text,
  failure_reason text,
  -- The Refund object's own immutable `created` (when Stripe created the refund).
  stripe_created_at timestamptz not null,
  -- The most recent *webhook event*'s `created` that updated this row — distinct
  -- from stripe_created_at, which never changes. Guards against out-of-order and
  -- duplicate webhook delivery: an incoming event only applies if it is at least
  -- as new as the last one we already applied for this refund.
  last_stripe_event_id text,
  last_stripe_event_created_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index refunds_stripe_event_idx on public.refunds(stripe_event_id) where stripe_event_id is not null;
create index refunds_payment_intent_idx on public.refunds(stripe_payment_intent_id) where stripe_payment_intent_id is not null;
create index refunds_status_idx on public.refunds(status);

alter table public.refunds enable row level security;
revoke all on table public.refunds from anon, authenticated;
grant select, insert, update, delete on table public.refunds to service_role;

drop trigger if exists refunds_touch_updated_at on public.refunds;
create trigger refunds_touch_updated_at before update on public.refunds
for each row execute function automation.touch_updated_at();

-- 5. Idempotent, out-of-order-safe refund reconciliation. Called once per
--    refund.created / refund.updated / refund.failed webhook delivery.
create or replace function public.reconcile_stripe_refund(
  p_stripe_refund_id text,
  p_stripe_payment_intent_id text,
  p_stripe_charge_id text,
  p_amount_cents integer,
  p_currency text,
  p_status text,
  p_reason text,
  p_failure_reason text,
  p_stripe_refund_created_at timestamptz,
  p_stripe_event_created_at timestamptz,
  p_stripe_event_id text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  refund_row public.refunds%rowtype;
  matched_stripe_event public.stripe_events%rowtype;
  matched_deal public.deals%rowtype;
  total_paid_cents integer;
  total_refunded_cents integer;
  new_refund_status text;
  will_auto_cancel boolean;
begin
  if p_status not in ('pending', 'requires_action', 'succeeded', 'failed', 'canceled') then
    return jsonb_build_object('reconciled', false, 'reason', 'unknown_refund_status');
  end if;
  if p_stripe_refund_id is null or trim(p_stripe_refund_id) = '' then
    return jsonb_build_object('reconciled', false, 'reason', 'missing_refund_id');
  end if;

  if p_stripe_payment_intent_id is not null then
    select * into matched_stripe_event from public.stripe_events
    where stripe_payment_intent_id = p_stripe_payment_intent_id
    order by created_at desc limit 1;
  end if;

  insert into public.refunds(
    stripe_refund_id, stripe_event_id, stripe_payment_intent_id, stripe_charge_id,
    amount_cents, currency, status, reason, failure_reason,
    stripe_created_at, last_stripe_event_id, last_stripe_event_created_at
  ) values (
    p_stripe_refund_id, matched_stripe_event.id, p_stripe_payment_intent_id, p_stripe_charge_id,
    p_amount_cents, p_currency, p_status, p_reason, p_failure_reason,
    p_stripe_refund_created_at, p_stripe_event_id, p_stripe_event_created_at
  )
  on conflict (stripe_refund_id) do update set
    status = excluded.status,
    amount_cents = excluded.amount_cents,
    failure_reason = excluded.failure_reason,
    stripe_event_id = coalesce(public.refunds.stripe_event_id, excluded.stripe_event_id),
    last_stripe_event_id = excluded.last_stripe_event_id,
    last_stripe_event_created_at = excluded.last_stripe_event_created_at,
    updated_at = now()
  where excluded.last_stripe_event_created_at >= public.refunds.last_stripe_event_created_at
  returning * into refund_row;

  if refund_row.id is null then
    -- The WHERE guard rejected an older/duplicate event for a refund we already
    -- have newer data for. Not an error — just a no-op.
    select * into refund_row from public.refunds where stripe_refund_id = p_stripe_refund_id;
    return jsonb_build_object(
      'reconciled', true, 'applied', false, 'reason', 'stale_or_duplicate_event',
      'refund_id', refund_row.id
    );
  end if;

  if refund_row.stripe_event_id is null then
    return jsonb_build_object('reconciled', true, 'applied', true, 'matched_deal', false, 'reason', 'no_matching_payment');
  end if;

  select * into matched_stripe_event from public.stripe_events where id = refund_row.stripe_event_id;
  select d.* into matched_deal from public.deals d
  join public.deal_payments dp on dp.deal_id = d.id
  where dp.stripe_event_id = matched_stripe_event.id
  order by d.updated_at desc limit 1
  for update;

  if matched_deal.id is null then
    return jsonb_build_object('reconciled', true, 'applied', true, 'matched_deal', false, 'reason', 'no_deal_for_payment');
  end if;

  select coalesce(sum(amount_cents), 0) into total_refunded_cents
  from public.refunds
  where stripe_event_id = matched_stripe_event.id and status = 'succeeded';

  total_paid_cents := coalesce(matched_stripe_event.amount_total, 0);
  new_refund_status := case
    when total_refunded_cents <= 0 then 'none'
    when total_paid_cents > 0 and total_refunded_cents >= total_paid_cents then 'full'
    else 'partial'
  end;
  -- A full refund that nobody has explicitly recorded a cancellation for yet is
  -- almost certainly a cancelled event reconciled from Stripe directly (e.g. the
  -- refund was issued from the Stripe Dashboard without going through the office
  -- cancellation action first). Reflect that reality; do not touch a deal that is
  -- already cancelled/closed_lost, and never move an *earlier* stage backwards.
  will_auto_cancel := new_refund_status = 'full'
    and matched_deal.cancelled_at is null
    and matched_deal.stage not in ('cancelled', 'closed_lost');

  update public.deals set
    amount_refunded = round(total_refunded_cents::numeric / 100, 2),
    refund_status = new_refund_status,
    stage = case when will_auto_cancel then 'cancelled' else stage end,
    cancelled_at = case when will_auto_cancel then now() else cancelled_at end,
    cancellation_reason = case when will_auto_cancel then 'stripe_full_refund_detected' else cancellation_reason end,
    stage_source = case when will_auto_cancel then 'stripe_refund_reconciliation' else stage_source end,
    stage_source_id = case when will_auto_cancel then p_stripe_refund_id else stage_source_id end,
    updated_at = now()
  where id = matched_deal.id;

  if matched_deal.event_id is not null and will_auto_cancel then
    update public.events set
      cancelled_at = coalesce(cancelled_at, now()),
      cancellation_reason = coalesce(cancellation_reason, 'stripe_full_refund_detected'),
      updated_at = now()
    where id = matched_deal.event_id;
  end if;

  insert into public.agent_log(agent_name, action, outcome, decision)
  values ('stripe-webhook', 'reconcile_refund', 'completed', jsonb_build_object(
    'refund_id', refund_row.id, 'stripe_refund_id', p_stripe_refund_id,
    'deal_id', matched_deal.id, 'status', p_status,
    'amount_refunded_cents', total_refunded_cents, 'refund_status', new_refund_status,
    'auto_cancelled', will_auto_cancel
  ));

  return jsonb_build_object(
    'reconciled', true, 'applied', true, 'matched_deal', true,
    'deal_id', matched_deal.id, 'refund_status', new_refund_status,
    'amount_refunded_cents', total_refunded_cents, 'auto_cancelled', will_auto_cancel
  );
end;
$$;

revoke all on function public.reconcile_stripe_refund(
  text, text, text, integer, text, text, text, text, timestamptz, timestamptz, text
) from public, anon, authenticated;
grant execute on function public.reconcile_stripe_refund(
  text, text, text, integer, text, text, text, text, timestamptz, timestamptz, text
) to service_role;

-- 6. Explicit, authorized cancellation action (called from the office, never
--    automatically). Establishes refund ELIGIBILITY and records it as a task for
--    a human to action in Stripe — it never calls the Stripe API itself.
create or replace function public.record_hosted_event_cancellation(
  p_deal_id uuid,
  p_actor text,
  p_reason text,
  p_no_show boolean default false,
  p_refund_eligible_percent integer default null,
  p_refund_eligible_amount_cents integer default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  deal_record public.deals%rowtype;
begin
  select * into deal_record from public.deals where id = p_deal_id for update;
  if deal_record.id is null then
    return jsonb_build_object('recorded', false, 'reason', 'deal_not_found');
  end if;
  if deal_record.stage in ('cancelled', 'closed_lost') then
    return jsonb_build_object('recorded', false, 'reason', 'already_cancelled', 'deal_id', deal_record.id);
  end if;

  update public.deals set
    stage = 'cancelled',
    cancelled_at = now(),
    cancellation_reason = p_reason,
    no_show = p_no_show,
    refund_eligible_percent = p_refund_eligible_percent,
    refund_eligible_amount = case when p_refund_eligible_amount_cents is null then null
      else round(p_refund_eligible_amount_cents::numeric / 100, 2) end,
    stage_source = 'office_cancellation',
    stage_source_id = p_actor,
    updated_at = now()
  where id = p_deal_id;

  if deal_record.event_id is not null then
    update public.events set
      cancelled_at = coalesce(cancelled_at, now()),
      cancellation_reason = coalesce(cancellation_reason, p_reason),
      no_show_at = case when p_no_show then coalesce(no_show_at, now()) else no_show_at end,
      no_show_marked_by = case when p_no_show then coalesce(no_show_marked_by, p_actor) else no_show_marked_by end,
      updated_at = now()
    where id = deal_record.event_id;
  end if;

  if coalesce(p_refund_eligible_amount_cents, 0) > 0 then
    insert into public.tasks(
      prospect_id, client_id, event_id, title, description, priority, due_at, source, fingerprint
    ) values (
      deal_record.prospect_id, deal_record.client_id, deal_record.event_id,
      'Issue Stripe refund: $' || to_char(p_refund_eligible_amount_cents / 100.0, 'FM999999990.00')
        || ' (' || p_refund_eligible_percent || '%) — ' || deal_record.title,
      'Cancellation policy calculated this refund based on time-to-event. This system does not '
        || 'auto-refund — issue it manually in Stripe once confirmed. Reason given: '
        || coalesce(nullif(trim(p_reason), ''), 'not provided'),
      'urgent', now(), 'hosted_event_cancellation',
      'cancellation_refund_task:' || deal_record.id::text
    ) on conflict (fingerprint) where fingerprint is not null do nothing;
  end if;

  insert into public.agent_log(agent_name, action, outcome, decision)
  values ('office-cancellation', 'cancel_hosted_event', 'completed', jsonb_build_object(
    'deal_id', deal_record.id, 'actor', p_actor, 'no_show', p_no_show,
    'refund_eligible_percent', p_refund_eligible_percent,
    'refund_eligible_amount_cents', p_refund_eligible_amount_cents
  ));

  return jsonb_build_object('recorded', true, 'deal_id', deal_record.id, 'event_id', deal_record.event_id);
end;
$$;

revoke all on function public.record_hosted_event_cancellation(uuid, text, text, boolean, integer, integer)
  from public, anon, authenticated;
grant execute on function public.record_hosted_event_cancellation(uuid, text, text, boolean, integer, integer)
  to service_role;

-- 7. Nurture/lifecycle automations must not keep preparing a cancelled event.
--    Same body as automation.prepare_phase4_lifecycle() in
--    20260718224523_phase4_client_lifecycle_foundation.sql, with cancelled events
--    excluded from onboarding tasks, pre-event readiness tasks, and post-event
--    thank-you/testimonial/rebook/anniversary sequences.
create or replace function automation.prepare_phase4_lifecycle()
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  config public.system_config%rowtype;
  onboarding_count integer := 0;
  pre_event_count integer := 0;
  action_count integer := 0;
  review_count integer := 0;
begin
  select * into config from public.system_config where id = true;
  if config.id is null or not config.master_enabled then
    return jsonb_build_object('prepared', false, 'reason', 'master_kill_switch');
  end if;
  if not config.phase4_lifecycle_enabled then
    return jsonb_build_object('prepared', false, 'reason', 'phase4_lifecycle_disabled');
  end if;

  insert into public.tasks(client_id, event_id, title, description, priority, due_at, source, fingerprint)
  select e.client_id, e.id, 'Complete client onboarding checklist',
    'Confirm primary contact, event goals, attendee count, format, timing, and facilitator notes.',
    'high', greatest(now(), e.scheduled_start_time - interval '14 days'),
    'phase4_lifecycle', 'phase4:onboarding:' || e.id::text
  from public.events e
  where e.client_id is not null
    and e.scheduled_start_time is not null
    and e.status in ('lobby', 'scheduled')
    and e.cancelled_at is null
  on conflict (fingerprint) where fingerprint is not null do nothing;
  get diagnostics onboarding_count = row_count;

  insert into public.tasks(client_id, event_id, title, description, priority, due_at, source, fingerprint)
  select e.client_id, e.id, 'Run seven-day event readiness check',
    'Confirm final headcount, links or venue details, run of show, accessibility needs, and organizer expectations.',
    'high', greatest(now(), e.scheduled_start_time - interval '7 days'),
    'phase4_lifecycle', 'phase4:pre_event:' || e.id::text
  from public.events e
  where e.client_id is not null
    and e.scheduled_start_time is not null
    and e.status in ('lobby', 'scheduled')
    and e.cancelled_at is null
  on conflict (fingerprint) where fingerprint is not null do nothing;
  get diagnostics pre_event_count = row_count;

  insert into public.lifecycle_actions(
    client_id, event_id, prospect_id, action_type, recipient_email,
    subject, body_text, scheduled_for, status, decision, fingerprint
  )
  select e.client_id, e.id, c.primary_prospect_id, template.action_type,
    lower(trim(coalesce(e.contact_email, c.primary_contact_email, c.email))),
    template.subject,
    replace(replace(template.body_text, '{{client}}', c.name), '{{event}}', coalesce(e.title, 'your Teamtastic event')),
    coalesce(e.scheduled_start_time, e.updated_at) + template.delay,
    case when coalesce(e.scheduled_start_time, e.updated_at) + template.delay <= now() then 'review' else 'scheduled' end,
    jsonb_build_object('send_enabled', false, 'template_version', 'phase4-v1'),
    'phase4:' || template.action_type || ':' || e.id::text
  from public.events e
  join public.clients c on c.id = e.client_id
  cross join (values
    ('thank_you_review', interval '48 hours', 'Thank you from Teamtastic',
      'Hi {{client}},\n\nThank you for trusting Teamtastic with {{event}}. We hope your team left laughing, connecting, and still talking about the experience.\n\nIf the event delivered what you hoped for, would you be open to sharing a quick review?\n\nMichael'),
    ('testimonial_request', interval '7 days', 'A quick Teamtastic favor',
      'Hi {{client}},\n\nWhat is one moment from {{event}} that your team is still talking about? If you are comfortable sharing it, we would love to feature your words as a Teamtastic testimonial.\n\nMichael'),
    ('rebook_90_day', interval '90 days', 'Ready for another round?',
      'Hi {{client}},\n\nIt has been a little while since {{event}}. If another team gathering is taking shape, I would be happy to send a few fresh ideas—and Teamtastic can handle the experience from start to finish.\n\nMichael'),
    ('anniversary', interval '1 year', 'One year since {{event}}',
      'Hi {{client}},\n\nIt has been a year since {{event}}. If the team is ready for a rematch, we have fresh ways to get everyone laughing, participating, and connecting again.\n\nMichael')
  ) as template(action_type, delay, subject, body_text)
  where e.client_id is not null
    and e.status = 'completed'
    and e.cancelled_at is null
    and coalesce(e.contact_email, c.primary_contact_email, c.email) is not null
  on conflict (fingerprint) do nothing;
  get diagnostics action_count = row_count;

  update public.lifecycle_actions
  set status = 'review', updated_at = now()
  where status = 'scheduled' and scheduled_for <= now();
  get diagnostics review_count = row_count;

  insert into public.agent_log(agent_name, action, outcome, decision)
  values ('phase4-lifecycle', 'prepare_lifecycle', 'completed', jsonb_build_object(
    'onboarding_tasks', onboarding_count,
    'pre_event_tasks', pre_event_count,
    'actions_created', action_count,
    'moved_to_review', review_count,
    'send_enabled', false
  ));

  return jsonb_build_object(
    'prepared', true,
    'onboarding_tasks', onboarding_count,
    'pre_event_tasks', pre_event_count,
    'actions_created', action_count,
    'moved_to_review', review_count,
    'send_enabled', false
  );
end;
$$;
