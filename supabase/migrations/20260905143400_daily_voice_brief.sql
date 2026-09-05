-- Adds an optional spoken/audio version of the existing daily sales report.
-- Ships disabled (daily_report_voice_brief_enabled defaults false) pending
-- real cost/quality validation, matching gmail_llm_classification_enabled's
-- rollout discipline. Generation happens in a separate, decoupled Edge
-- Function (generate-daily-voice-brief) that runs a few minutes after
-- send-daily-sales-report and only ever writes to the new columns below --
-- it can never affect that function's existing, reliable HTML email path.

alter table public.daily_reports
  add column if not exists audio_url text,
  add column if not exists transcript text,
  add column if not exists voice_brief_status text
    check (voice_brief_status in ('pending', 'ready', 'unavailable')),
  add column if not exists voice_brief_error text;

alter table public.system_config
  add column if not exists daily_report_voice_brief_enabled boolean not null default false;

-- Private bucket for the generated audio files. No storage.objects policy is
-- added for anon/authenticated: RLS is enabled by default on storage.objects
-- with no matching policy, so they get zero access; service_role bypasses
-- RLS as usual. Playback goes through a server-generated signed URL only.
insert into storage.buckets (id, name, public)
values ('daily-report-audio', 'daily-report-audio', false)
on conflict (id) do nothing;

create or replace function automation.trigger_daily_voice_brief()
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
  from vault.decrypted_secrets where name = 'daily_voice_brief_function_url' limit 1;
  select decrypted_secret into webhook_secret
  from vault.decrypted_secrets where name = 'daily_voice_brief_webhook_secret' limit 1;
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

revoke all on function automation.trigger_daily_voice_brief() from public, anon, authenticated;

-- Runs 5 minutes after teamtastic-daily-report (30 12 * * *), so it always
-- reads that day's already-written daily_reports row. Shipped inactive --
-- activate once AI_GATEWAY_API_KEY is configured as an Edge Function secret
-- and daily_report_voice_brief_enabled is flipped on.
do $$
declare
  voice_brief_job_id bigint;
begin
  perform cron.schedule(
    'daily-voice-brief',
    '35 12 * * *',
    'select automation.trigger_daily_voice_brief();'
  );
  select jobid into voice_brief_job_id from cron.job where jobname = 'daily-voice-brief';
  perform cron.alter_job(job_id := voice_brief_job_id, active := false);
end $$;
