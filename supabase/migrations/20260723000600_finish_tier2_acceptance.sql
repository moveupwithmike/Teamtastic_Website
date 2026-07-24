-- Finish Tier 2 acceptance: one paid-event predicate for conversion and nurture.

create or replace function automation.is_qualifying_paid_hosted_event(p_stripe_event_id uuid)
returns boolean
language sql
stable
security invoker
set search_path=''
as $$
  select exists(
    select 1
    from public.stripe_events s
    left join public.payment_requests pr on pr.id=s.payment_request_id
    where s.id=p_stripe_event_id
      and s.product_key='hosted_event_deposit'
      and s.payment_status='paid'
      and s.amount_total>0
      and (s.payment_request_id is null or pr.status='paid')
  )
$$;
revoke all on function automation.is_qualifying_paid_hosted_event(uuid)
  from public,anon,authenticated;
grant execute on function automation.is_qualifying_paid_hosted_event(uuid)
  to service_role;

create or replace function automation.lead_has_paid_hosted_event(p_lead_id uuid)
returns boolean
language sql
stable
security invoker
set search_path=''
as $$
  select exists(
    select 1
    from public.stripe_events s
    join public.leads l on l.id=p_lead_id
    where (
        s.lead_id=p_lead_id
        or (
          s.lead_id is null
          and s.customer_email is not null
          and lower(trim(s.customer_email))=l.email_normalized
        )
      )
      and automation.is_qualifying_paid_hosted_event(s.id)
  )
$$;
revoke all on function automation.lead_has_paid_hosted_event(uuid)
  from public,anon,authenticated;
grant execute on function automation.lead_has_paid_hosted_event(uuid)
  to service_role;

-- Preserve the existing conversion implementation behind a validating wrapper.
-- The wrapper makes webhook, backfill, and direct RPC callers share the same
-- eligibility rule without duplicating the large lifecycle transaction.
alter function public.process_paid_conversion(uuid)
  rename to process_paid_conversion_after_eligibility;

revoke all on function public.process_paid_conversion_after_eligibility(uuid)
  from public,anon,authenticated;
grant execute on function public.process_paid_conversion_after_eligibility(uuid)
  to service_role;

create function public.process_paid_conversion(p_stripe_event_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
begin
  if not automation.is_qualifying_paid_hosted_event(p_stripe_event_id) then
    return jsonb_build_object(
      'converted',false,
      'reason','not_a_qualifying_paid_hosted_event_deposit'
    );
  end if;
  return public.process_paid_conversion_after_eligibility(p_stripe_event_id);
end;
$$;
revoke all on function public.process_paid_conversion(uuid)
  from public,anon,authenticated;
grant execute on function public.process_paid_conversion(uuid)
  to service_role;

-- Deal synchronization is also invoked directly by a Stripe-event trigger and
-- an older backfill. Guard both through the same eligibility function.
alter function automation.sync_stripe_deal(uuid)
  rename to sync_stripe_deal_after_eligibility;

revoke all on function automation.sync_stripe_deal_after_eligibility(uuid)
  from public,anon,authenticated;
grant execute on function automation.sync_stripe_deal_after_eligibility(uuid)
  to service_role;

create function automation.sync_stripe_deal(p_stripe_event_id uuid)
returns uuid
language plpgsql
security invoker
set search_path=''
as $$
begin
  if not automation.is_qualifying_paid_hosted_event(p_stripe_event_id) then
    return null;
  end if;
  return automation.sync_stripe_deal_after_eligibility(p_stripe_event_id);
end;
$$;
revoke all on function automation.sync_stripe_deal(uuid)
  from public,anon,authenticated;
grant execute on function automation.sync_stripe_deal(uuid)
  to service_role;
