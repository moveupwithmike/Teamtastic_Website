-- Phase 3: signal research, contact enrichment, deterministic scoring, and
-- approval-only outreach drafts. This migration does not enable prospecting or
-- create any path that can send email.

alter table public.system_config
  add column if not exists phase3_research_enabled boolean not null default false,
  add column if not exists phase3_enrichment_enabled boolean not null default false,
  add column if not exists phase3_scoring_enabled boolean not null default false,
  add column if not exists phase3_drafting_enabled boolean not null default false,
  add column if not exists phase3_minimum_score numeric(7,3) not null default 65
    check (phase3_minimum_score between 0 and 100),
  add column if not exists phase3_max_drafts_per_run integer not null default 10
    check (phase3_max_drafts_per_run between 0 and 100);

create table public.source_runs (
  id uuid primary key default gen_random_uuid(),
  run_type text not null check (run_type in ('signal_research', 'apollo_enrichment', 'prospect_scoring', 'outreach_drafting')),
  provider text not null,
  status text not null default 'started' check (status in ('started', 'completed', 'partial', 'failed', 'skipped')),
  records_scanned integer not null default 0 check (records_scanned >= 0),
  records_created integer not null default 0 check (records_created >= 0),
  records_updated integer not null default 0 check (records_updated >= 0),
  cursor jsonb not null default '{}'::jsonb,
  decision jsonb not null default '{}'::jsonb,
  error text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index source_runs_recent_idx on public.source_runs(run_type, created_at desc);
create index source_runs_open_idx on public.source_runs(started_at)
  where status = 'started';

create table public.enrichment_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  prospect_id uuid references public.prospects(id) on delete cascade,
  provider text not null default 'apollo' check (provider in ('apollo', 'manual')),
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'no_match', 'failed', 'cancelled')),
  request_kind text not null default 'company_contacts' check (request_kind in ('company_contacts', 'person_enrichment', 'email_verification')),
  provider_request_id text,
  attempts integer not null default 0 check (attempts between 0 and 10),
  next_attempt_at timestamptz,
  request_payload jsonb not null default '{}'::jsonb,
  response_summary jsonb not null default '{}'::jsonb,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (company_id is not null or prospect_id is not null)
);

create unique index enrichment_requests_company_active_key
  on public.enrichment_requests(company_id, provider, request_kind)
  where company_id is not null and status in ('pending', 'processing');
create unique index enrichment_requests_prospect_active_key
  on public.enrichment_requests(prospect_id, provider, request_kind)
  where prospect_id is not null and status in ('pending', 'processing');
create index enrichment_requests_due_idx
  on public.enrichment_requests(next_attempt_at nulls first, created_at)
  where status in ('pending', 'failed');

create table public.prospect_score_history (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  score numeric(7,3) not null check (score between 0 and 100),
  company_fit numeric(7,3) not null check (company_fit between 0 and 35),
  role_fit numeric(7,3) not null check (role_fit between 0 and 25),
  signal_fit numeric(7,3) not null check (signal_fit between 0 and 30),
  intent_fit numeric(7,3) not null check (intent_fit between 0 and 10),
  reasons jsonb not null default '[]'::jsonb,
  scoring_version text not null default 'phase3-v1',
  created_at timestamptz not null default now()
);

create index prospect_score_history_timeline_idx
  on public.prospect_score_history(prospect_id, created_at desc);
create index prospect_score_history_rank_idx
  on public.prospect_score_history(score desc, created_at desc);

create table public.outreach_drafts (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  signal_id uuid references public.signals(id) on delete set null,
  source_run_id uuid references public.source_runs(id) on delete set null,
  subject text not null,
  body_text text not null,
  personalization_evidence jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'review', 'approved', 'rejected', 'retired')),
  model text,
  prompt_version text not null default 'phase3-v1',
  approval_notes text,
  approved_at timestamptz,
  approved_by text,
  fingerprint text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status <> 'approved') or (approved_at is not null and approved_by is not null))
);

create index outreach_drafts_review_idx
  on public.outreach_drafts(created_at)
  where status in ('draft', 'review');
create index outreach_drafts_prospect_idx
  on public.outreach_drafts(prospect_id, created_at desc);

