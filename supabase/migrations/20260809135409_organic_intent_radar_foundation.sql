alter table public.system_config
  add column if not exists organic_research_enabled boolean not null default false,
  add column if not exists organic_scoring_enabled boolean not null default false,
  add column if not exists organic_drafting_enabled boolean not null default false,
  add column if not exists organic_attribution_enabled boolean not null default false,
  add column if not exists organic_daily_opportunity_cap integer not null default 25 check (organic_daily_opportunity_cap between 0 and 250),
  add column if not exists organic_min_draft_score integer not null default 80 check (organic_min_draft_score between 0 and 100);

create table public.organic_sources (
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique,
  source_type text not null check (source_type in ('reddit_api','manual','public_web','existing_signal')),
  display_name text not null,
  enabled boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  daily_cap integer not null default 10 check (daily_cap between 0 and 100),
  last_run_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organic_source_runs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.organic_sources(id) on delete set null,
  status text not null default 'running' check (status in ('running','completed','skipped','failed')),
  records_scanned integer not null default 0,
  records_created integer not null default 0,
  decision jsonb not null default '{}'::jsonb,
  error text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.organic_opportunities (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.organic_sources(id) on delete set null,
  external_id text,
  source_url text not null,
  title text,
  excerpt text not null,
  author_display_name text,
  community text,
  published_at timestamptz,
  discovered_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '14 days'),
  persona text,
  intent_category text,
  team_size_signal text,
  seasonal_relevance text,
  intent_score integer check (intent_score between 0 and 100),
  score_reasons jsonb not null default '[]'::jsonb,
  confidence numeric(4,3) check (confidence between 0 and 1),
  status text not null default 'new' check (status in ('new','scored','review','drafted','approved','posted','dismissed','expired','blocked','converted')),
  recommended_page text,
  tracking_token uuid not null default gen_random_uuid() unique,
  fingerprint text not null unique,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index organic_opportunities_queue_idx on public.organic_opportunities(status, intent_score desc, discovered_at desc);
create index organic_opportunities_expiry_idx on public.organic_opportunities(expires_at) where status not in ('converted','dismissed','expired','blocked');

create table public.organic_response_drafts (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.organic_opportunities(id) on delete cascade,
  body_text text not null,
  tracked_url text,
  status text not null default 'draft' check (status in ('draft','review','approved','rejected','copied','posted','expired')),
  template_version text not null default 'helpful-response-v1',
  reviewed_at timestamptz,
  reviewed_by text,
  review_notes text,
  posted_url text,
  posted_at timestamptz,
  decision jsonb not null default '{}'::jsonb,
  fingerprint text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index organic_response_drafts_active_idx on public.organic_response_drafts(opportunity_id)
where status in ('draft','review','approved','copied');

create table public.organic_attribution (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.organic_opportunities(id) on delete cascade,
  draft_id uuid references public.organic_response_drafts(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  prospect_id uuid references public.prospects(id) on delete set null,
  deal_id uuid references public.deals(id) on delete set null,
  touch_type text not null check (touch_type in ('landing','lead','deal','booking','revenue')),
  landing_page text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  revenue numeric(12,2),
  fingerprint text not null unique,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.organic_sources enable row level security;
alter table public.organic_source_runs enable row level security;
alter table public.organic_opportunities enable row level security;
alter table public.organic_response_drafts enable row level security;
alter table public.organic_attribution enable row level security;

revoke all on table public.organic_sources, public.organic_source_runs, public.organic_opportunities,
  public.organic_response_drafts, public.organic_attribution from public, anon, authenticated;
grant select, insert, update, delete on table public.organic_sources, public.organic_source_runs, public.organic_opportunities,
  public.organic_response_drafts, public.organic_attribution to service_role;

insert into public.organic_sources(source_key, source_type, display_name, enabled, config, daily_cap)
values
  ('manual', 'manual', 'Manual opportunity intake', true, '{}'::jsonb, 25),
  ('reddit-approved-api', 'reddit_api', 'Reddit approved API', false,
   '{"queries":["virtual team building","corporate holiday party","remote team event"],"subreddits":[]}'::jsonb, 10),
  ('existing-signals', 'existing_signal', 'Existing Teamtastic signals', false, '{}'::jsonb, 10)
on conflict (source_key) do nothing;

create or replace function automation.expire_organic_opportunities()
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare affected integer;
begin
  update public.organic_opportunities
  set status = 'expired', updated_at = now()
  where expires_at <= now()
    and status in ('new','scored','review','drafted','approved');
  get diagnostics affected = row_count;
  update public.organic_response_drafts d
  set status = 'expired', updated_at = now()
  from public.organic_opportunities o
  where d.opportunity_id = o.id and o.status = 'expired'
    and d.status in ('draft','review','approved','copied');
  return affected;
end;
$$;

revoke all on function automation.expire_organic_opportunities() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'organic-opportunity-expiry') then
    perform cron.unschedule('organic-opportunity-expiry');
  end if;
  perform cron.schedule('organic-opportunity-expiry', '20 6 * * *', 'select automation.expire_organic_opportunities();');
end $$;
