alter table public.system_config
  add column if not exists phase3_signal_company_limit integer not null default 5
    check (phase3_signal_company_limit between 1 and 25),
  add column if not exists phase3_signal_lookback_days integer not null default 7
    check (phase3_signal_lookback_days between 1 and 30);

create table if not exists public.signal_sources (
  id uuid primary key default gen_random_uuid(),
  provider text not null unique,
  display_name text not null,
  source_kind text not null check (source_kind in ('news', 'jobs', 'awards', 'expansion', 'manual')),
  enabled boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  last_run_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.signal_sources(provider, display_name, source_kind, enabled, config)
values (
  'gdelt',
  'GDELT public news index',
  'news',
  false,
  '{"endpoint":"https://api.gdeltproject.org/api/v2/doc/doc","format":"json","mode":"artlist"}'::jsonb
)
on conflict (provider) do nothing;

drop trigger if exists signal_sources_touch_updated_at on public.signal_sources;
create trigger signal_sources_touch_updated_at
before update on public.signal_sources
for each row execute function automation.touch_updated_at();

alter table public.signal_sources enable row level security;
revoke all on table public.signal_sources from anon, authenticated;
grant select, insert, update, delete on table public.signal_sources to service_role;

create or replace function automation.trigger_phase3_signal_collector()
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
  from vault.decrypted_secrets where name = 'phase3_signal_function_url' limit 1;
  select decrypted_secret into webhook_secret
  from vault.decrypted_secrets where name = 'phase3_signal_webhook_secret' limit 1;
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

revoke all on function automation.trigger_phase3_signal_collector() from public, anon, authenticated;

do $$
declare
  job_id bigint;
begin
  if exists (select 1 from cron.job where jobname = 'phase3-signal-collector') then
    perform cron.unschedule('phase3-signal-collector');
  end if;
  perform cron.schedule(
    'phase3-signal-collector',
    '30 12 * * 1-5',
    'select automation.trigger_phase3_signal_collector();'
  );
  select jobid into job_id from cron.job where jobname = 'phase3-signal-collector';
  perform cron.alter_job(job_id := job_id, active := false);
end $$;