create or replace function automation.score_prospect(p_prospect_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  prospect_record public.prospects%rowtype;
  company_record public.companies%rowtype;
  company_points numeric(7,3) := 0;
  role_points numeric(7,3) := 0;
  signal_points numeric(7,3) := 0;
  intent_points numeric(7,3) := 0;
  total_points numeric(7,3);
  strongest_signal numeric(4,3) := 0;
  intent_text text;
  reasons jsonb := '[]'::jsonb;
begin
  select * into prospect_record from public.prospects where id = p_prospect_id;
  if prospect_record.id is null then
    return jsonb_build_object('scored', false, 'reason', 'prospect_not_found');
  end if;

  if prospect_record.email_normalized is null then
    return jsonb_build_object('scored', false, 'reason', 'missing_email');
  end if;
  if prospect_record.status in ('suppressed', 'not_interested', 'converted', 'disqualified')
     or exists (select 1 from public.suppression_list s where s.email_normalized = prospect_record.email_normalized) then
    return jsonb_build_object('scored', false, 'reason', 'ineligible_status_or_suppression');
  end if;

  if prospect_record.company_id is not null then
    select * into company_record from public.companies where id = prospect_record.company_id;
  end if;

  if company_record.id is not null then
    if company_record.employee_count between 25 and 2000 then company_points := company_points + 20; end if;
    if company_record.domain is not null then company_points := company_points + 5; end if;
    if company_record.industry is not null then company_points := company_points + 5; end if;
    if company_record.lifecycle_stage in ('prospect', 'qualified', 'opportunity') then company_points := company_points + 5; end if;
  end if;

  if coalesce(prospect_record.job_title, '') ~* '(chief people|people operations|human resources|employee experience|culture|events?|office manager|workplace|executive assistant|chief of staff)' then
    role_points := 25;
  elsif coalesce(prospect_record.job_title, '') ~* '(director|head|vice president|vp|manager|founder|owner|president|coordinator)' then
    role_points := 15;
  elsif prospect_record.job_title is not null then
    role_points := 5;
  end if;

  if company_record.id is not null then
    select coalesce(max(s.strength), 0) into strongest_signal
    from public.signals s
    where s.company_id = company_record.id
      and (s.expires_at is null or s.expires_at > now());
  end if;
  signal_points := round((strongest_signal * 30)::numeric, 3);

  intent_text := prospect_record.metadata ->> 'posthog_intent_score';
  if intent_text ~ '^[0-9]+([.][0-9]+)?$' then
    intent_points := least(10, greatest(0, intent_text::numeric));
  end if;

  total_points := least(100, company_points + role_points + signal_points + intent_points);
  reasons := jsonb_build_array(
    jsonb_build_object('component', 'company_fit', 'points', company_points),
    jsonb_build_object('component', 'role_fit', 'points', role_points),
    jsonb_build_object('component', 'signal_fit', 'points', signal_points, 'strongest_signal', strongest_signal),
    jsonb_build_object('component', 'intent_fit', 'points', intent_points)
  );

  update public.prospects
  set score = total_points,
      score_reasons = reasons,
      status = case when total_points >= 65 and status in ('new', 'researching') then 'qualified' else status end
  where id = prospect_record.id;

  insert into public.prospect_score_history(
    prospect_id, score, company_fit, role_fit, signal_fit, intent_fit, reasons
  ) values (
    prospect_record.id, total_points, company_points, role_points, signal_points, intent_points, reasons
  );

  return jsonb_build_object('scored', true, 'score', total_points, 'reasons', reasons);
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['enrichment_requests', 'outreach_drafts']
  loop
    execute format('drop trigger if exists %I_touch_updated_at on public.%I', table_name, table_name);
    execute format(
      'create trigger %I_touch_updated_at before update on public.%I for each row execute function automation.touch_updated_at()',
      table_name, table_name
    );
  end loop;
end $$;

alter table public.source_runs enable row level security;
alter table public.enrichment_requests enable row level security;
alter table public.prospect_score_history enable row level security;
alter table public.outreach_drafts enable row level security;

revoke all on table public.source_runs, public.enrichment_requests,
  public.prospect_score_history, public.outreach_drafts from anon, authenticated;
grant select, insert, update, delete on table public.source_runs, public.enrichment_requests,
  public.prospect_score_history, public.outreach_drafts to service_role;

revoke all on function automation.score_prospect(uuid) from public, anon, authenticated;
grant execute on function automation.score_prospect(uuid) to service_role;

create or replace function automation.trigger_phase3_draft_pipeline()
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
  from vault.decrypted_secrets where name = 'phase3_pipeline_function_url' limit 1;
  select decrypted_secret into webhook_secret
  from vault.decrypted_secrets where name = 'phase3_pipeline_webhook_secret' limit 1;
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

revoke all on function automation.trigger_phase3_draft_pipeline() from public, anon, authenticated;

do $$
declare
  phase3_job_id bigint;
begin
  perform cron.schedule(
    'phase3-score-and-draft',
    '0 13 * * 1-5',
    'select automation.trigger_phase3_draft_pipeline();'
  );
  select jobid into phase3_job_id from cron.job where jobname = 'phase3-score-and-draft';
  perform cron.alter_job(job_id := phase3_job_id, active := false);
end $$;
