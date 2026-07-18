-- Teamtastic autonomous CRM foundation.
-- All CRM data is server-only. Browser roles receive no table or function access.

create schema if not exists automation;
revoke all on schema automation from public, anon, authenticated;

create table public.system_config (
  id boolean primary key default true check (id),
  master_enabled boolean not null default false,
  inbound_auto_reply_enabled boolean not null default false,
  nurture_enabled boolean not null default false,
  prospecting_enabled boolean not null default false,
  internal_notifications_enabled boolean not null default true,
  daily_inbound_cap integer not null default 25 check (daily_inbound_cap between 0 and 500),
  daily_nurture_cap integer not null default 10 check (daily_nurture_cap between 0 and 500),
  daily_prospecting_cap integer not null default 5 check (daily_prospecting_cap between 0 and 500),
  escalation_confidence_threshold numeric(4,3) not null default 0.800
    check (escalation_confidence_threshold between 0 and 1),
  high_value_opportunity_threshold numeric(12,2) not null default 5000
    check (high_value_opportunity_threshold >= 0),
  prospecting_domain text not null default 'tryteamtastic.com',
  prospecting_from_email text,
  updated_at timestamptz not null default now(),
  updated_by text
);

insert into public.system_config (id) values (true) on conflict (id) do nothing;

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  domain text,
  website_url text,
  industry text,
  employee_count integer check (employee_count is null or employee_count >= 0),
  headquarters text,
  linkedin_url text,
  lifecycle_stage text not null default 'prospect'
    check (lifecycle_stage in ('prospect', 'qualified', 'opportunity', 'client', 'former_client', 'disqualified')),
  source text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index companies_domain_key on public.companies (lower(domain)) where domain is not null;
create index companies_lifecycle_stage_idx on public.companies (lifecycle_stage, updated_at desc);

create table public.prospects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete set null,
  first_name text,
  last_name text,
  full_name text,
  email text,
  email_normalized text generated always as (lower(trim(email))) stored,
  phone text,
  job_title text,
  linkedin_url text,
  source text not null default 'inbound',
  status text not null default 'new'
    check (status in ('new', 'researching', 'qualified', 'nurturing', 'contacted', 'replied', 'interested', 'not_interested', 'converted', 'suppressed', 'disqualified')),
  score numeric(7,3),
  score_reasons jsonb not null default '[]'::jsonb,
  last_inbound_at timestamptz,
  last_outbound_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index prospects_email_key on public.prospects (email_normalized) where email_normalized is not null;
create index prospects_company_idx on public.prospects (company_id, status);
create index prospects_scoring_idx on public.prospects (status, score desc nulls last, updated_at desc);

alter table public.leads add column if not exists prospect_id uuid references public.prospects(id) on delete set null;
create index if not exists leads_prospect_id_idx on public.leads(prospect_id);

