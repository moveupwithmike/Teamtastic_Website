-- Phase 2: Gmail ingestion, reply intelligence, sequence stopping, and reports.

alter table public.system_config
  add column if not exists gmail_ingestion_enabled boolean not null default false,
  add column if not exists daily_report_enabled boolean not null default true,
  add column if not exists daily_report_recipient text;

alter table public.messages
  add column if not exists header_message_id text,
  add column if not exists in_reply_to text,
  add column if not exists reference_headers text[] not null default '{}',
  add column if not exists snippet text,
  add column if not exists raw_headers jsonb not null default '{}'::jsonb;

create unique index if not exists messages_header_message_id_key
  on public.messages(header_message_id)
  where header_message_id is not null;

create table public.mailbox_sync_state (
  mailbox text primary key,
  provider text not null default 'gmail' check (provider = 'gmail'),
  last_history_id text,
  last_message_internal_date bigint,
  last_synced_at timestamptz,
  status text not null default 'not_configured'
    check (status in ('not_configured', 'ready', 'syncing', 'healthy', 'error', 'disabled')),
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.mailbox_sync_state(mailbox, status)
values ('michael@tryteamtastic.com', 'not_configured')
on conflict (mailbox) do nothing;

create table public.daily_reports (
  id uuid primary key default gen_random_uuid(),
  report_date date not null unique,
  status text not null default 'draft' check (status in ('draft', 'sent', 'failed', 'skipped')),
  recipient text,
  subject text,
  body_html text,
  summary jsonb not null default '{}'::jsonb,
  provider_message_id text,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function automation.handle_inbound_message()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  should_suppress boolean;
  task_priority text;
begin
  if new.direction <> 'inbound' or new.prospect_id is null then
    return new;
  end if;

  should_suppress := new.classification in ('unsubscribe', 'not_interested', 'complaint', 'legal');

  update public.prospects
  set last_inbound_at = coalesce(new.received_at, new.created_at),
      status = case
        when should_suppress then 'suppressed'
        when new.classification = 'interested' then 'interested'
        else 'replied'
      end
  where id = new.prospect_id;

  update public.sequence_enrollments
  set status = 'stopped_reply',
      stopped_reason = coalesce(new.classification, 'inbound_reply'),
      next_action_at = null
  where prospect_id = new.prospect_id
    and status in ('pending', 'active', 'paused');

  if should_suppress then
    insert into public.suppression_list(email, reason, source, provider_event_id)
    select
      p.email_normalized,
      case when new.classification = 'unsubscribe' then 'unsubscribe' else 'manual' end,
      'gmail_reply:' || coalesce(new.classification, 'unknown'),
      new.provider_message_id
    from public.prospects p
    where p.id = new.prospect_id and p.email_normalized is not null
    on conflict (email_normalized) do nothing;
  end if;

  if new.classification in ('interested', 'question', 'referral', 'complaint', 'legal', 'unknown')
     or coalesce(new.classification_confidence, 0) < 0.800 then
    task_priority := case
      when new.classification in ('complaint', 'legal') then 'urgent'
      when new.classification = 'interested' then 'high'
      else 'normal'
    end;
    insert into public.tasks(prospect_id, title, description, priority, due_at, source)
    values (
      new.prospect_id,
      'Review reply: ' || coalesce(new.subject, '(no subject)'),
      'Classified as ' || coalesce(new.classification, 'unknown') ||
        ' with confidence ' || coalesce(new.classification_confidence::text, '0') || '.',
      task_priority,
      case when task_priority = 'urgent' then now() else now() + interval '2 hours' end,
      'reply:' || new.id::text
    );
  end if;

  insert into public.agent_log(agent_name, action, outcome, prospect_id, message_id, decision)
  values (
    'reply-intelligence',
    'classify_and_stop_sequence',
    case when new.classification in ('complaint', 'legal', 'unknown')
      or coalesce(new.classification_confidence, 0) < 0.800 then 'escalated' else 'completed' end,
    new.prospect_id,
    new.id,
    jsonb_build_object(
      'classification', new.classification,
      'confidence', new.classification_confidence,
      'suppressed', should_suppress,
      'sequence_stopped', true
    )
  );
  return new;
end;
$$;

drop trigger if exists messages_handle_inbound on public.messages;
create trigger messages_handle_inbound
after insert on public.messages
for each row
when (new.direction = 'inbound')
execute function automation.handle_inbound_message();

drop trigger if exists mailbox_sync_state_touch_updated_at on public.mailbox_sync_state;
create trigger mailbox_sync_state_touch_updated_at
before update on public.mailbox_sync_state
for each row execute function automation.touch_updated_at();

drop trigger if exists daily_reports_touch_updated_at on public.daily_reports;
create trigger daily_reports_touch_updated_at
before update on public.daily_reports
for each row execute function automation.touch_updated_at();

alter table public.mailbox_sync_state enable row level security;
alter table public.daily_reports enable row level security;
revoke all on table public.mailbox_sync_state, public.daily_reports from anon, authenticated;
grant select, insert, update, delete on table public.mailbox_sync_state, public.daily_reports to service_role;
