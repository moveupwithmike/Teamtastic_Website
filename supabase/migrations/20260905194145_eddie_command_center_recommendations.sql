-- Structured, owner-reviewed marketing recommendations and draft assets for Eddie.
-- This migration creates no advertising integration and grants no ability to spend money.

create table public.marketing_recommendations (
  id uuid primary key default gen_random_uuid(),
  recommendation_type text not null check (recommendation_type in ('advertising','seo','landing_page','competitor','customer_trend')),
  title text not null,
  target_customer text not null,
  occasion text,
  platform text not null,
  suggested_daily_budget_cents integer not null default 0 check (suggested_daily_budget_cents between 0 and 100000),
  test_days integer not null default 0 check (test_days between 0 and 90),
  proposed_keywords text[] not null default '{}',
  proposed_audience text,
  advertisement_text text,
  creative_brief text,
  landing_page text,
  expected_result text not null,
  reason text not null,
  evidence jsonb not null default '{}'::jsonb,
  source_type text not null default 'owner_plan',
  source_id text,
  fingerprint text not null unique,
  status text not null default 'proposed' check (status in ('proposed','approved','rejected','prepared','archived')),
  decision_notes text,
  decided_at timestamptz,
  decided_by text,
  prepared_at timestamptz,
  prepared_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index marketing_recommendations_status_created_idx
  on public.marketing_recommendations(status, created_at desc);

alter table public.marketing_recommendations enable row level security;
revoke all on table public.marketing_recommendations from public, anon, authenticated;
grant select, insert, update, delete on table public.marketing_recommendations to service_role;

drop trigger if exists marketing_recommendations_touch_updated_at on public.marketing_recommendations;
create trigger marketing_recommendations_touch_updated_at before update on public.marketing_recommendations
for each row execute function automation.touch_updated_at();

create table public.marketing_asset_drafts (
  id uuid primary key default gen_random_uuid(),
  draft_type text not null check (draft_type in ('advertising_campaign','landing_page_content','customer_proposal')),
  recommendation_id uuid references public.marketing_recommendations(id) on delete set null,
  deal_id uuid references public.deals(id) on delete set null,
  title text not null,
  body_text text not null,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft','review','approved','archived')),
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index marketing_asset_drafts_status_created_idx
  on public.marketing_asset_drafts(status, created_at desc);

alter table public.marketing_asset_drafts enable row level security;
revoke all on table public.marketing_asset_drafts from public, anon, authenticated;
grant select, insert, update, delete on table public.marketing_asset_drafts to service_role;

drop trigger if exists marketing_asset_drafts_touch_updated_at on public.marketing_asset_drafts;
create trigger marketing_asset_drafts_touch_updated_at before update on public.marketing_asset_drafts
for each row execute function automation.touch_updated_at();

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
  'decide_recommendation'
));

-- Initial family-demand ideas are proposals only. Budgeted items cannot launch from this table.
insert into public.marketing_recommendations (
  recommendation_type, title, target_customer, occasion, platform,
  suggested_daily_budget_cents, test_days, proposed_keywords, proposed_audience,
  advertisement_text, creative_brief, landing_page, expected_result, reason,
  evidence, source_type, fingerprint
) values
  (
    'advertising', 'Test family-reunion search demand',
    'Adults organizing an online reunion for family members in different locations',
    'Family reunion', 'Google Ads — recommendation only', 1500, 14,
    array['virtual family reunion games','online family reunion game','virtual family reunion activity'],
    'People actively searching for a hosted online family-reunion activity',
    'Bring the whole family together for a live, hosted online game show. Check your date with Teamtastic.',
    'A warm multigenerational family on a video call, laughing during a hosted game-show moment.',
    '/virtual-family-reunion-game-show',
    'Establish the first reliable cost-per-family-lead baseline; no booking result is promised before test data exists.',
    'A dedicated family-reunion landing page is live, so a small capped search test can measure demand without changing the main corporate funnel.',
    jsonb_build_object('baseline','not_yet_established','maximum_test_cost_cents',21000,'external_search_trend_connected',false),
    'family_demand_launch', 'family-demand:google:reunion:v1'
  ),
  (
    'seo', 'Build organic birthday-party demand',
    'Parents and adult family members planning an online birthday celebration',
    'Birthday', 'SEO — recommendation only', 0, 0,
    array['virtual birthday game show','online birthday party games for family','hosted virtual birthday party'],
    'People researching an online birthday activity before choosing a provider',
    null,
    'Use occasion-specific photographs and examples that match both adult and multigenerational birthdays.',
    '/virtual-birthday-game-show',
    'Grow qualified organic visits and family concierge submissions over time; measure results before recommending paid promotion.',
    'The dedicated birthday page is live and can now accumulate search and conversion evidence.',
    jsonb_build_object('baseline','collecting','external_search_console_connected',false),
    'family_demand_launch', 'family-demand:seo:birthday:v1'
  ),
  (
    'advertising', 'Test long-distance family game-night search demand',
    'Families and friend groups looking for a recurring or one-time online game night',
    'Long-distance family game night', 'Google Ads — recommendation only', 1500, 14,
    array['long distance family game night','online games for families far apart','virtual family game night'],
    'People actively searching for ways to connect a family living in different places',
    'Make distance disappear for a night. Join a live, hosted Teamtastic family game show from anywhere.',
    'A split-screen family in several homes reacting together to a colorful live game-show question.',
    '/long-distance-family-game-night',
    'Establish a cost-per-lead baseline and identify which search terms produce real date checks; no booking result is promised yet.',
    'The dedicated landing page creates a measurable destination for a small, capped search test.',
    jsonb_build_object('baseline','not_yet_established','maximum_test_cost_cents',21000,'external_search_trend_connected',false),
    'family_demand_launch', 'family-demand:google:long-distance:v1'
  )
on conflict (fingerprint) do nothing;