create table public.sequences (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  channel text not null default 'email' check (channel = 'email'),
  status text not null default 'draft' check (status in ('draft', 'approval', 'active', 'paused', 'retired')),
  requires_approval boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sequence_steps (
  id uuid primary key default gen_random_uuid(),
  sequence_id uuid not null references public.sequences(id) on delete cascade,
  step_number integer not null check (step_number > 0),
  delay_minutes integer not null default 0 check (delay_minutes >= 0),
  subject_template text not null,
  body_template text not null,
  status text not null default 'draft' check (status in ('draft', 'approved', 'retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(sequence_id, step_number)
);

create table public.sequence_enrollments (
  id uuid primary key default gen_random_uuid(),
  sequence_id uuid not null references public.sequences(id) on delete restrict,
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'active', 'paused', 'completed', 'stopped_reply', 'stopped_suppressed', 'failed')),
  current_step integer not null default 0 check (current_step >= 0),
  next_action_at timestamptz,
  stopped_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(sequence_id, prospect_id)
);

create index sequence_enrollments_due_idx
  on public.sequence_enrollments(next_action_at)
  where status in ('pending', 'active');

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid references public.prospects(id) on delete set null,
  sequence_enrollment_id uuid references public.sequence_enrollments(id) on delete set null,
  direction text not null check (direction in ('inbound', 'outbound')),
  channel text not null default 'email' check (channel = 'email'),
  message_type text not null default 'manual'
    check (message_type in ('inbound_reply', 'inbound_confirmation', 'nurture', 'prospecting', 'client_lifecycle', 'manual', 'internal_notification')),
  provider text,
  provider_message_id text,
  provider_thread_id text,
  from_address text not null,
  to_addresses text[] not null default '{}',
  cc_addresses text[] not null default '{}',
  subject text,
  body_text text,
  body_html text,
  status text not null default 'received'
    check (status in ('draft', 'approval_required', 'queued', 'reserved', 'sent', 'delivered', 'received', 'failed', 'bounced', 'complained', 'suppressed')),
  classification text check (classification is null or classification in ('interested', 'not_interested', 'question', 'referral', 'unsubscribe', 'out_of_office', 'complaint', 'legal', 'unknown')),
  classification_confidence numeric(4,3) check (classification_confidence is null or classification_confidence between 0 and 1),
  decision_reason text,
  sent_at timestamptz,
  received_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index messages_provider_id_key
  on public.messages(provider, provider_message_id)
  where provider is not null and provider_message_id is not null;
create index messages_prospect_timeline_idx on public.messages(prospect_id, created_at desc);

-- The game platform already owns public.clients and public.events. Extend those
-- records for CRM lifecycle use instead of creating competing tables or changing
-- their existing RLS policies.
alter table public.clients
  add column if not exists company_id uuid references public.companies(id) on delete set null,
  add column if not exists primary_prospect_id uuid references public.prospects(id) on delete set null,
  add column if not exists lifetime_value numeric(12,2) not null default 0 check (lifetime_value >= 0),
  add column if not exists first_closed_at timestamptz,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

alter table public.events
  add column if not exists value numeric(12,2) check (value is null or value >= 0),
  add column if not exists attendee_count integer check (attendee_count is null or attendee_count >= 0),
  add column if not exists lifecycle_metadata jsonb not null default '{}'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid references public.prospects(id) on delete cascade,
  client_id uuid references public.clients(id) on delete cascade,
  event_id uuid references public.events(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'open' check (status in ('open', 'in_progress', 'completed', 'cancelled')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  due_at timestamptz,
  assigned_to text not null default 'michael',
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tasks_open_due_idx on public.tasks(due_at nulls first) where status in ('open', 'in_progress');

create table public.suppression_list (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  email_normalized text generated always as (lower(trim(email))) stored,
  reason text not null check (reason in ('unsubscribe', 'complaint', 'hard_bounce', 'manual', 'legal', 'invalid')),
  source text,
  provider_event_id text,
  created_at timestamptz not null default now(),
  unique(email_normalized)
);

create table public.agent_log (
  id bigint generated always as identity primary key,
  agent_name text not null,
  run_id uuid not null default gen_random_uuid(),
  action text not null,
  outcome text not null check (outcome in ('started', 'completed', 'skipped', 'blocked', 'failed', 'escalated')),
  prospect_id uuid references public.prospects(id) on delete set null,
  message_id uuid references public.messages(id) on delete set null,
  decision jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamptz not null default now()
);

create index agent_log_run_idx on public.agent_log(run_id, created_at);
create index agent_log_recent_failures_idx on public.agent_log(created_at desc) where outcome in ('failed', 'blocked', 'escalated');

create table public.signals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  signal_type text not null,
  source_url text,
  observed_at timestamptz not null default now(),
  expires_at timestamptz,
  strength numeric(4,3) not null default 0.500 check (strength between 0 and 1),
  evidence text not null,
  raw_data jsonb not null default '{}'::jsonb,
  fingerprint text not null unique,
  created_at timestamptz not null default now()
);

create index signals_company_strength_idx on public.signals(company_id, strength desc, observed_at desc);

create table public.email_send_counters (
  send_date date not null,
  message_type text not null check (message_type in ('inbound_confirmation', 'nurture', 'prospecting', 'client_lifecycle', 'internal_notification')),
  reserved_count integer not null default 0 check (reserved_count >= 0),
  sent_count integer not null default 0 check (sent_count >= 0 and sent_count <= reserved_count),
  failed_count integer not null default 0 check (failed_count >= 0 and failed_count <= reserved_count),
  updated_at timestamptz not null default now(),
  primary key(send_date, message_type)
);

create or replace function public.reserve_email_send(p_message_type text, p_recipient text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  config public.system_config%rowtype;
  normalized_recipient text := lower(trim(p_recipient));
  daily_cap integer;
  new_count integer;
begin
  select * into config from public.system_config where id = true;
  if config.id is null or not config.master_enabled then
    return jsonb_build_object('allowed', false, 'reason', 'master_kill_switch');
  end if;

  if p_message_type = 'inbound_confirmation' then
    if not config.inbound_auto_reply_enabled then
      return jsonb_build_object('allowed', false, 'reason', 'inbound_auto_reply_disabled');
    end if;
    daily_cap := config.daily_inbound_cap;
  elsif p_message_type = 'nurture' then
    if not config.nurture_enabled then
      return jsonb_build_object('allowed', false, 'reason', 'nurture_disabled');
    end if;
    daily_cap := config.daily_nurture_cap;
  elsif p_message_type = 'prospecting' then
    if not config.prospecting_enabled then
      return jsonb_build_object('allowed', false, 'reason', 'prospecting_disabled');
    end if;
    daily_cap := config.daily_prospecting_cap;
  elsif p_message_type = 'internal_notification' then
    if not config.internal_notifications_enabled then
      return jsonb_build_object('allowed', false, 'reason', 'internal_notifications_disabled');
    end if;
    daily_cap := 500;
  else
    return jsonb_build_object('allowed', false, 'reason', 'unsupported_message_type');
  end if;

  if p_message_type in ('nurture', 'prospecting') and exists (
    select 1 from public.suppression_list where email_normalized = normalized_recipient
  ) then
    return jsonb_build_object('allowed', false, 'reason', 'suppressed');
  end if;

  insert into public.email_send_counters(send_date, message_type)
  values (current_date, p_message_type)
  on conflict (send_date, message_type) do nothing;

  update public.email_send_counters
  set reserved_count = reserved_count + 1, updated_at = now()
  where send_date = current_date
    and message_type = p_message_type
    and reserved_count < daily_cap
  returning reserved_count into new_count;

  if new_count is null then
    return jsonb_build_object('allowed', false, 'reason', 'daily_cap_reached', 'cap', daily_cap);
  end if;
  return jsonb_build_object('allowed', true, 'reason', 'reserved', 'count', new_count, 'cap', daily_cap);
end;
$$;

create or replace function public.record_email_send_result(p_message_type text, p_sent boolean)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.email_send_counters
  set sent_count = sent_count + case when p_sent then 1 else 0 end,
      failed_count = failed_count + case when p_sent then 0 else 1 end,
      updated_at = now()
  where send_date = current_date and message_type = p_message_type;
end;
$$;

create or replace function automation.touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'system_config', 'companies', 'prospects', 'sequences', 'sequence_steps',
    'sequence_enrollments', 'messages', 'tasks'
  ]
  loop
    execute format('drop trigger if exists %I_touch_updated_at on public.%I', table_name, table_name);
    execute format(
      'create trigger %I_touch_updated_at before update on public.%I for each row execute function automation.touch_updated_at()',
      table_name, table_name
    );
  end loop;
end $$;

alter table public.system_config enable row level security;
alter table public.companies enable row level security;
alter table public.prospects enable row level security;
alter table public.sequences enable row level security;
alter table public.sequence_steps enable row level security;
alter table public.sequence_enrollments enable row level security;
alter table public.messages enable row level security;
alter table public.tasks enable row level security;
alter table public.suppression_list enable row level security;
alter table public.agent_log enable row level security;
alter table public.signals enable row level security;
alter table public.email_send_counters enable row level security;

revoke all on table public.system_config, public.companies, public.prospects,
  public.sequences, public.sequence_steps, public.sequence_enrollments,
  public.messages, public.tasks,
  public.suppression_list, public.agent_log, public.signals,
  public.email_send_counters from anon, authenticated;

grant select, insert, update, delete on table public.system_config, public.companies, public.prospects,
  public.sequences, public.sequence_steps, public.sequence_enrollments,
  public.messages, public.tasks,
  public.suppression_list, public.agent_log, public.signals,
  public.email_send_counters to service_role;
grant usage, select on sequence public.agent_log_id_seq to service_role;

revoke all on function public.reserve_email_send(text, text) from public, anon, authenticated;
revoke all on function public.record_email_send_result(text, boolean) from public, anon, authenticated;
grant execute on function public.reserve_email_send(text, text) to service_role;
grant execute on function public.record_email_send_result(text, boolean) to service_role;
