create table public.conversion_health_runs (
  id uuid primary key default gen_random_uuid(),
  status text not null check(status in ('running','healthy','degraded','failed')),
  pages jsonb not null default '[]'::jsonb,
  checks_passed integer not null default 0,
  checks_failed integer not null default 0,
  error text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index conversion_health_runs_started_idx on public.conversion_health_runs(started_at desc);
alter table public.conversion_health_runs enable row level security;
revoke all on table public.conversion_health_runs from public,anon,authenticated;
grant select,insert,update,delete on table public.conversion_health_runs to service_role;

create or replace function automation.trigger_conversion_health_monitor()
returns void language plpgsql security invoker set search_path=''
as $$
declare organic_url text; webhook_secret text; audit_url text;
begin
  select decrypted_secret into organic_url from vault.decrypted_secrets where name='organic_collector_function_url' limit 1;
  select decrypted_secret into webhook_secret from vault.decrypted_secrets where name='organic_collector_webhook_secret' limit 1;
  audit_url:=regexp_replace(organic_url,'collect-organic-opportunities$','audit-conversion-pages');
  if audit_url is not null and webhook_secret is not null then
    perform net.http_post(url:=audit_url,headers:=jsonb_build_object('Content-Type','application/json','x-webhook-secret',webhook_secret),body:='{}'::jsonb,timeout_milliseconds:=30000);
  end if;
end; $$;
revoke all on function automation.trigger_conversion_health_monitor() from public,anon,authenticated;

do $job$
declare job_id bigint;
begin
  select jobid into job_id from cron.job where jobname='conversion-health-monitor' limit 1;
  if job_id is not null then perform cron.unschedule(job_id); end if;
  perform cron.schedule('conversion-health-monitor','10 12 * * *','select automation.trigger_conversion_health_monitor();');
end $job$;
