-- Native Teamtastic booking foundation. Fail-closed until calendar validation is connected.

alter table public.system_config
  add column if not exists native_booking_enabled boolean not null default false,
  add column if not exists booking_email_enabled boolean not null default false,
  add column if not exists daily_booking_email_cap integer not null default 20
    check (daily_booking_email_cap between 0 and 200);

create table public.booking_types (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  duration_minutes integer not null check (duration_minutes between 5 and 240),
  buffer_before_minutes integer not null default 0 check (buffer_before_minutes between 0 and 120),
  buffer_after_minutes integer not null default 0 check (buffer_after_minutes between 0 and 120),
  zoom_enabled boolean not null default true,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.booking_settings (
  id boolean primary key default true check (id),
  enabled boolean not null default false,
  owner_timezone text not null default 'America/New_York',
  working_hours jsonb not null default '{
    "monday":[{"start":"09:00","end":"17:00"}],
    "tuesday":[{"start":"09:00","end":"17:00"}],
    "wednesday":[{"start":"09:00","end":"17:00"}],
    "thursday":[{"start":"09:00","end":"17:00"}],
    "friday":[{"start":"09:00","end":"17:00"}],
    "saturday":[],"sunday":[]
  }'::jsonb,
  blocked_dates jsonb not null default '[]'::jsonb,
  minimum_notice_minutes integer not null default 1440 check (minimum_notice_minutes between 0 and 43200),
  booking_horizon_days integer not null default 60 check (booking_horizon_days between 1 and 365),
  maximum_bookings_per_day integer not null default 4 check (maximum_bookings_per_day between 1 and 50),
  slot_interval_minutes integer not null default 15 check (slot_interval_minutes in (5, 10, 15, 20, 30, 60)),
  hold_minutes integer not null default 10 check (hold_minutes between 2 and 30),
  google_calendar_id text,
  calendar_connection_status text not null default 'not_connected'
    check (calendar_connection_status in ('not_connected', 'connected', 'error')),
  zoom_connection_status text not null default 'not_connected'
    check (zoom_connection_status in ('not_connected', 'connected', 'error')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.booking_settings(id) values (true) on conflict (id) do nothing;

insert into public.booking_types(
  slug, name, description, duration_minutes, buffer_before_minutes,
  buffer_after_minutes, zoom_enabled, active, sort_order
) values (
  'intro-call-15', '15-minute planning call',
  'A quick conversation about your team, goals, timing, and best-fit Teamtastic experience.',
  15, 5, 10, true, true, 10
)
on conflict (slug) do update set
  name=excluded.name, description=excluded.description,
  duration_minutes=excluded.duration_minutes,
  buffer_before_minutes=excluded.buffer_before_minutes,
  buffer_after_minutes=excluded.buffer_after_minutes,
  zoom_enabled=excluded.zoom_enabled,
  sort_order=excluded.sort_order,
  updated_at=now();

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  booking_type_id uuid not null references public.booking_types(id) on delete restrict,
  prospect_id uuid not null references public.prospects(id) on delete restrict,
  lead_id uuid references public.leads(id) on delete set null,
  name text not null,
  email text not null,
  email_normalized text generated always as (lower(trim(email))) stored,
  company text,
  visitor_timezone text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  blocked_starts_at timestamptz not null,
  blocked_ends_at timestamptz not null,
  status text not null default 'held' check (status in (
    'held', 'confirmed', 'completed', 'cancelled', 'rescheduled', 'no_show', 'expired', 'failed'
  )),
  hold_expires_at timestamptz,
  manage_token_hash text not null unique,
  google_event_id text,
  zoom_meeting_id text,
  zoom_join_url text,
  zoom_start_url_ciphertext text,
  source text,
  context jsonb not null default '{}'::jsonb,
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (blocked_starts_at <= starts_at and blocked_ends_at >= ends_at),
  check (blocked_ends_at > blocked_starts_at),
  check (status <> 'held' or hold_expires_at is not null),
  check (status <> 'confirmed' or confirmed_at is not null)
);

alter table public.bookings add constraint bookings_no_active_overlap
  exclude using gist (
    tstzrange(blocked_starts_at, blocked_ends_at, '[)') with &&
  ) where (status in ('held', 'confirmed'));

create index bookings_upcoming_idx on public.bookings(starts_at)
  where status in ('held', 'confirmed');
create index bookings_prospect_idx on public.bookings(prospect_id, created_at desc);
create index bookings_email_idx on public.bookings(email_normalized, created_at desc);

create or replace function public.hold_booking_slot(
  p_booking_type_slug text,
  p_name text,
  p_email text,
  p_company text,
  p_visitor_timezone text,
  p_starts_at timestamptz,
  p_submission_id uuid,
  p_source text,
  p_context jsonb,
  p_manage_token_hash text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  config public.system_config%rowtype;
  settings public.booking_settings%rowtype;
  booking_type public.booking_types%rowtype;
  lead_record public.leads%rowtype;
  prospect_record public.prospects%rowtype;
  booking_record public.bookings%rowtype;
  normalized_email text := lower(trim(p_email));
  booking_end timestamptz;
  day_count integer;
begin
  select * into config from public.system_config where id=true;
  select * into settings from public.booking_settings where id=true;
  if config.id is null or not config.master_enabled then
    return jsonb_build_object('held', false, 'reason', 'master_kill_switch');
  end if;
  if not config.native_booking_enabled or settings.id is null or not settings.enabled then
    return jsonb_build_object('held', false, 'reason', 'native_booking_disabled');
  end if;
  if settings.calendar_connection_status <> 'connected' then
    return jsonb_build_object('held', false, 'reason', 'calendar_not_connected');
  end if;
  if normalized_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' or length(normalized_email) > 254 then
    return jsonb_build_object('held', false, 'reason', 'invalid_email');
  end if;
  if nullif(trim(p_name), '') is null or length(trim(p_name)) > 120 then
    return jsonb_build_object('held', false, 'reason', 'invalid_name');
  end if;

  select * into booking_type from public.booking_types
  where slug=p_booking_type_slug and active;
  if booking_type.id is null then
    return jsonb_build_object('held', false, 'reason', 'booking_type_unavailable');
  end if;
  booking_end := p_starts_at + make_interval(mins => booking_type.duration_minutes);
  if p_starts_at < now() + make_interval(mins => settings.minimum_notice_minutes) then
    return jsonb_build_object('held', false, 'reason', 'minimum_notice');
  end if;
  if p_starts_at > now() + make_interval(days => settings.booking_horizon_days) then
    return jsonb_build_object('held', false, 'reason', 'outside_booking_horizon');
  end if;

  update public.bookings set status='expired', updated_at=now()
  where status='held' and hold_expires_at <= now();

  select count(*) into day_count from public.bookings
  where status in ('held','confirmed')
    and starts_at >= date_trunc('day', p_starts_at at time zone settings.owner_timezone) at time zone settings.owner_timezone
    and starts_at < (date_trunc('day', p_starts_at at time zone settings.owner_timezone) + interval '1 day') at time zone settings.owner_timezone;
  if day_count >= settings.maximum_bookings_per_day then
    return jsonb_build_object('held', false, 'reason', 'daily_limit');
  end if;

  if p_submission_id is not null then
    select * into lead_record from public.leads where submission_id=p_submission_id;
  end if;
  if lead_record.id is null then
    select * into lead_record from public.leads
    where email_normalized=normalized_email order by created_at desc limit 1;
  end if;
  if lead_record.prospect_id is not null then
    select * into prospect_record from public.prospects where id=lead_record.prospect_id;
  end if;
  if prospect_record.id is null then
    insert into public.prospects(full_name,email,source,status,last_inbound_at,metadata)
    values (trim(p_name), normalized_email, 'native_booking', 'new', now(), jsonb_build_object('booking_source', p_source))
    on conflict (email_normalized) where email_normalized is not null
    do update set full_name=coalesce(public.prospects.full_name,excluded.full_name), updated_at=now()
    returning * into prospect_record;
  end if;

  insert into public.bookings(
    booking_type_id,prospect_id,lead_id,name,email,company,visitor_timezone,
    starts_at,ends_at,blocked_starts_at,blocked_ends_at,status,hold_expires_at,
    manage_token_hash,source,context
  ) values (
    booking_type.id,prospect_record.id,lead_record.id,trim(p_name),normalized_email,
    nullif(trim(p_company),''),p_visitor_timezone,p_starts_at,booking_end,
    p_starts_at-make_interval(mins=>booking_type.buffer_before_minutes),
    booking_end+make_interval(mins=>booking_type.buffer_after_minutes),
    'held',now()+make_interval(mins=>settings.hold_minutes),p_manage_token_hash,
    left(coalesce(p_source,'website'),80),coalesce(p_context,'{}'::jsonb)
  ) returning * into booking_record;

  return jsonb_build_object(
    'held',true,'booking_id',booking_record.id,'hold_expires_at',booking_record.hold_expires_at,
    'starts_at',booking_record.starts_at,'ends_at',booking_record.ends_at
  );
exception
  when exclusion_violation then
    return jsonb_build_object('held',false,'reason','slot_unavailable');
  when unique_violation then
    return jsonb_build_object('held',false,'reason','request_already_used');
end;
$$;

create or replace function automation.on_booking_confirmed()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status='confirmed' and old.status is distinct from 'confirmed' then
    update public.prospects
    set status=case when status in ('converted','suppressed','not_interested','disqualified') then status else 'interested' end,
        score=greatest(coalesce(score,0),95),
        metadata=metadata || jsonb_build_object('high_intent','native_booking','last_booking_id',new.id),
        updated_at=now()
    where id=new.prospect_id;

    update public.sequence_enrollments
    set status='paused',stopped_reason='native_booking_confirmed',next_action_at=null,updated_at=now()
    where prospect_id=new.prospect_id and status in ('pending','active');

    insert into public.tasks(prospect_id,title,description,priority,due_at,source,fingerprint)
    values (
      new.prospect_id,'Prepare for booked Teamtastic call with '||new.name,
      'Review the lead source, quiz or concierge answers, company context, and desired outcome before the call.',
      'high',greatest(now(),new.starts_at-interval '24 hours'),'native_booking',
      'booking:prep:'||new.id::text
    ) on conflict (fingerprint) where fingerprint is not null do nothing;
  end if;
  return new;
end;
$$;

create trigger bookings_confirmed_crm
after update of status on public.bookings
for each row execute function automation.on_booking_confirmed();

drop trigger if exists booking_types_touch_updated_at on public.booking_types;
create trigger booking_types_touch_updated_at before update on public.booking_types
for each row execute function automation.touch_updated_at();
drop trigger if exists booking_settings_touch_updated_at on public.booking_settings;
create trigger booking_settings_touch_updated_at before update on public.booking_settings
for each row execute function automation.touch_updated_at();
drop trigger if exists bookings_touch_updated_at on public.bookings;
create trigger bookings_touch_updated_at before update on public.bookings
for each row execute function automation.touch_updated_at();

alter table public.booking_types enable row level security;
alter table public.booking_settings enable row level security;
alter table public.bookings enable row level security;
revoke all on table public.booking_types,public.booking_settings,public.bookings from anon,authenticated;
grant select,insert,update,delete on table public.booking_types,public.booking_settings,public.bookings to service_role;
revoke all on function public.hold_booking_slot(text,text,text,text,text,timestamptz,uuid,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.hold_booking_slot(text,text,text,text,text,timestamptz,uuid,text,jsonb,text) to service_role;
