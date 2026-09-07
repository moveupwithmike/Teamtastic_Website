-- The Social Desk extends the existing Campaign Distribution system instead of
-- replacing it. Every platform/item flows through the same distribution_items
-- lifecycle; this migration widens the model, adds the account registry, an
-- immutable per-item event history, and a publishing log that makes failed
-- attempts visible, retryable, and duplicate-free.
--
-- Nothing here enables publishing on its own: the master switch and every
-- platform switch default to off, and every new account defaults to
-- write_enabled = false.

--------------------------------------------------------------------------------
-- 1. Social account registry ------------------------------------------------
--------------------------------------------------------------------------------

create table public.social_accounts (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('linkedin', 'instagram', 'facebook', 'x', 'reddit')),
  account_name text not null,
  account_type text not null default 'company_page'
    check (account_type in ('company_page', 'professional_profile', 'personal_profile', 'community', 'group')),
  destination text,
  provider_id text,
  credentials jsonb not null default '{}'::jsonb,
  requires_manual_post boolean not null default false,
  write_enabled boolean not null default false,
  status text not null default 'disconnected'
    check (status in ('disconnected', 'connected', 'error', 'revoked')),
  authorized_by text,
  last_error text,
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index social_accounts_platform_idx on public.social_accounts(platform, write_enabled);
create index social_accounts_status_idx on public.social_accounts(status, platform);

alter table public.social_accounts enable row level security;
revoke all on table public.social_accounts from public, anon, authenticated;
grant select, insert, update, delete on table public.social_accounts to service_role;

drop trigger if exists social_accounts_touch_updated_at on public.social_accounts;
create trigger social_accounts_touch_updated_at before update on public.social_accounts
for each row execute function automation.touch_updated_at();

--------------------------------------------------------------------------------
-- 2. Widen distribution_items into the Social Desk --------------------------
--------------------------------------------------------------------------------

alter table public.distribution_items drop constraint if exists distribution_items_channel_check;
alter table public.distribution_items add constraint distribution_items_channel_check
  check (channel in ('linkedin', 'instagram', 'facebook', 'x', 'reddit', 'newsletter', 'partner', 'community'));

alter table public.distribution_items drop constraint if exists distribution_items_status_check;
alter table public.distribution_items add constraint distribution_items_status_check
  check (status in ('draft', 'approved', 'scheduled', 'published', 'rejected', 'archived', 'proposed', 'publish_failed', 'paused'));

alter table public.distribution_items
  add column if not exists format text not null default 'text'
    check (format in ('text', 'image', 'multi_image', 'document', 'video', 'reel', 'comment')),
  add column if not exists content_objective text
    check (content_objective in ('awareness', 'consideration', 'conversion', 'engagement', 'follow_up')),
  add column if not exists funnel_stage text,
  add column if not exists hook text,
  add column if not exists cta text,
  add column if not exists caption text,
  add column if not exists media jsonb not null default '[]'::jsonb,
  add column if not exists destination text,
  add column if not exists platform_account_id uuid references public.social_accounts(id) on delete set null,
  add column if not exists provider_post_id text,
  add column if not exists publish_mode text not null default 'now'
    check (publish_mode in ('now', 'scheduled')),
  add column if not exists requires_manual_post boolean not null default false,
  add column if not exists published_by text,
  add column if not exists approved_by text,
  add column if not exists approved_fingerprint text,
  add column if not exists scheduled_fingerprint text,
  add column if not exists approved_at timestamptz,
  add column if not exists revision integer not null default 0,
  add column if not exists source_evidence jsonb not null default '{}'::jsonb,
  add column if not exists voice_sources jsonb not null default '[]'::jsonb,
  add column if not exists last_error text;

-- New columns used only for social items are nullable; the legacy queue still
-- inserts body_text, so keep a safe default for any future code path.
alter table public.distribution_items alter column body_text set default '';

create index distribution_items_account_idx on public.distribution_items(platform_account_id, status);
create index distribution_items_provider_idx on public.distribution_items(provider_post_id);

--------------------------------------------------------------------------------
-- 3. Immutable per-item event history ----------------------------------------
--------------------------------------------------------------------------------

