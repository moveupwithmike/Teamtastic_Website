create or replace function automation.trigger_draft_sequence_followups()
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
  from vault.decrypted_secrets where name = 'draft_sequence_followups_function_url' limit 1;
  select decrypted_secret into webhook_secret
  from vault.decrypted_secrets where name = 'draft_sequence_followups_webhook_secret' limit 1;
  if function_url is not null and webhook_secret is not null then
    perform net.http_post(
      url := function_url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', webhook_secret),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    );
  end if;
end;
$$;

revoke all on function automation.trigger_draft_sequence_followups() from public, anon, authenticated;

do $$
declare
  job_id bigint;
begin
  if exists (select 1 from cron.job where jobname = 'draft-sequence-followups') then
    perform cron.unschedule('draft-sequence-followups');
  end if;
  perform cron.schedule(
    'draft-sequence-followups',
    '10 13 * * 1-5',
    'select automation.trigger_draft_sequence_followups();'
  );
  select jobid into job_id from cron.job where jobname = 'draft-sequence-followups';
  perform cron.alter_job(job_id := job_id, active := false);
end $$;
