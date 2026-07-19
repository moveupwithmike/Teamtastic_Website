-- Booking reminders: 24h and 1h before a confirmed call. Fail-closed behind
-- its own switch, reusing the existing 'booking' message type and cap so
-- reminders and confirmations share the same daily ceiling.

alter table public.system_config
  add column if not exists booking_reminders_enabled boolean not null default false;

alter table public.bookings
  add column if not exists reminder_24h_sent_at timestamptz,
  add column if not exists reminder_1h_sent_at timestamptz;

create or replace function public.trigger_booking_reminders()
returns void
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  function_url text;
  webhook_secret text;
begin
  select decrypted_secret into function_url
  from vault.decrypted_secrets where name = 'booking_reminders_function_url' limit 1;
  select decrypted_secret into webhook_secret
  from vault.decrypted_secrets where name = 'booking_reminders_webhook_secret' limit 1;

  if function_url is not null and webhook_secret is not null then
    perform net.http_post(
      url := function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-webhook-secret', webhook_secret
      ),
      body := '{}'::jsonb
    );
  end if;
end;
$function$;

do $$
declare
  job_id bigint;
begin
  if exists (select 1 from cron.job where jobname = 'send-booking-reminders') then
    perform cron.unschedule('send-booking-reminders');
  end if;
  perform cron.schedule(
    'send-booking-reminders',
    '*/15 * * * *',
    'select public.trigger_booking_reminders();'
  );
  select jobid into job_id from cron.job where jobname = 'send-booking-reminders';
  perform cron.alter_job(job_id := job_id, active := false);
end $$;
