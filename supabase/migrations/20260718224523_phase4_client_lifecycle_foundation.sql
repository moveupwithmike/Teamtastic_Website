-- Phase 4 client lifecycle foundation.
-- This migration can prepare tasks and review-only drafts. It cannot send email.

alter table public.system_config
  add column if not exists phase4_lifecycle_enabled boolean not null default false,
  add column if not exists phase4_email_enabled boolean not null default false,
  add column if not exists phase4_learning_enabled boolean not null default false,
  add column if not exists phase4_escalation_enabled boolean not null default true,
  add column if not exists daily_client_lifecycle_cap integer not null default 10
    check (daily_client_lifecycle_cap between 0 and 100);

alter table public.tasks
  add column if not exists fingerprint text;

create unique index if not exists tasks_fingerprint_key
  on public.tasks(fingerprint)
  where fingerprint is not null;

create table public.lifecycle_actions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  event_id uuid references public.events(id) on delete cascade,
  prospect_id uuid references public.prospects(id) on delete set null,
  action_type text not null check (action_type in (
    'thank_you_review', 'testimonial_request', 'rebook_90_day',
    'anniversary', 'escalation_review'
  )),
  status text not null default 'scheduled' check (status in (
    'scheduled', 'review', 'approved', 'queued', 'sent', 'completed',
    'skipped', 'cancelled', 'failed'
  )),
  recipient_email text,
  subject text,
  body_text text,
  scheduled_for timestamptz not null,
  reviewed_at timestamptz,
  reviewed_by text,
  sent_at timestamptz,
  decision jsonb not null default '{}'::jsonb,
  fingerprint text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status not in ('approved', 'queued', 'sent') or reviewed_at is not null),
  check (status <> 'sent' or sent_at is not null)
);

create index lifecycle_actions_due_idx
  on public.lifecycle_actions(scheduled_for)
  where status in ('scheduled', 'review', 'approved', 'queued');
create index lifecycle_actions_client_idx
  on public.lifecycle_actions(client_id, created_at desc);

