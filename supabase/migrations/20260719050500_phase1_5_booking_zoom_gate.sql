-- A booking type that requires Zoom must not be held until Zoom is verified
-- connected, matching the existing calendar_connection_status gate.

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
  if booking_type.zoom_enabled and settings.zoom_connection_status <> 'connected' then
    return jsonb_build_object('held', false, 'reason', 'zoom_not_connected');
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
