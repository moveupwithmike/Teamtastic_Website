-- LOCAL TEST STUBS ONLY — NEVER DEPLOYED.
-- Replaces Supabase-managed extension objects (vault, pg_net, pg_cron) that a
-- plain postgres restore of the schema dump does not contain. The stubs make
-- trigger paths executable and observable in the local regression harness.

create schema if not exists vault;
create schema if not exists net;
create schema if not exists cron;

-- Observable secret store: tests insert rows to simulate configured secrets.
create table if not exists public.__test_vault_secrets (
  name text primary key,
  decrypted_secret text not null
);

create or replace view vault.decrypted_secrets as
  select name, decrypted_secret
  from public.__test_vault_secrets;

-- Observable HTTP dispatch sink: counts outbound calls made by triggers.
create table if not exists public.__test_net_calls (
  id bigint generated always as identity primary key,
  url text,
  body jsonb,
  called_at timestamptz default now()
);

create or replace function net.http_post(
  url text,
  headers jsonb default '{}'::jsonb,
  body jsonb default '{}'::jsonb
) returns bigint
language sql
as $$
  insert into public.__test_net_calls(url, body) values (url, body);
  select 1::bigint;
$$;

-- Minimal cron catalog used by automation.observe_final_production_certifications().
create table if not exists cron.job (
  jobid bigint primary key,
  jobname text,
  schedule text,
  command text,
  active boolean default true
);

create table if not exists cron.job_run_details (
  jobid bigint,
  runid bigint,
  job_pid bigint,
  status text,
  return_message text,
  start_time timestamptz,
  end_time timestamptz
);
