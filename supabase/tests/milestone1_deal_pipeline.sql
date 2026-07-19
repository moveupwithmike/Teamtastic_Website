begin;

do $$
declare
  payment_id uuid;
  prospect_id uuid;
  v_deal_id uuid;
  client_id uuid;
  event_id uuid;
  history_count integer;
  payment_count integer;
  deal_record public.deals%rowtype;
begin
  insert into public.stripe_events(
    stripe_event_id, stripe_session_id, customer_email, amount_total, currency,
    payment_status, checkout_mode, product_key, paid_at, matched
  ) values (
    'evt_milestone1_rollback', 'cs_milestone1_rollback',
    'milestone1-rollback@example.invalid', 20000, 'usd', 'paid', 'payment',
    'hosted_event_deposit', now(), false
  ) returning id into payment_id;

  select dp.deal_id, d.prospect_id into v_deal_id, prospect_id
  from public.deal_payments dp join public.deals d on d.id = dp.deal_id
  where dp.stripe_event_id = payment_id;
  select * into deal_record from public.deals where id = v_deal_id;
  if deal_record.stage <> 'deposit_paid' or deal_record.outcome <> 'won'
     or deal_record.expected_value <> 200 then
    raise exception 'deposit did not create the expected won deal';
  end if;

  perform automation.sync_stripe_deal(payment_id);
  perform automation.sync_stripe_deal(payment_id);
  select count(*) into payment_count from public.deal_payments where stripe_event_id = payment_id;
  if payment_count <> 1 then raise exception 'payment replay created duplicates'; end if;

  insert into public.clients(name, email, primary_contact_email, primary_prospect_id)
  values ('Milestone 1 rollback client', 'milestone1-rollback@example.invalid',
    'milestone1-rollback@example.invalid', prospect_id)
  returning id into client_id;

  insert into public.events(
    host_code, status, client_id, title, event_type, scheduled_start_time,
    contact_email, value
  ) values (
    'm1-' || left(replace(gen_random_uuid()::text, '-', ''), 16), 'scheduled',
    client_id, 'Milestone 1 rollback event', 'teamtastic', now() + interval '30 days',
    'milestone1-rollback@example.invalid', 200
  ) returning id into event_id;

  insert into public.client_conversions(
    stripe_event_id, prospect_id, client_id, event_id, status, amount, currency
  ) values (payment_id, prospect_id, client_id, event_id, 'converted', 200, 'usd');

  select * into deal_record from public.deals where id = v_deal_id;
  if deal_record.stage <> 'event_scheduled' or deal_record.client_id <> client_id
     or deal_record.event_id <> event_id then
    raise exception 'conversion did not advance and link the deal';
  end if;

  update public.client_conversions set status = status where stripe_event_id = payment_id;
  select count(*) into history_count from public.deal_stage_history where deal_id = v_deal_id;
  if history_count <> 2 then raise exception 'conversion replay created duplicate stage history'; end if;
  if not exists (
    select 1 from public.deal_stage_history
    where deal_id = v_deal_id and to_stage = 'deposit_paid' and exited_at is not null
  ) then raise exception 'previous stage duration was not closed'; end if;
end $$;

rollback;

select 'milestone1_deal_pipeline_rollback_test_passed' as result;
