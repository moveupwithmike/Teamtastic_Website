-- Schedules the quiz-abandoner nurture sequence (day 1 / day 3 / day 7 after
-- an event_quiz lead is captured, skipped once a matching stripe_events row
-- shows the deposit was paid). Reuses the existing notification_deliveries
-- table with notification_type values nurture_day1 / nurture_day3 / nurture_day7,
-- so delivery status is visible in the same monitoring queries as lead emails.

create extension if not exists pg_cron with schema extensions;

create or replace function public.trigger_nurture_emails()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  function_url text;
  webhook_secret text;
begin
  select decrypted_secret into function_url
  from vault.decrypted_secrets where name = 'nurture_function_url' limit 1;
  select decrypted_secret into webhook_secret
  from vault.decrypted_secrets where name = 'nurture_webhook_secret' limit 1;

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
$$;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'quiz-abandoner-nurture') then
    perform cron.unschedule('quiz-abandoner-nurture');
  end if;
end $$;

select cron.schedule(
  'quiz-abandoner-nurture',
  '0 * * * *',
  $$select public.trigger_nurture_emails();$$
);
