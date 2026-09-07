-- Daily autopilot: a dedicated switch plus the global master switch gate the loop that prepares
-- (never publishes) the desk each morning. autopilot_runs records each loop
-- attempt so the cron stays idempotent across the two daylight-saving calls.

alter table public.system_config
  add column if not exists desk_autopilot_enabled boolean not null default false;

create table public.autopilot_runs (
  id uuid primary key default gen_random_uuid(),
  trigger text not null check (trigger in ('office', 'vercel_cron')),
  status text not null default 'running' check (status in ('running', 'completed', 'failed')),
  generation_date date not null,
  steps jsonb not null default '{}'::jsonb,
  error text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create unique index autopilot_runs_active_date_idx
  on public.autopilot_runs(generation_date) where status in ('running', 'completed');
create index autopilot_runs_recent_idx on public.autopilot_runs(started_at desc);

alter table public.autopilot_runs enable row level security;
revoke all on table public.autopilot_runs from public, anon, authenticated;
grant select, insert, update, delete on table public.autopilot_runs to service_role;

create trigger autopilot_runs_touch_updated_at
  before update on public.autopilot_runs
  for each row execute function automation.touch_updated_at();
