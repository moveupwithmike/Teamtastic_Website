-- Protected, owner-confirmed lead discovery. Apollo searches are research-only:
-- no email/phone enrichment, no CRM promotion, no outreach, and no sending.

alter table public.system_config
  add column if not exists eddie_apollo_search_enabled boolean not null default true,
  add column if not exists eddie_apollo_search_max_contacts integer not null default 25
    check (eddie_apollo_search_max_contacts between 1 and 25),
  add column if not exists eddie_apollo_search_daily_run_cap integer not null default 3
    check (eddie_apollo_search_daily_run_cap between 0 and 10);

comment on column public.system_config.eddie_apollo_search_enabled is
  'Allows individually confirmed, discovery-only Apollo searches. Does not enable scheduled discovery, enrichment, prospecting, or sending.';

create table public.protected_lead_searches (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('apollo','apify')),
  audience_name text not null check (length(trim(audience_name)) between 3 and 200),
  business_purpose text not null check (length(trim(business_purpose)) between 20 and 1000),
  titles text[] not null default '{}'::text[] check (cardinality(titles) between 1 and 12),
  industry_keywords text[] not null default '{}'::text[] check (cardinality(industry_keywords) between 1 and 8),
  seniorities text[] not null default '{}'::text[] check (cardinality(seniorities) between 1 and 8),
  locations text[] not null default '{}'::text[] check (cardinality(locations) between 1 and 8),
  employee_min integer not null check (employee_min between 1 and 1000000),
  employee_max integer not null check (employee_max between 1 and 1000000 and employee_max >= employee_min),
  max_contacts integer not null check (max_contacts between 1 and 25),
  estimated_credits integer not null default 0 check (estimated_credits >= 0),
  hard_credit_cap integer not null default 0 check (hard_credit_cap >= 0),
  search_parameters jsonb not null default '{}'::jsonb,
  status text not null default 'approved' check (status in ('approved','queued','running','completed','failed','cancelled')),
  prepare_receipt_id uuid not null unique references public.eddie_action_receipts(id) on delete restrict,
  run_receipt_id uuid unique references public.eddie_action_receipts(id) on delete restrict,
  approved_by text not null,
  approved_at timestamptz not null default now(),
  queued_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  returned_count integer not null default 0 check (returned_count >= 0),
  created_count integer not null default 0 check (created_count >= 0),
  duplicate_count integer not null default 0 check (duplicate_count >= 0),
  actual_credits integer not null default 0 check (actual_credits >= 0 and actual_credits <= hard_credit_cap),
  provider_run_id text,
  result jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (provider <> 'apollo' or (estimated_credits = 0 and hard_credit_cap = 0))
);

create index protected_lead_searches_review_idx
  on public.protected_lead_searches(status, created_at desc);

create trigger protected_lead_searches_touch_updated_at
before update on public.protected_lead_searches
for each row execute function automation.touch_updated_at();

alter table public.protected_lead_searches enable row level security;
revoke all on table public.protected_lead_searches from public,anon,authenticated;
grant select,insert,update on table public.protected_lead_searches to service_role;

-- Apify is deny-by-default. This table must contain an enabled, named approval
-- before any future Apify runner can accept a source. No generic web crawler or
-- consumer-person source is seeded by this migration.
create table public.apify_approved_sources (
  id uuid primary key default gen_random_uuid(),
  source_name text not null unique,
  actor_id text not null unique,
  public_source_domain text not null,
  business_purpose text not null check (length(trim(business_purpose)) between 20 and 1000),
  allowed_input_keys text[] not null check (cardinality(allowed_input_keys) between 1 and 30),
  allowed_output_fields text[] not null check (cardinality(allowed_output_fields) between 1 and 40),
  maximum_items integer not null check (maximum_items between 1 and 1000),
  maximum_cost_cents integer not null check (maximum_cost_cents between 0 and 10000),
  business_records_only boolean not null default true check (business_records_only),
  consumer_person_data_allowed boolean not null default false check (not consumer_person_data_allowed),
  enabled boolean not null default false,
  approved_by text,
  approved_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not enabled or (approved_by is not null and approved_at is not null))
);

