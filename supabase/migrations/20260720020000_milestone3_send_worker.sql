-- Milestone 3: outreach_drafts gains a terminal "sent"/"failed" state so the send
-- worker has somewhere to land results, plus the cron plumbing to trigger it. The
-- cron is created inactive — see the Milestone 3 rollout sequence for the manual
-- activation steps (this must not go active until the send worker has been verified
-- against a real send and the Resend webhook/auto-suppression is already live).

alter table public.outreach_drafts drop constraint if exists outreach_drafts_status_check;
alter table public.outreach_drafts add constraint outreach_drafts_status_check
  check (status in ('draft', 'review', 'approved', 'rejected', 'retired', 'sent', 'failed'));

alter table public.outreach_drafts
  add column if not exists sent_at timestamptz,
  add column if not exists provider_message_id text,
  add column if not exists send_error text;

alter table public.outreach_drafts drop constraint if exists outreach_drafts_sent_requires_metadata;
alter table public.outreach_drafts add constraint outreach_drafts_sent_requires_metadata
  check (status <> 'sent' or (sent_at is not null and provider_message_id is not null));

create or replace function automation.trigger_send_approved_outreach()
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
  from vault.decrypted_secrets where name = 'send_approved_outreach_function_url' limit 1;
  select decrypted_secret into webhook_secret
  from vault.decrypted_secrets where name = 'send_approved_outreach_webhook_secret' limit 1;
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

revoke all on function automation.trigger_send_approved_outreach() from public, anon, authenticated;

do $$
declare
  job_id bigint;
begin
  perform cron.schedule(
    'send-approved-outreach',
    '*/30 13-21 * * 1-5',
    'select automation.trigger_send_approved_outreach();'
  );
  select jobid into job_id from cron.job where jobname = 'send-approved-outreach';
  perform cron.alter_job(job_id := job_id, active := false);
end $$;
