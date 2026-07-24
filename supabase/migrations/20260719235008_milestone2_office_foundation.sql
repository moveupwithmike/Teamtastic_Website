-- Milestone 2: private office workflow data. All customer email still requires
-- an authenticated, allow-listed human approval in the Next.js server action.

alter table public.system_config
  add column if not exists proposal_email_enabled boolean not null default false,
  add column if not exists daily_proposal_cap integer not null default 10
    check (daily_proposal_cap between 0 and 50);

alter table public.deals
  add column if not exists call_outcome text,
  add column if not exists call_completed_at timestamptz,
  add column if not exists package_name text,
  add column if not exists budget_amount numeric(12,2),
  add column if not exists call_notes text;

alter table public.deals add constraint deals_call_outcome_check
  check (call_outcome is null or call_outcome in ('qualified','unqualified','follow_up','no_show'));
alter table public.deals add constraint deals_budget_amount_check
  check (budget_amount is null or budget_amount >= 0);

create table public.proposals (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  prospect_id uuid references public.prospects(id) on delete set null,
  recipient_email text not null,
  package_name text not null,
  price numeric(12,2) not null check (price >= 0),
  currency text not null default 'usd' check (currency ~ '^[a-z]{3}$'),
  expires_on date not null,
  deposit_url text not null,
  subject text not null,
  body_text text not null,
  status text not null default 'draft' check (status in ('draft','approved','sent','rejected','failed','expired')),
  approved_at timestamptz,
  approved_by text,
  sent_at timestamptz,
  provider_message_id text,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status not in ('approved','sent') or (approved_at is not null and approved_by is not null)),
  check (status <> 'sent' or (sent_at is not null and provider_message_id is not null))
);

create index proposals_deal_idx on public.proposals(deal_id, created_at desc);
create index proposals_review_idx on public.proposals(status, created_at)
  where status in ('draft','approved','failed');
create unique index proposals_one_active_per_deal_idx on public.proposals(deal_id)
  where status in ('draft','approved');

drop trigger if exists proposals_touch_updated_at on public.proposals;
create trigger proposals_touch_updated_at before update on public.proposals
for each row execute function automation.touch_updated_at();

