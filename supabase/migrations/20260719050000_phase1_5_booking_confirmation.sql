-- Phase 1.5 completion: let booking confirmations use the same fail-closed
-- send gate as every other autonomous email path.

alter table public.messages drop constraint messages_message_type_check;
alter table public.messages add constraint messages_message_type_check
  check (message_type in (
    'inbound_reply', 'inbound_confirmation', 'nurture', 'prospecting',
    'client_lifecycle', 'manual', 'internal_notification', 'booking'
  ));

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
  elsif p_message_type = 'booking' then
    if not config.booking_email_enabled then
      return jsonb_build_object('allowed', false, 'reason', 'booking_email_disabled');
    end if;
    daily_cap := config.daily_booking_email_cap;
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

alter table public.email_send_counters drop constraint email_send_counters_message_type_check;
alter table public.email_send_counters add constraint email_send_counters_message_type_check
  check (message_type in (
    'inbound_confirmation', 'nurture', 'prospecting', 'client_lifecycle',
    'internal_notification', 'booking'
  ));

-- A booking that fails after its slot hold (Zoom/Calendar error) must free the
-- slot immediately rather than wait out the hold expiry.
create or replace function public.fail_booking_hold(p_booking_id uuid, p_error text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.bookings
  set status = 'failed', updated_at = now(),
      context = context || jsonb_build_object('failure_reason', left(coalesce(p_error, 'unknown'), 500))
  where id = p_booking_id and status = 'held';
end;
$$;

revoke all on function public.fail_booking_hold(uuid, text) from public, anon, authenticated;
grant execute on function public.fail_booking_hold(uuid, text) to service_role;
