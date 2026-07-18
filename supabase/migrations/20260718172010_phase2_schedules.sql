create or replace function automation.trigger_gmail_reply_ingestion()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  function_url text;
  webhook_secret text;
begin
  select decrypted_secret into function_url
  from vault.decrypted_secrets where name = 'gmail_ingestion_function_url' limit 1;
  select decrypted_secret into webhook_secret
  from vault.decrypted_secrets where name = 'gmail_ingestion_webhook_secret' limit 1;
  if function_url is not null and webhook_secret is not null then
    perform net.http_post(
      url := function_url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', webhook_secret),
      body := '{}'::jsonb,
      timeout_milliseconds := 15000
    );
  end if;
end;
$$;

create or replace function automation.trigger_daily_sales_report()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  function_url text;
  webhook_secret text;
begin
  select decrypted_secret into function_url
  from vault.decrypted_secrets where name = 'daily_report_function_url' limit 1;
  select decrypted_secret into webhook_secret
  from vault.decrypted_secrets where name = 'daily_report_webhook_secret' limit 1;
  if function_url is not null and webhook_secret is not null then
    perform net.http_post(
      url := function_url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', webhook_secret),
      body := '{}'::jsonb,
      timeout_milliseconds := 15000
    );
  end if;
end;
$$;

revoke all on function automation.trigger_gmail_reply_ingestion() from public, anon, authenticated;
revoke all on function automation.trigger_daily_sales_report() from public, anon, authenticated;

do $$
declare
  gmail_job_id bigint;
begin
  perform cron.schedule(
    'gmail-reply-ingestion',
    '*/5 * * * *',
    'select automation.trigger_gmail_reply_ingestion();'
  );
  select jobid into gmail_job_id from cron.job where jobname = 'gmail-reply-ingestion';
  perform cron.alter_job(job_id := gmail_job_id, active := false);

  perform cron.schedule(
    'teamtastic-daily-report',
    '30 12 * * *',
    'select automation.trigger_daily_sales_report();'
  );
end $$;