create table public.distribution_item_events (
  id uuid primary key default gen_random_uuid(),
  distribution_item_id uuid not null references public.distribution_items(id) on delete cascade,
  action text not null check (action in (
    'created', 'revised', 'approved', 'rejected', 'scheduled', 'rescheduled',
    'published', 'publish_failed', 'paused', 'resumed', 'archived', 'plan_promoted'
  )),
  status_before text,
  status_after text,
  actor text,
  decision jsonb not null default '{}'::jsonb,
  fingerprint text,
  receipt_id text,
  error text,
  created_at timestamptz not null default now()
);

create index distribution_item_events_item_idx on public.distribution_item_events(distribution_item_id, created_at desc);

alter table public.distribution_item_events enable row level security;
revoke all on table public.distribution_item_events from public, anon, authenticated;
grant select, insert, update on table public.distribution_item_events to service_role;

--------------------------------------------------------------------------------
-- 4. Publishing log (one 'started' run per item at a time) -------------------
--------------------------------------------------------------------------------

create table public.distribution_publishing_log (
  id uuid primary key default gen_random_uuid(),
  distribution_item_id uuid not null references public.distribution_items(id) on delete cascade,
  status text not null check (status in ('started', 'completed', 'failed')),
  trigger text not null default 'office' check (trigger in ('office', 'eddie')),
  provider_post_id text,
  provider_url text,
  attempt integer not null default 1,
  error text,
  result jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

-- Only one in-flight publish attempt per item, so a double-click or a retry
-- racing another request can never start a second provider call.
create unique index distribution_publishing_log_started_uniq
  on public.distribution_publishing_log(distribution_item_id) where status = 'started';
create index distribution_publishing_log_item_idx
  on public.distribution_publishing_log(distribution_item_id, created_at desc);

alter table public.distribution_publishing_log enable row level security;
revoke all on table public.distribution_publishing_log from public, anon, authenticated;
grant select, insert, update on table public.distribution_publishing_log to service_role;

--------------------------------------------------------------------------------
-- 5. Master + per-platform switches (all default off) ------------------------
--------------------------------------------------------------------------------

alter table public.system_config
  add column if not exists social_master_enabled boolean not null default false,
  add column if not exists linkedin_write_enabled boolean not null default false,
  add column if not exists instagram_write_enabled boolean not null default false,
  add column if not exists facebook_write_enabled boolean not null default false,
  add column if not exists x_write_enabled boolean not null default false;

--------------------------------------------------------------------------------
-- 6. Private media bucket -----------------------------------------------------
--------------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('distribution-media', 'distribution-media', false)
on conflict (id) do nothing;

--------------------------------------------------------------------------------
-- 7. Approved voice library (seeded from TEAMTASTIC_OUTREACH_VOICE.md) -------
--------------------------------------------------------------------------------

create table public.social_voice_entries (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in (
    'signature', 'opener', 'phrase', 'rule', 'avoid', 'fact', 'needs_evidence'
  )),
  body text not null,
  source text not null,
  source_ref text,
  tags jsonb not null default '[]'::jsonb,
  enabled boolean not null default true,
  approved_by text,
  approved_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create index social_voice_entries_kind_idx on public.social_voice_entries(enabled, kind);

alter table public.social_voice_entries enable row level security;
revoke all on table public.social_voice_entries from public, anon, authenticated;
grant select, insert, update, delete on table public.social_voice_entries to service_role;

insert into public.social_voice_entries (id, kind, body, source, source_ref, approved_by, approved_at, enabled)
values
  -- Signature language the brand uses naturally, never forced.
  ('3f6b1e4e-0001-4e4e-8c4e-000000000001', 'signature', 'Play. Connect. Celebrate.', 'TEAMTASTIC_OUTREACH_VOICE.md', 'Signature language', 'michael@teamtastic.events', now(), true),
  ('3f6b1e4e-0001-4e4e-8c4e-000000000002', 'signature', 'More than another virtual trivia event.', 'TEAMTASTIC_OUTREACH_VOICE.md', 'Signature language', 'michael@teamtastic.events', now(), true),
  ('3f6b1e4e-0001-4e4e-8c4e-000000000003', 'signature', 'Turn the screen into a game show.', 'TEAMTASTIC_OUTREACH_VOICE.md', 'Signature language', 'michael@teamtastic.events', now(), true),
  ('3f6b1e4e-0001-4e4e-8c4e-000000000004', 'signature', 'Hosted by a Master Emcee.', 'TEAMTASTIC_OUTREACH_VOICE.md', 'Signature language', 'michael@teamtastic.events', now(), true),
  ('3f6b1e4e-0001-4e4e-8c4e-000000000005', 'signature', 'Built to get everyone involved.', 'TEAMTASTIC_OUTREACH_VOICE.md', 'Signature language', 'michael@teamtastic.events', now(), true),
  ('3f6b1e4e-0001-4e4e-8c4e-000000000006', 'signature', 'Your team brings the people. We bring the experience.', 'TEAMTASTIC_OUTREACH_VOICE.md', 'Signature language', 'michael@teamtastic.events', now(), true),
  -- Approved factual claims Eddie and the voice use freely.
  ('3f6b1e4e-0001-4e4e-8c4e-000000000010', 'fact', 'Events are hosted live by a Master Emcee.', 'TEAMTASTIC_OUTREACH_VOICE.md', 'Website messaging', 'michael@teamtastic.events', now(), true),
  ('3f6b1e4e-0001-4e4e-8c4e-000000000011', 'fact', 'Teamtastic handles the hosting and production from start to finish.', 'TEAMTASTIC_OUTREACH_VOICE.md', 'The two promises', 'michael@teamtastic.events', now(), true),
  ('3f6b1e4e-0001-4e4e-8c4e-000000000012', 'fact', 'Games and company moments are custom to each team.', 'TEAMTASTIC_OUTREACH_VOICE.md', 'The two promises', 'michael@teamtastic.events', now(), true),
  -- Claims that need specific evidence before they may be used.
  ('3f6b1e4e-0001-4e4e-8c4e-000000000020', 'needs_evidence', 'Teams leave talking about the experience.', 'TEAMTASTIC_OUTREACH_VOICE.md', 'Emotional promise', 'michael@teamtastic.events', now(), true),
  ('3f6b1e4e-0001-4e4e-8c4e-000000000021', 'needs_evidence', 'Any statistic, percentage, or improvement about results.', 'TEAMTASTIC_OUTREACH_VOICE.md', 'Safety and approval', 'michael@teamtastic.events', now(), true),
  -- Phrases and tactics to avoid.
  ('3f6b1e4e-0001-4e4e-8c4e-000000000030', 'avoid', 'Empty openers ("I hope this finds you well").', 'TEAMTASTIC_OUTREACH_VOICE.md', 'Writing rules', 'michael@teamtastic.events', now(), true),
  ('3f6b1e4e-0001-4e4e-8c4e-000000000031', 'avoid', 'Buzzwords: synergy, innovative solution, engagement platform, culture transformation.', 'TEAMTASTIC_OUTREACH_VOICE.md', 'Avoid list', 'michael@teamtastic.events', now(), true),
  ('3f6b1e4e-0001-4e4e-8c4e-000000000032', 'avoid', 'Fake urgency, forced jokes, excessive exclamation points, all-caps headlines.', 'TEAMTASTIC_OUTREACH_VOICE.md', 'Avoid list', 'michael@teamtastic.events', now(), true),
  -- Hard rules Eddie and the generators must never break.
  ('3f6b1e4e-0001-4e4e-8c4e-000000000040', 'rule', 'Never invent a customer name, testimonial, statistic, or result.', 'TEAMTASTIC_OUTREACH_VOICE.md', 'Safety and approval', 'michael@teamtastic.events', now(), true),
  ('3f6b1e4e-0001-4e4e-8c4e-000000000041', 'rule', 'Post a platform-specific version of the copy; never identical filler across every platform.', 'TEAMTASTIC_OUTREACH_VOICE.md', 'Writing rules', 'michael@teamtastic.events', now(), true),
  ('3f6b1e4e-0001-4e4e-8c4e-000000000042', 'rule', 'New or materially changed copy starts in review. Approved voice does not grant permission to publish.', 'TEAMTASTIC_OUTREACH_VOICE.md', 'Safety and approval', 'michael@teamtastic.events', now(), true);