create table public.escalation_rules (
  id uuid primary key default gen_random_uuid(),
  rule_key text not null unique,
  description text not null,
  match_type text not null check (match_type in ('keyword', 'value_above', 'confidence_below')),
  pattern text,
  threshold numeric(12,3),
  priority text not null default 'high' check (priority in ('normal', 'high', 'urgent')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((match_type = 'keyword') = (pattern is not null)),
  check ((match_type in ('value_above', 'confidence_below')) = (threshold is not null))
);

insert into public.escalation_rules(rule_key, description, match_type, pattern, threshold, priority)
values
  ('pricing_negotiation', 'Pricing, discount, or negotiation requires Michael.', 'keyword', '(discount|negotia|lower the price|pricing exception|budget)', null, 'high'),
  ('complaint', 'Complaints or refund language require Michael.', 'keyword', '(complaint|refund|unhappy|disappointed|unacceptable)', null, 'urgent'),
  ('legal_language', 'Legal or contractual language requires Michael.', 'keyword', '(lawyer|attorney|legal|liability|indemn|breach|contract terms)', null, 'urgent'),
  ('high_value_opportunity', 'High-value opportunities require Michael.', 'value_above', null, 5000, 'high'),
  ('low_confidence', 'Uncertain automated decisions require Michael.', 'confidence_below', null, 0.800, 'high')
on conflict (rule_key) do update
set description = excluded.description,
    match_type = excluded.match_type,
    pattern = excluded.pattern,
    threshold = excluded.threshold,
    priority = excluded.priority,
    updated_at = now();

create or replace function automation.evaluate_phase4_escalation(
  p_text text default '',
  p_confidence numeric default 1,
  p_opportunity_value numeric default 0
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  with config as (
    select phase4_escalation_enabled
    from public.system_config
    where id = true
  ), matched as (
    select r.rule_key, r.description, r.priority
    from public.escalation_rules r, config c
    where c.phase4_escalation_enabled
      and r.active
      and (
        (r.match_type = 'keyword' and coalesce(p_text, '') ~* r.pattern)
        or (r.match_type = 'value_above' and coalesce(p_opportunity_value, 0) >= r.threshold)
        or (r.match_type = 'confidence_below' and coalesce(p_confidence, 0) < r.threshold)
      )
  )
  select jsonb_build_object(
    'escalate', exists(select 1 from matched),
    'reasons', coalesce((select jsonb_agg(to_jsonb(m)) from matched m), '[]'::jsonb)
  );
$$;

create or replace function automation.prepare_phase4_lifecycle()
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  config public.system_config%rowtype;
  onboarding_count integer := 0;
  pre_event_count integer := 0;
  action_count integer := 0;
  review_count integer := 0;
begin
  select * into config from public.system_config where id = true;
  if config.id is null or not config.master_enabled then
    return jsonb_build_object('prepared', false, 'reason', 'master_kill_switch');
  end if;
  if not config.phase4_lifecycle_enabled then
    return jsonb_build_object('prepared', false, 'reason', 'phase4_lifecycle_disabled');
  end if;

  insert into public.tasks(client_id, event_id, title, description, priority, due_at, source, fingerprint)
  select e.client_id, e.id, 'Complete client onboarding checklist',
    'Confirm primary contact, event goals, attendee count, format, timing, and facilitator notes.',
    'high', greatest(now(), e.scheduled_start_time - interval '14 days'),
    'phase4_lifecycle', 'phase4:onboarding:' || e.id::text
  from public.events e
  where e.client_id is not null
    and e.scheduled_start_time is not null
    and e.status in ('lobby', 'scheduled')
  on conflict (fingerprint) where fingerprint is not null do nothing;
  get diagnostics onboarding_count = row_count;

  insert into public.tasks(client_id, event_id, title, description, priority, due_at, source, fingerprint)
  select e.client_id, e.id, 'Run seven-day event readiness check',
    'Confirm final headcount, links or venue details, run of show, accessibility needs, and organizer expectations.',
    'high', greatest(now(), e.scheduled_start_time - interval '7 days'),
    'phase4_lifecycle', 'phase4:pre_event:' || e.id::text
  from public.events e
  where e.client_id is not null
    and e.scheduled_start_time is not null
    and e.status in ('lobby', 'scheduled')
  on conflict (fingerprint) where fingerprint is not null do nothing;
  get diagnostics pre_event_count = row_count;

  insert into public.lifecycle_actions(
    client_id, event_id, prospect_id, action_type, recipient_email,
    subject, body_text, scheduled_for, status, decision, fingerprint
  )
  select e.client_id, e.id, c.primary_prospect_id, template.action_type,
    lower(trim(coalesce(e.contact_email, c.primary_contact_email, c.email))),
    template.subject,
    replace(replace(template.body_text, '{{client}}', c.name), '{{event}}', coalesce(e.title, 'your Teamtastic event')),
    coalesce(e.scheduled_start_time, e.updated_at) + template.delay,
    case when coalesce(e.scheduled_start_time, e.updated_at) + template.delay <= now() then 'review' else 'scheduled' end,
    jsonb_build_object('send_enabled', false, 'template_version', 'phase4-v1'),
    'phase4:' || template.action_type || ':' || e.id::text
  from public.events e
  join public.clients c on c.id = e.client_id
  cross join (values
    ('thank_you_review', interval '48 hours', 'Thank you from Teamtastic',
      'Hi {{client}},\n\nThank you for trusting Teamtastic with {{event}}. We hope your team left laughing, connecting, and still talking about the experience.\n\nIf the event delivered what you hoped for, would you be open to sharing a quick review?\n\nMichael'),
    ('testimonial_request', interval '7 days', 'A quick Teamtastic favor',
      'Hi {{client}},\n\nWhat is one moment from {{event}} that your team is still talking about? If you are comfortable sharing it, we would love to feature your words as a Teamtastic testimonial.\n\nMichael'),
    ('rebook_90_day', interval '90 days', 'Ready for another round?',
      'Hi {{client}},\n\nIt has been a little while since {{event}}. If another team gathering is taking shape, I would be happy to send a few fresh ideas—and Teamtastic can handle the experience from start to finish.\n\nMichael'),
    ('anniversary', interval '1 year', 'One year since {{event}}',
      'Hi {{client}},\n\nIt has been a year since {{event}}. If the team is ready for a rematch, we have fresh ways to get everyone laughing, participating, and connecting again.\n\nMichael')
  ) as template(action_type, delay, subject, body_text)
  where e.client_id is not null
    and e.status = 'completed'
    and coalesce(e.contact_email, c.primary_contact_email, c.email) is not null
  on conflict (fingerprint) do nothing;
  get diagnostics action_count = row_count;

  update public.lifecycle_actions
  set status = 'review', updated_at = now()
  where status = 'scheduled' and scheduled_for <= now();
  get diagnostics review_count = row_count;

  insert into public.agent_log(agent_name, action, outcome, decision)
  values ('phase4-lifecycle', 'prepare_lifecycle', 'completed', jsonb_build_object(
    'onboarding_tasks', onboarding_count,
    'pre_event_tasks', pre_event_count,
    'actions_created', action_count,
    'moved_to_review', review_count,
    'send_enabled', false
  ));

  return jsonb_build_object(
    'prepared', true,
    'onboarding_tasks', onboarding_count,
    'pre_event_tasks', pre_event_count,
    'actions_created', action_count,
    'moved_to_review', review_count,
    'send_enabled', false
  );
end;
$$;

drop trigger if exists lifecycle_actions_touch_updated_at on public.lifecycle_actions;
create trigger lifecycle_actions_touch_updated_at
before update on public.lifecycle_actions
for each row execute function automation.touch_updated_at();

drop trigger if exists escalation_rules_touch_updated_at on public.escalation_rules;
create trigger escalation_rules_touch_updated_at
before update on public.escalation_rules
for each row execute function automation.touch_updated_at();

alter table public.lifecycle_actions enable row level security;
alter table public.escalation_rules enable row level security;

revoke all on table public.lifecycle_actions, public.escalation_rules from anon, authenticated;
grant select, insert, update, delete on table public.lifecycle_actions, public.escalation_rules to service_role;

revoke all on function automation.evaluate_phase4_escalation(text, numeric, numeric) from public, anon, authenticated;
revoke all on function automation.prepare_phase4_lifecycle() from public, anon, authenticated;
grant execute on function automation.evaluate_phase4_escalation(text, numeric, numeric) to service_role;
grant execute on function automation.prepare_phase4_lifecycle() to service_role;

do $$
declare
  job_id bigint;
begin
  if exists (select 1 from cron.job where jobname = 'phase4-lifecycle-preparation') then
    perform cron.unschedule('phase4-lifecycle-preparation');
  end if;
  perform cron.schedule(
    'phase4-lifecycle-preparation',
    '15 13 * * *',
    'select automation.prepare_phase4_lifecycle();'
  );
  select jobid into job_id from cron.job where jobname = 'phase4-lifecycle-preparation';
  perform cron.alter_job(job_id := job_id, active := false);
end $$;