create trigger apify_approved_sources_touch_updated_at
before update on public.apify_approved_sources
for each row execute function automation.touch_updated_at();

alter table public.apify_approved_sources enable row level security;
revoke all on table public.apify_approved_sources from public,anon,authenticated;
grant select,insert,update on table public.apify_approved_sources to service_role;

alter table public.eddie_action_receipts
  drop constraint if exists eddie_action_receipts_action_type_check;
alter table public.eddie_action_receipts
  add constraint eddie_action_receipts_action_type_check check (action_type in (
    'create_task','update_prospect_status','create_response_draft','send_response_draft',
    'create_marketing_experiment','turn_research_into_task','prepare_ad_campaign',
    'prepare_landing_page_content','prepare_customer_proposal','schedule_follow_up',
    'decide_recommendation','set_ad_campaign_status','prepare_social_plan',
    'create_social_post','revise_social_post','create_social_video','approve_social_item',
    'schedule_social_item','publish_social_item','pause_scheduled_social_item',
    'prepare_comment_reply','prepare_apollo_search','run_approved_apollo_search'
  ));

create or replace function automation.queue_approved_apollo_search(
  p_search_id uuid,
  p_receipt_id uuid,
  p_actor text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_search public.protected_lead_searches%rowtype;
  v_config public.system_config%rowtype;
  v_function_url text;
  v_webhook_secret text;
  v_runs_today integer;
  v_request_id bigint;
begin
  select * into v_config from public.system_config where id=true;
  if not coalesce(v_config.master_enabled,false) or not coalesce(v_config.eddie_apollo_search_enabled,false) then
    raise exception 'Protected Apollo search is disabled';
  end if;

  select * into v_search from public.protected_lead_searches where id=p_search_id for update;
  if v_search.id is null or v_search.provider <> 'apollo' or v_search.status <> 'approved' then
    raise exception 'Approved Apollo search not found';
  end if;
  if v_search.max_contacts > v_config.eddie_apollo_search_max_contacts
     or v_search.estimated_credits <> 0 or v_search.hard_credit_cap <> 0 then
    raise exception 'Apollo search exceeds protected limits';
  end if;
  if not exists(
    select 1 from public.eddie_action_receipts receipt
    where receipt.id=p_receipt_id and receipt.actor_email=lower(trim(p_actor))
      and receipt.action_type='run_approved_apollo_search' and receipt.status='started'
  ) then
    raise exception 'Valid Eddie confirmation receipt required';
  end if;

  select count(*)::integer into v_runs_today
  from public.protected_lead_searches
  where provider='apollo'
    and queued_at >= (date_trunc('day', now() at time zone 'America/New_York') at time zone 'America/New_York')
    and status in ('queued','running','completed');
  if v_runs_today >= v_config.eddie_apollo_search_daily_run_cap then
    raise exception 'Protected Apollo daily run cap reached';
  end if;

  select decrypted_secret into v_function_url
  from vault.decrypted_secrets where name='phase3_apollo_discovery_function_url' limit 1;
  select decrypted_secret into v_webhook_secret
  from vault.decrypted_secrets where name='phase3_apollo_discovery_webhook_secret' limit 1;
  if v_function_url is null or v_webhook_secret is null then
    raise exception 'Apollo discovery worker is not configured';
  end if;

  update public.protected_lead_searches
  set status='queued',run_receipt_id=p_receipt_id,queued_at=now(),error=null
  where id=p_search_id;

  select net.http_post(
    url := v_function_url,
    headers := jsonb_build_object('Content-Type','application/json','x-webhook-secret',v_webhook_secret),
    body := jsonb_build_object('search_request_id',p_search_id,'receipt_id',p_receipt_id),
    timeout_milliseconds := 30000
  ) into v_request_id;

  return jsonb_build_object('queued',true,'search_id',p_search_id,'request_id',v_request_id,
    'max_contacts',v_search.max_contacts,'hard_credit_cap',v_search.hard_credit_cap);
end;
$$;

revoke all on function automation.queue_approved_apollo_search(uuid,uuid,text) from public,anon,authenticated;
grant execute on function automation.queue_approved_apollo_search(uuid,uuid,text) to service_role;
