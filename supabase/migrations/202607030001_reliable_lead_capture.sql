create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

alter table public.leads
  add column if not exists submission_id uuid,
  add column if not exists email_normalized text,
  add column if not exists phone text,
  add column if not exists recommendation_key text,
  add column if not exists landing_page text,
  add column if not exists referrer text,
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text,
  add column if not exists utm_content text,
  add column if not exists utm_term text,
  add column if not exists context jsonb not null default '{}'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

update public.leads
set
  submission_id = coalesce(submission_id, gen_random_uuid()),
  email_normalized = lower(trim(email)),
  status = lower(coalesce(status, 'new'))
where submission_id is null or email_normalized is null or status is null or status <> lower(status);

alter table public.leads
  alter column submission_id set not null,
  alter column email_normalized set not null,
  alter column status set default 'new';

create unique index if not exists leads_submission_id_key on public.leads(submission_id);
create index if not exists leads_email_normalized_created_idx
  on public.leads(email_normalized, created_at desc);

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  notification_type text not null,
  status text not null default 'pending',
  provider_message_id text,
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(lead_id, notification_type)
);

create table if not exists public.stripe_events (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text not null unique,
  stripe_session_id text not null unique,
  lead_id uuid references public.leads(id) on delete set null,
  submission_id uuid,
  customer_email text,
  amount_total integer not null,
  currency text not null,
  payment_status text not null,
  checkout_mode text,
  payment_link_id text,
  product_key text not null default 'unclassified',
  paid_at timestamptz not null,
  matched boolean not null default false,
  alert_status text not null default 'pending',
  alert_attempts integer not null default 0,
  alert_error text,
  created_at timestamptz not null default now()
);

alter table public.notification_deliveries enable row level security;
alter table public.stripe_events enable row level security;

revoke insert, update, delete on public.leads from anon, authenticated;
revoke all on public.notification_deliveries from anon, authenticated;
revoke all on public.stripe_events from anon, authenticated;

create or replace function public.notify_new_lead()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  function_url text;
  webhook_secret text;
begin
  insert into public.notification_deliveries (lead_id, notification_type)
  values
    (new.id, 'customer_confirmation'),
    (new.id, 'internal_email')
  on conflict (lead_id, notification_type) do nothing;

  select decrypted_secret into function_url
  from vault.decrypted_secrets where name = 'lead_notification_function_url' limit 1;
  select decrypted_secret into webhook_secret
  from vault.decrypted_secrets where name = 'lead_notification_webhook_secret' limit 1;

  if function_url is not null and webhook_secret is not null then
    perform net.http_post(
      url := function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-webhook-secret', webhook_secret
      ),
      body := jsonb_build_object('lead_id', new.id)
    );
  end if;
  return new;
end;
$$;

-- Replace the legacy handle-new-lead webhook. Keeping both triggers would send
-- duplicate customer emails for every lead.
drop trigger if exists on_lead_created on public.leads;
drop trigger if exists leads_notify_after_insert on public.leads;
create trigger leads_notify_after_insert
after insert on public.leads
for each row execute function public.notify_new_lead();

create or replace function public.retry_pending_lead_notifications()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  function_url text;
  webhook_secret text;
  pending_lead record;
begin
  select decrypted_secret into function_url
  from vault.decrypted_secrets where name = 'lead_notification_function_url' limit 1;
  select decrypted_secret into webhook_secret
  from vault.decrypted_secrets where name = 'lead_notification_webhook_secret' limit 1;

  if function_url is null or webhook_secret is null then
    return;
  end if;

  for pending_lead in
    select distinct l.id
    from public.leads l
    join public.notification_deliveries d on d.lead_id = l.id
    where d.status in ('pending', 'failed')
      and d.attempts < 5
      and l.created_at > now() - interval '7 days'
    limit 100
  loop
    perform net.http_post(
      url := function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-webhook-secret', webhook_secret
      ),
      body := jsonb_build_object('lead_id', pending_lead.id)
    );
  end loop;
end;
$$;

do $$
declare
  existing_job bigint;
begin
  select jobid into existing_job from cron.job
  where jobname = 'retry-pending-lead-notifications'
  limit 1;
  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;
  perform cron.schedule(
    'retry-pending-lead-notifications',
    '*/5 * * * *',
    'select public.retry_pending_lead_notifications();'
  );
end;
$$;
