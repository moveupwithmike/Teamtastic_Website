-- Weekly, read-only monitoring of a small approved set of public competitor pages.
-- Findings become owner-reviewed Eddie recommendations; nothing is published or spent.

alter table public.system_config
  add column if not exists family_competitor_research_enabled boolean not null default true;

create table public.family_competitor_sources (
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique,
  name text not null,
  public_url text not null,
  audience text not null default 'family_private_events',
  enabled boolean not null default true,
  last_checked_at timestamptz,
  last_changed_at timestamptz,
  last_http_status integer,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (public_url ~ '^https://')
);

create table public.family_competitor_snapshots (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.family_competitor_sources(id) on delete cascade,
  content_hash text not null,
  page_title text,
  page_description text,
  content_excerpt text not null,
  http_status integer not null,
  fetched_at timestamptz not null default now(),
  unique (source_id, content_hash)
);

create table public.family_competitor_research_runs (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'running' check (status in ('running','completed','partial','failed','skipped')),
  sources_checked integer not null default 0,
  sources_changed integer not null default 0,
  recommendations_created integer not null default 0,
  results jsonb not null default '[]'::jsonb,
  error text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index family_competitor_snapshots_source_fetched_idx
  on public.family_competitor_snapshots(source_id, fetched_at desc);
create index family_competitor_research_runs_started_idx
  on public.family_competitor_research_runs(started_at desc);

alter table public.family_competitor_sources enable row level security;
alter table public.family_competitor_snapshots enable row level security;
alter table public.family_competitor_research_runs enable row level security;
revoke all on table public.family_competitor_sources, public.family_competitor_snapshots, public.family_competitor_research_runs from public, anon, authenticated;
grant select, insert, update, delete on table public.family_competitor_sources, public.family_competitor_snapshots, public.family_competitor_research_runs to service_role;

drop trigger if exists family_competitor_sources_touch_updated_at on public.family_competitor_sources;
create trigger family_competitor_sources_touch_updated_at before update on public.family_competitor_sources
for each row execute function automation.touch_updated_at();

insert into public.family_competitor_sources (source_key, name, public_url) values
  ('virtual-game-night', 'Virtual Game Night', 'https://www.virtualgamenight.live/'),
  ('supermix-virtual-game-night', 'Supermix Entertainment', 'https://supermixentertainment.com/virtual-game-night'),
  ('online-office-party', 'Online Office Party', 'https://onlineofficeparty.com/'),
  ('kraftylab-virtual', 'KraftyLab', 'https://www.kraftylab.com/virtual')
on conflict (source_key) do update set name=excluded.name, public_url=excluded.public_url, updated_at=now();

create or replace function automation.trigger_family_competitor_research()
returns void language plpgsql security invoker set search_path='' as $$
declare function_url text; webhook_secret text;
begin
  select decrypted_secret into function_url from vault.decrypted_secrets where name='family_competitor_research_function_url' limit 1;
  select decrypted_secret into webhook_secret from vault.decrypted_secrets where name='organic_collector_webhook_secret' limit 1;
  if function_url is not null and webhook_secret is not null then
    perform net.http_post(url:=function_url,headers:=jsonb_build_object('Content-Type','application/json','x-webhook-secret',webhook_secret),body:='{}'::jsonb,timeout_milliseconds:=30000);
  end if;
end;
$$;
revoke all on function automation.trigger_family_competitor_research() from public,anon,authenticated;

do $job$
declare job_id bigint;
begin
  select jobid into job_id from cron.job where jobname='family-competitor-research' limit 1;
  if job_id is not null then perform cron.unschedule(job_id); end if;
  perform cron.schedule('family-competitor-research','20 13 * * 1','select automation.trigger_family_competitor_research();');
end $job$;
