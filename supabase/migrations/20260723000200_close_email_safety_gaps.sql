-- Make reserve_email_send the policy boundary for every recipient-facing send.
-- Internal operational mail is explicitly exempt from recipient suppression,
-- but still obeys the master switch, its feature switch, and a daily cap.

create or replace function public.reserve_email_send(p_message_type text,p_recipient text)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  config public.system_config%rowtype;
  normalized_recipient text:=lower(trim(p_recipient));
  daily_cap integer;
  new_count integer;
begin
  select * into config from public.system_config where id=true;
  if config.id is null or not config.master_enabled then
    return jsonb_build_object('allowed',false,'reason','master_kill_switch');
  end if;
  if normalized_recipient = '' then
    return jsonb_build_object('allowed',false,'reason','missing_recipient');
  end if;

  if p_message_type='inbound_confirmation' then
    if config.outbound_auto_paused then return jsonb_build_object('allowed',false,'reason','outbound_auto_paused'); end if;
    if not config.inbound_auto_reply_enabled then return jsonb_build_object('allowed',false,'reason','inbound_auto_reply_disabled'); end if;
    daily_cap:=config.daily_inbound_cap;
  elsif p_message_type='nurture' then
    if config.outbound_auto_paused then return jsonb_build_object('allowed',false,'reason','outbound_auto_paused'); end if;
    if not config.nurture_enabled then return jsonb_build_object('allowed',false,'reason','nurture_disabled'); end if;
    daily_cap:=config.daily_nurture_cap;
  elsif p_message_type='prospecting' then
    if config.outbound_auto_paused then return jsonb_build_object('allowed',false,'reason','outbound_auto_paused'); end if;
    if not config.prospecting_enabled then return jsonb_build_object('allowed',false,'reason','prospecting_disabled'); end if;
    daily_cap:=config.daily_prospecting_cap;
  elsif p_message_type='booking' then
    if not config.booking_email_enabled then return jsonb_build_object('allowed',false,'reason','booking_email_disabled'); end if;
    daily_cap:=config.daily_booking_email_cap;
  elsif p_message_type='proposal' then
    if not config.proposal_email_enabled then return jsonb_build_object('allowed',false,'reason','proposal_email_disabled'); end if;
    daily_cap:=config.daily_proposal_cap;
  elsif p_message_type='internal_notification' then
    if not config.internal_notifications_enabled then return jsonb_build_object('allowed',false,'reason','internal_notifications_disabled'); end if;
    daily_cap:=500;
  else
    return jsonb_build_object('allowed',false,'reason','unsupported_message_type');
  end if;

  if p_message_type <> 'internal_notification' and exists(
    select 1 from public.suppression_list where email_normalized=normalized_recipient
  ) then
    return jsonb_build_object('allowed',false,'reason','suppressed');
  end if;

  insert into public.email_send_counters(send_date,message_type)
  values(current_date,p_message_type)
  on conflict(send_date,message_type) do nothing;

  update public.email_send_counters
  set reserved_count=reserved_count+1,updated_at=now()
  where send_date=current_date
    and message_type=p_message_type
    and reserved_count<daily_cap
  returning reserved_count into new_count;

  if new_count is null then
    return jsonb_build_object('allowed',false,'reason','daily_cap_reached','cap',daily_cap);
  end if;
  return jsonb_build_object(
    'allowed',true,
    'reason','reserved',
    'count',new_count,
    'cap',daily_cap,
    'suppression_exempt',p_message_type='internal_notification'
  );
end;
$$;

revoke all on function public.reserve_email_send(text,text) from public,anon,authenticated;
grant execute on function public.reserve_email_send(text,text) to service_role;
