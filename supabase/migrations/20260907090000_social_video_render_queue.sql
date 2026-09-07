-- Social video rendering queue --------------------------------------------
-- A render job turns a video post's script + shot list into usable media.
-- The actual renderer is a pluggable engine (see RENDERER in video-render.js);
-- this migration only provides the queue, RLS, and the history events that a
-- completed render records on the post.

create table if not exists public.social_video_renders (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.distribution_items(id) on delete cascade,
  script text not null,
  shot_list jsonb not null default '[]'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'rendering', 'done', 'failed', 'canceled')),
  renderer text not null default 'none',
  media jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);
-- One job in flight per post at a time; retries resubmit only after the
-- previous job is canceled or finished.
create unique index if not exists social_video_renders_active_item_idx
  on public.social_video_renders(item_id) where status in ('pending', 'rendering');
create index if not exists social_video_renders_status_idx
  on public.social_video_renders(status, created_at desc);

alter table public.social_video_renders enable row level security;
revoke all on table public.social_video_renders from public, anon, authenticated;
grant select, insert, update, delete on table public.social_video_renders to service_role;

drop trigger if exists social_video_renders_touch_updated_at on public.social_video_renders;
create trigger social_video_renders_touch_updated_at before update on public.social_video_renders
for each row execute function automation.touch_updated_at();

-- History events for renders.
alter table public.distribution_item_events
  drop constraint if exists distribution_item_events_action_check,
  add constraint distribution_item_events_action_check check (action in (
    'created', 'revised', 'approved', 'rejected', 'scheduled', 'rescheduled',
    'published', 'publish_failed', 'paused', 'resumed', 'archived', 'plan_promoted',
    'rendered', 'render_failed'
  ));