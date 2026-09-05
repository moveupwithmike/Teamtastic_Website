-- Connects Eddie's already-built (but until now always-false) marketing
-- connection booleans to real data. Adds one table for daily per-platform
-- snapshots, populated by a new decoupled Edge Function
-- (sync-marketing-performance) rather than live API calls from either the
-- daily report or Eddie's chat context -- both of those just read this
-- table, matching the same "sync writes, consumers read cheaply" split
-- already used for the voice brief. Read-only reporting only: nothing here
-- can write to any ad platform, matching collectEddieContext()'s existing
-- advertising_permissions (can_launch/can_pause/can_change_budget/can_spend
-- all false).

create table public.marketing_performance_snapshots (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('google_analytics', 'google_search_console', 'google_ads', 'meta_ads')),
  snapshot_date date not null,
  metrics jsonb not null default '{}'::jsonb,
  fetched_at timestamptz not null default now(),
  error text,
  unique (platform, snapshot_date)
);

create index marketing_performance_snapshots_recent_idx
  on public.marketing_performance_snapshots(platform, snapshot_date desc);

alter table public.marketing_performance_snapshots enable row level security;
revoke all on table public.marketing_performance_snapshots from public, anon, authenticated;
grant select, insert, update, delete on table public.marketing_performance_snapshots to service_role;

alter table public.system_config
  add column if not exists marketing_reporting_sync_enabled boolean not null default false;

create or replace function automation.trigger_marketing_performance_sync()
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
  from vault.decrypted_secrets where name = 'marketing_performance_sync_function_url' limit 1;
  select decrypted_secret into webhook_secret
  from vault.decrypted_secrets where name = 'marketing_performance_sync_webhook_secret' limit 1;
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

revoke all on function automation.trigger_marketing_performance_sync() from public, anon, authenticated;

-- Runs before the daily report (12:30 UTC) so that day's report/voice-brief
-- can include yesterday's marketing numbers. Shipped inactive -- activate
-- once at least one platform's credentials are configured and
-- marketing_reporting_sync_enabled is flipped on.
do $$
declare
  marketing_sync_job_id bigint;
begin
  perform cron.schedule(
    'sync-marketing-performance',
    '0 12 * * *',
    'select automation.trigger_marketing_performance_sync();'
  );
  select jobid into marketing_sync_job_id from cron.job where jobname = 'sync-marketing-performance';
  perform cron.alter_job(job_id := marketing_sync_job_id, active := false);
end $$;
