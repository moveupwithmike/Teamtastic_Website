-- Abandoned-checkout recovery guide.
--
-- Today a visitor who starts a Stripe checkout but never pays leaves a payment_requests row
-- stuck at 'active'/'checkout_created' with an expires_at +24h marker that nothing ever closes,
-- and -- critically -- no owner task, no CRM signal, and no recovery path. This migration gives
-- the existing status the one consumer it was missing: a tiny cron that (a) closes stale rows
-- as 'expired' and (b) creates a single office task per abandoned lead so the owner can decide
-- whether to reach out. No emails are sent here; everything stays in the human-review task queue.

create or replace function public.expire_stale_payment_requests(p_max integer default 50)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  pr record;
  expired_total integer := 0;
  task_total integer := 0;
begin
  if p_max < 1 or p_max > 500 then raise exception 'p_max must be between 1 and 500'; end if;

  for pr in
    select id, lead_id, payment_kind, amount_due_now_cents, currency, source
    from public.payment_requests
    where status in ('active', 'checkout_created')
      and expires_at < now()
      and not exists (
        select 1 from public.payment_requests paid_rq
        where paid_rq.lead_id = payment_requests.lead_id and paid_rq.status = 'paid'
      )
    order by expires_at asc
    limit p_max
    for update skip locked
  loop
    update public.payment_requests set status = 'expired', updated_at = now() where id = pr.id;
    expired_total := expired_total + 1;

    if pr.lead_id is not null then
      insert into public.tasks(prospect_id, title, description, priority, due_at, source, fingerprint)
      select l.prospect_id,
        'Stripe checkout abandoned — follow up',
        'A ' || coalesce(pr.payment_kind, 'payment') || ' payment request of ' ||
          coalesce(pr.amount_due_now_cents::text, '?') || ' cents was started but never paid. ' ||
          'Source: ' || coalesce(pr.source, 'unknown') || '. Ask whether they hit a blocker at checkout.',
        'normal', now() + interval '4 hours', 'payment_expiry', 'payment:abandoned:' || pr.id::text
      from public.leads l
      where l.id = pr.lead_id
      on conflict (fingerprint) where fingerprint is not null do nothing;
      task_total := task_total + 1;
    end if;
  end loop;

  insert into public.agent_log(agent_name, action, outcome, decision)
  values ('payment-expiry', 'expire_stale_payment_requests', 'completed',
    jsonb_build_object('expired', expired_total, 'tasks_created', task_total, 'emails_sent', false));
  return jsonb_build_object('expired', expired_total, 'tasks_created', task_total);
end;
$$;

revoke all on function public.expire_stale_payment_requests(integer) from public, anon, authenticated;
grant execute on function public.expire_stale_payment_requests(integer) to service_role;

do $$
declare job_id bigint;
begin
  if exists(select 1 from cron.job where jobname = 'expire-payment-requests') then
    perform cron.unschedule('expire-payment-requests');
  end if;
  perform cron.schedule('expire-payment-requests', '*/10 * * * *',
    'select public.expire_stale_payment_requests();');
end $$;