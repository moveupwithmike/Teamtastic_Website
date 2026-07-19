alter table public.system_config
  add column if not exists phase3_apollo_discovery_enabled boolean not null default false,
  add column if not exists phase3_apollo_results_per_run integer not null default 10
    check (phase3_apollo_results_per_run between 1 and 25);

create table public.apollo_candidates (
  id uuid primary key default gen_random_uuid(),
  apollo_person_id text not null unique,
  apollo_organization_id text,
  first_name text,
  last_name text,
  full_name text,
  job_title text,
  linkedin_url text,
  location text,
  company_name text,
  company_domain text,
  company_employee_count integer check (company_employee_count is null or company_employee_count >= 0),
  status text not null default 'discovered'
    check (status in ('discovered','selected','enrichment_queued','enriched','rejected')),
  discovery_query jsonb not null default '{}'::jsonb,
  provider_summary jsonb not null default '{}'::jsonb,
  discovered_at timestamptz not null default now(),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index apollo_candidates_review_idx
  on public.apollo_candidates(status, discovered_at desc);
create index apollo_candidates_company_idx
  on public.apollo_candidates(company_domain, status)
  where company_domain is not null;

create trigger apollo_candidates_touch_updated_at
before update on public.apollo_candidates
for each row execute function automation.touch_updated_at();

alter table public.apollo_candidates enable row level security;
revoke all on table public.apollo_candidates from anon, authenticated;
grant select, insert, update, delete on table public.apollo_candidates to service_role;

create or replace function automation.trigger_phase3_apollo_discovery()
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
  from vault.decrypted_secrets where name = 'phase3_apollo_discovery_function_url' limit 1;
  select decrypted_secret into webhook_secret
  from vault.decrypted_secrets where name = 'phase3_apollo_discovery_webhook_secret' limit 1;
  if function_url is not null and webhook_secret is not null then
    perform net.http_post(
      url := function_url,
      headers := jsonb_build_object('Content-Type','application/json','x-webhook-secret',webhook_secret),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    );
  end if;
end;
$$;

revoke all on function automation.trigger_phase3_apollo_discovery() from public, anon, authenticated;

do $$
declare job_id bigint;
begin
  if exists (select 1 from cron.job where jobname='phase3-apollo-discovery') then
    perform cron.unschedule('phase3-apollo-discovery');
  end if;
  perform cron.schedule(
    'phase3-apollo-discovery',
    '0 12 * * 1-5',
    'select automation.trigger_phase3_apollo_discovery();'
  );
  select jobid into job_id from cron.job where jobname='phase3-apollo-discovery';
  perform cron.alter_job(job_id := job_id, active := false);
end $$;