create or replace function public.apply_post_call_outcome(
  p_booking_id uuid,
  p_outcome text,
  p_package_name text default null,
  p_budget_amount numeric default null,
  p_next_step text default null,
  p_notes text default null,
  p_actor text default 'office'
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  booking_record public.bookings%rowtype;
  deal_record public.deals%rowtype;
  target_stage text;
  clean_notes text := nullif(trim(p_notes), '');
begin
  if p_outcome not in ('qualified','unqualified','follow_up','no_show') then
    return jsonb_build_object('updated',false,'reason','invalid_outcome');
  end if;
  if p_budget_amount is not null and p_budget_amount < 0 then
    return jsonb_build_object('updated',false,'reason','invalid_budget');
  end if;

  select * into booking_record from public.bookings where id=p_booking_id for update;
  if booking_record.id is null then return jsonb_build_object('updated',false,'reason','booking_not_found'); end if;
  select * into deal_record from public.deals where primary_booking_id=p_booking_id for update;
  if deal_record.id is null then
    perform automation.sync_booking_deal(p_booking_id);
    select * into deal_record from public.deals where primary_booking_id=p_booking_id for update;
  end if;
  if deal_record.id is null then return jsonb_build_object('updated',false,'reason','deal_not_found'); end if;

  if p_outcome='no_show' then
    update public.bookings set status='no_show',updated_at=now() where id=p_booking_id;
    target_stage := deal_record.stage;
  else
    update public.bookings set status='completed',updated_at=now() where id=p_booking_id;
    target_stage := case when p_outcome='qualified' then 'proposal_needed'
      when p_outcome='unqualified' then 'closed_lost' else 'call_completed' end;
  end if;

  update public.deals set
    stage=target_stage,
    outcome=case when p_outcome='unqualified' then 'lost' else public.deals.outcome end,
    lost_at=case when p_outcome='unqualified' then now() else public.deals.lost_at end,
    lost_reason=case when p_outcome='unqualified' then coalesce(clean_notes,'Not qualified after discovery call') else public.deals.lost_reason end,
    call_outcome=p_outcome,
    call_completed_at=now(),
    package_name=coalesce(nullif(trim(p_package_name),''),public.deals.package_name),
    budget_amount=coalesce(p_budget_amount,public.deals.budget_amount),
    expected_value=coalesce(p_budget_amount,public.deals.expected_value),
    call_notes=clean_notes,
    next_action=case when p_outcome='unqualified' then null
      when p_outcome='no_show' then 'Send no-show rebooking follow-up'
      when p_outcome='qualified' then coalesce(nullif(trim(p_next_step),''),'Prepare and send proposal')
      else coalesce(nullif(trim(p_next_step),''),'Complete the agreed follow-up') end,
    next_action_due_at=case when p_outcome='unqualified' then null else now()+interval '1 day' end,
    stage_source='post_call_outcome',stage_source_id=p_booking_id::text,
    metadata=public.deals.metadata || jsonb_build_object('last_outcome_actor',left(coalesce(p_actor,'office'),200)),
    updated_at=now()
  where id=deal_record.id returning * into deal_record;

  update public.tasks set status='completed',updated_at=now()
  where fingerprint='booking:prep:'||p_booking_id::text and status in ('open','in_progress');
  update public.tasks set status='completed',updated_at=now()
  where fingerprint='office:post-call:'||p_booking_id::text and status in ('open','in_progress');

  return jsonb_build_object('updated',true,'deal_id',deal_record.id,'stage',deal_record.stage,'outcome',deal_record.outcome);
end;
$$;

create or replace function automation.prepare_post_call_tasks()
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare created_count integer;
begin
  insert into public.tasks(prospect_id,title,description,priority,due_at,source,fingerprint)
  select b.prospect_id,'Record call outcome for '||b.name,
    'Mark the call qualified, follow-up, unqualified, or no-show; capture package, budget, and next step.',
    'high',b.ends_at,'office_post_call','office:post-call:'||b.id::text
  from public.bookings b
  where b.status='confirmed' and b.ends_at<=now()
  on conflict (fingerprint) where fingerprint is not null do nothing;
  get diagnostics created_count=row_count;
  return jsonb_build_object('created',created_count);
end;
$$;

alter table public.messages drop constraint if exists messages_message_type_check;
alter table public.messages add constraint messages_message_type_check
  check (message_type in (
    'inbound_reply','inbound_confirmation','nurture','prospecting',
    'client_lifecycle','manual','internal_notification','booking','proposal'
  ));
alter table public.email_send_counters drop constraint if exists email_send_counters_message_type_check;
alter table public.email_send_counters add constraint email_send_counters_message_type_check
  check (message_type in (
    'inbound_confirmation','nurture','prospecting','client_lifecycle',
    'internal_notification','booking','proposal'
  ));

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
  if config.id is null or not config.master_enabled then return jsonb_build_object('allowed',false,'reason','master_kill_switch'); end if;
  if p_message_type='inbound_confirmation' then
    if not config.inbound_auto_reply_enabled then return jsonb_build_object('allowed',false,'reason','inbound_auto_reply_disabled'); end if;
    daily_cap:=config.daily_inbound_cap;
  elsif p_message_type='nurture' then
    if not config.nurture_enabled then return jsonb_build_object('allowed',false,'reason','nurture_disabled'); end if;
    daily_cap:=config.daily_nurture_cap;
  elsif p_message_type='prospecting' then
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
  else return jsonb_build_object('allowed',false,'reason','unsupported_message_type'); end if;

  if p_message_type in ('nurture','prospecting','proposal') and exists(
    select 1 from public.suppression_list where email_normalized=normalized_recipient
  ) then return jsonb_build_object('allowed',false,'reason','suppressed'); end if;

  insert into public.email_send_counters(send_date,message_type) values(current_date,p_message_type)
  on conflict(send_date,message_type) do nothing;
  update public.email_send_counters set reserved_count=reserved_count+1,updated_at=now()
  where send_date=current_date and message_type=p_message_type and reserved_count<daily_cap
  returning reserved_count into new_count;
  if new_count is null then return jsonb_build_object('allowed',false,'reason','daily_cap_reached','cap',daily_cap); end if;
  return jsonb_build_object('allowed',true,'reason','reserved','count',new_count,'cap',daily_cap);
end;
$$;

alter table public.proposals enable row level security;
revoke all on table public.proposals from anon,authenticated;
grant select,insert,update,delete on table public.proposals to service_role;
revoke all on function public.apply_post_call_outcome(uuid,text,text,numeric,text,text,text) from public,anon,authenticated;
revoke all on function automation.prepare_post_call_tasks() from public,anon,authenticated;
grant execute on function public.apply_post_call_outcome(uuid,text,text,numeric,text,text,text) to service_role;
grant execute on function automation.prepare_post_call_tasks() to service_role;

do $$
begin
  if exists(select 1 from cron.job where jobname='office-post-call-tasks') then
    perform cron.unschedule('office-post-call-tasks');
  end if;
  perform cron.schedule('office-post-call-tasks','*/15 * * * *','select automation.prepare_post_call_tasks();');
end $$;
