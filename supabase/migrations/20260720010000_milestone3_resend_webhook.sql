-- Milestone 3: Resend delivery webhook ingestion and outbound deliverability auto-pause.
-- This is the hard prerequisite for the outbound send worker (a later migration) — bounce
-- and complaint suppression must be live and verified against a real webhook delivery
-- before anything is allowed to send cold outreach.

create table public.resend_webhook_events (
  id uuid primary key default gen_random_uuid(),
  svix_id text not null unique,
  event_type text not null,
  provider_message_id text,
  recipient text,
  raw_payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz not null default now()
);

alter table public.system_config
  add column if not exists outbound_auto_paused boolean not null default false;

-- Lives in public, not automation, because it's called via PostgREST RPC from the
-- Resend webhook route (application code) — automation.* is reserved for functions
-- only ever invoked from SQL triggers/cron.
create or replace function public.check_outbound_deliverability()
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  sent_count integer;
  bounce_count integer;
  complaint_count integer;
  bounce_rate numeric;
  complaint_rate numeric;
  should_pause boolean;
begin
  select
    count(*) filter (where status in ('sent', 'delivered', 'bounced', 'complained')),
    count(*) filter (where status = 'bounced'),
    count(*) filter (where status = 'complained')
  into sent_count, bounce_count, complaint_count
  from public.messages
  where direction = 'outbound'
    and message_type = 'prospecting'
    and created_at >= now() - interval '7 days';

  bounce_rate := case when sent_count > 0 then bounce_count::numeric / sent_count else 0 end;
  complaint_rate := case when sent_count > 0 then complaint_count::numeric / sent_count else 0 end;
  -- Minimum sample guard: one bounce out of two sends should not look like a crisis.
  should_pause := sent_count >= 10 and (bounce_rate >= 0.05 or complaint_rate >= 0.001);

  if should_pause then
    update public.system_config
    set outbound_auto_paused = true, updated_at = now()
    where id = true and not outbound_auto_paused;
    if found then
      insert into public.agent_log(agent_name, action, outcome, decision)
      values ('outbound-deliverability', 'check_outbound_deliverability', 'blocked',
        jsonb_build_object(
          'sent_count', sent_count, 'bounce_count', bounce_count, 'complaint_count', complaint_count,
          'bounce_rate', bounce_rate, 'complaint_rate', complaint_rate
        ));
    end if;
  end if;

  return jsonb_build_object(
    'sent_count', sent_count, 'bounce_count', bounce_count, 'complaint_count', complaint_count,
    'bounce_rate', bounce_rate, 'complaint_rate', complaint_rate, 'paused', should_pause
  );
end;
$$;

alter table public.resend_webhook_events enable row level security;
revoke all on table public.resend_webhook_events from anon, authenticated;
grant select, insert on table public.resend_webhook_events to service_role;

revoke all on function public.check_outbound_deliverability() from public, anon, authenticated;
grant execute on function public.check_outbound_deliverability() to service_role;
