alter table public.system_config
  add column if not exists organic_reddit_commercial_approval_confirmed boolean not null default false;

update public.organic_sources set enabled = false, updated_at = now()
where source_key = 'reddit-approved-api';
