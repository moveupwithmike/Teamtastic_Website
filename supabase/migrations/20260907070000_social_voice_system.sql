-- Phase 3 (M2): the voice system becomes editable and drives the morning
-- generator. social_voice_entries already exists from M1; this adds the
-- presentation + ordering fields the Office voice page and the generator use,
-- plus a review-only generator switch. The generator only produces drafts:
-- everything remains approval-gated and publication switches stay independent.

alter table public.social_voice_entries
  add column if not exists label text,
  add column if not exists examples jsonb not null default '[]'::jsonb,
  add column if not exists sort_order integer not null default 0;

create index if not exists social_voice_entries_sort_idx
  on public.social_voice_entries(enabled, kind, sort_order);

-- The morning generator proposes drafts only (nothing publishes on its own),
-- so it defaults on like the legacy prepare_distribution_queue RPC. Every
-- publish switch elsewhere still defaults to off.
alter table public.system_config
  add column if not exists social_generator_enabled boolean not null default true;

-- One row per Eastern business date is the generator's idempotency lock.
-- Vercel may retry a Cron invocation, and our daylight-saving-safe schedule
-- intentionally reaches the route twice; neither case may create extra drafts.
create table if not exists public.social_generation_runs (
  id uuid primary key default gen_random_uuid(),
  generation_date date not null unique,
  status text not null default 'running'
    check (status in ('running', 'completed', 'failed')),
  trigger text not null default 'office'
    check (trigger in ('office', 'vercel_cron')),
  created_count integer not null default 0 check (created_count >= 0),
  batch_id uuid,
  result jsonb not null default '{}'::jsonb,
  error text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists social_generation_runs_status_idx
  on public.social_generation_runs(status, generation_date desc);

alter table public.social_generation_runs enable row level security;
revoke all on table public.social_generation_runs from public, anon, authenticated;
grant select, insert, update, delete on table public.social_generation_runs to service_role;

drop trigger if exists social_generation_runs_touch_updated_at on public.social_generation_runs;
create trigger social_generation_runs_touch_updated_at before update on public.social_generation_runs
for each row execute function automation.touch_updated_at();

-- Additional approved copy so the generator has material in every group.
insert into public.social_voice_entries (id, kind, label, body, examples, source, source_ref, sort_order, enabled, approved_by, approved_at)
values
  ('3f6b1e4e-0001-4e4e-8c4e-000000000050', 'opener', 'Direct', 'Straight to the point: a team that plays together stays together.', '["Great for LinkedIn"]', 'TEAMTASTIC_OUTREACH_VOICE.md', 'Opener library', 1, true, 'michael@teamtastic.events', now()),
  ('3f6b1e4e-0001-4e4e-8c4e-000000000051', 'opener', 'Question', 'What does your team do after a quarter of back-to-back deadlines?', '["Good on social media"]', 'TEAMTASTIC_OUTREACH_VOICE.md', 'Opener library', 2, true, 'michael@teamtastic.events', now()),
  ('3f6b1e4e-0001-4e4e-8c4e-000000000052', 'opener', 'Status quo', 'Most virtual team events are a slideshow your team endures.', '["Good as a hook"]', 'TEAMTASTIC_OUTREACH_VOICE.md', 'Opener library', 3, true, 'michael@teamtastic.events', now()),
  ('3f6b1e4e-0001-4e4e-8c4e-000000000060', 'phrase', 'Game show', 'Every session turns the screen into a live game show.', '["Use after the opener"]', 'TEAMTASTIC_OUTREACH_VOICE.md', 'Phrase library', 1, true, 'michael@teamtastic.events', now()),
  ('3f6b1e4e-0001-4e4e-8c4e-000000000061', 'phrase', 'Everyone involved', 'Built to get everyone talking, laughing, and competing.', '["Use after the opener"]', 'TEAMTASTIC_OUTREACH_VOICE.md', 'Phrase library', 2, true, 'michael@teamtastic.events', now()),
  ('3f6b1e4e-0001-4e4e-8c4e-000000000062', 'phrase', 'No slideshows', 'No slides, no silence, no one hiding in a corner.', '["Use in the caption"]', 'TEAMTASTIC_OUTREACH_VOICE.md', 'Phrase library', 3, true, 'michael@teamtastic.events', now());
