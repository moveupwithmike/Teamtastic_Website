-- Protected, owner-confirmed controls for campaigns that have already been
-- built and reviewed in Google Ads or Meta Ads. This migration alone cannot
-- spend money: every campaign and both platform switches default to off.

create table public.advertising_campaign_controls (
  id uuid primary key default gen_random_uuid(),
  marketing_asset_draft_id uuid references public.marketing_asset_drafts(id) on delete set null,
  recommendation_id uuid references public.marketing_recommendations(id) on delete set null,
  platform text not null check (platform in ('google_ads', 'meta_ads')),
  name text not null,
  external_campaign_id text not null,
  external_budget_id text,
  status text not null default 'paused' check (status in ('ready', 'active', 'paused', 'error', 'archived')),
  daily_budget_cents integer not null check (daily_budget_cents between 100 and 100000),
  hard_daily_cap_cents integer not null check (hard_daily_cap_cents between daily_budget_cents and 100000),
  currency text not null default 'USD' check (currency = 'USD'),
  time_zone text not null default 'America/New_York' check (time_zone = 'America/New_York'),
  write_enabled boolean not null default false,
  auto_pause_at timestamptz,
  spend_date date,
  today_spend_cents integer not null default 0 check (today_spend_cents >= 0),
  last_command_at timestamptz,
  last_command_by text,
  provider_updated_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (platform, external_campaign_id)
);

create index advertising_campaign_controls_status_idx
  on public.advertising_campaign_controls(status, auto_pause_at);

alter table public.advertising_campaign_controls enable row level security;
revoke all on table public.advertising_campaign_controls from public, anon, authenticated;
grant select, insert, update, delete on table public.advertising_campaign_controls to service_role;

drop trigger if exists advertising_campaign_controls_touch_updated_at on public.advertising_campaign_controls;
create trigger advertising_campaign_controls_touch_updated_at before update on public.advertising_campaign_controls
for each row execute function automation.touch_updated_at();

create table public.advertising_control_requests (
  id uuid primary key default gen_random_uuid(),
  campaign_control_id uuid not null references public.advertising_campaign_controls(id) on delete restrict,
  receipt_id uuid not null unique references public.eddie_action_receipts(id) on delete restrict,
  requested_status text not null check (requested_status in ('active', 'paused')),
  requested_by text not null,
  daily_budget_cents integer not null check (daily_budget_cents between 100 and 100000),
  hard_daily_cap_cents integer not null check (hard_daily_cap_cents between daily_budget_cents and 100000),
  auto_pause_at timestamptz,
  status text not null default 'processing' check (status in ('processing', 'completed', 'failed')),
  provider_result jsonb,
  error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index advertising_control_requests_campaign_idx
  on public.advertising_control_requests(campaign_control_id, created_at desc);

alter table public.advertising_control_requests enable row level security;
revoke all on table public.advertising_control_requests from public, anon, authenticated;
grant select, insert, update on table public.advertising_control_requests to service_role;

alter table public.system_config
  add column if not exists advertising_master_enabled boolean not null default false,
  add column if not exists advertising_safety_monitor_enabled boolean not null default false,
  add column if not exists google_ads_write_enabled boolean not null default false,
  add column if not exists meta_ads_write_enabled boolean not null default false,
  add column if not exists google_ads_daily_cap_cents integer not null default 1500 check (google_ads_daily_cap_cents between 100 and 100000),
  add column if not exists meta_ads_daily_cap_cents integer not null default 1000 check (meta_ads_daily_cap_cents between 100 and 100000);

alter table public.eddie_action_receipts drop constraint if exists eddie_action_receipts_action_type_check;
alter table public.eddie_action_receipts add constraint eddie_action_receipts_action_type_check check (action_type in (
  'create_task',
  'update_prospect_status',
  'create_response_draft',
  'send_response_draft',
  'create_marketing_experiment',
  'turn_research_into_task',
  'prepare_ad_campaign',
  'prepare_landing_page_content',
  'prepare_customer_proposal',
  'schedule_follow_up',
  'decide_recommendation',
  'set_ad_campaign_status'
));

-- The automatic stop worker is deliberately installed inactive. It should be
-- activated only after the provider write credentials, function URL, and
-- webhook secret have been installed and a real paused campaign is mapped.
create or replace function automation.trigger_advertising_safety_monitor()
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
  from vault.decrypted_secrets where name = 'advertising_safety_function_url' limit 1;
  select decrypted_secret into webhook_secret
  from vault.decrypted_secrets where name = 'advertising_safety_webhook_secret' limit 1;
  if function_url is not null and webhook_secret is not null then
    perform net.http_post(
      url := function_url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', webhook_secret),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    );
  end if;
end;
$$;

revoke all on function automation.trigger_advertising_safety_monitor() from public, anon, authenticated;

do $$
declare
  safety_job_id bigint;
begin
  if exists (select 1 from cron.job where jobname = 'advertising-safety-monitor') then
    perform cron.unschedule('advertising-safety-monitor');
  end if;
  perform cron.schedule(
    'advertising-safety-monitor',
    '*/5 * * * *',
    'select automation.trigger_advertising_safety_monitor();'
  );
  select jobid into safety_job_id from cron.job where jobname = 'advertising-safety-monitor';
  perform cron.alter_job(job_id := safety_job_id, active := false);
end $$;
