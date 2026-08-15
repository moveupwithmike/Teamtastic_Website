-- Holiday lead qualification and peak-season response SLA.
-- This migration creates internal work only; it does not send customer email.

alter table public.leads
  add column if not exists preferred_event_date date,
  add column if not exists alternate_event_date date,
  add column if not exists event_timezone text,
  add column if not exists preferred_time text,
  add column if not exists budget_range text,
  add column if not exists package_interest text,
  add column if not exists decision_timeline text;

create index if not exists leads_holiday_event_date_idx
  on public.leads(preferred_event_date, created_at desc)
  where lead_source in (
    'holiday_party_money_page',
    'year_end_celebration_page',
    'large_holiday_event_page'
  );

create or replace function automation.prepare_holiday_lead_sla()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_is_holiday boolean;
  v_is_december boolean;
  v_deal_id uuid;
  v_description text;
begin
  v_is_holiday := new.lead_source in (
    'holiday_party_money_page',
    'year_end_celebration_page',
    'large_holiday_event_page'
  );
  if not v_is_holiday or new.prospect_id is null then return new; end if;

  v_is_december := extract(month from new.preferred_event_date) = 12
    or extract(month from new.alternate_event_date) = 12;
  v_description := concat_ws(E'\n',
    'Holiday lead response target: 15–30 minutes during business hours.',
    'Company: ' || coalesce(new.company, 'Not provided'),
    'Preferred date: ' || coalesce(new.preferred_event_date::text, 'Not provided'),
    'Alternate date: ' || coalesce(new.alternate_event_date::text, 'Not provided'),
    'Time zone: ' || coalesce(new.event_timezone, 'Not provided'),
    'Preferred time: ' || coalesce(new.preferred_time, 'Not provided'),
    'Team size: ' || coalesce(new.team_size, 'Not provided'),
    'Budget: ' || coalesce(new.budget_range, 'Not provided'),
    'Package: ' || coalesce(new.package_interest, 'Not provided'),
    'Decision timing: ' || coalesce(new.decision_timeline, 'Not provided')
  );

  insert into public.tasks(
    prospect_id, title, description, priority, due_at, source, fingerprint
  ) values (
    new.prospect_id,
    case when v_is_december then 'Holiday lead: confirm December availability' else 'Holiday lead: respond within 30 minutes' end,
    v_description,
    case when v_is_december or new.decision_timeline = 'this-week' then 'urgent' else 'high' end,
    new.created_at + interval '15 minutes',
    'holiday_sla',
    'holiday:speed-to-lead:' || new.id::text
  ) on conflict (fingerprint) where fingerprint is not null do nothing;

  if v_is_december then
    insert into public.tasks(
      prospect_id, title, description, priority, due_at, source, fingerprint
    ) values (
      new.prospect_id, 'Check prime-time December capacity',
      'The requested date falls in December. Confirm host and production capacity before promising availability.',
      'urgent', now(), 'holiday_sla', 'holiday:december-risk:' || new.id::text
    ) on conflict (fingerprint) where fingerprint is not null do nothing;
  end if;

  insert into public.tasks(prospect_id, title, description, priority, due_at, source, fingerprint)
  select new.prospect_id, followup.title,
    'Use only if the prospect has not replied. Review the lead timeline before contacting them.',
    followup.priority, new.created_at + followup.delay, 'holiday_sla',
    'holiday:followup:' || followup.day_number || ':' || new.id::text
  from (values
    (1, interval '1 day', 'Holiday lead follow-up — day 1', 'high'),
    (3, interval '3 days', 'Holiday lead follow-up — day 3', 'normal'),
    (7, interval '7 days', 'Holiday lead follow-up — day 7', 'normal')
  ) as followup(day_number, delay, title, priority)
  on conflict (fingerprint) where fingerprint is not null do nothing;

  select id into v_deal_id
  from public.deals
  where prospect_id = new.prospect_id and outcome = 'open'
  order by created_at desc limit 1 for update;

  if v_deal_id is null then
    insert into public.deals(
      prospect_id, title, stage, outcome, next_action, next_action_due_at,
      decision_date, stage_source, stage_source_id, source, metadata
    ) values (
      new.prospect_id,
      coalesce(nullif(new.company, ''), new.name) || ' — Holiday event',
      'new_lead', 'open', 'Respond and confirm holiday availability',
      new.created_at + interval '15 minutes',
      case new.decision_timeline
        when 'this-week' then (new.created_at + interval '7 days')::date
        when '1-2-weeks' then (new.created_at + interval '14 days')::date
        when 'this-month' then (date_trunc('month', new.created_at) + interval '1 month - 1 day')::date
        else null end,
      'holiday_lead', new.id::text, 'holiday_lead',
      jsonb_build_object(
        'lead_id', new.id,
        'preferred_event_date', new.preferred_event_date,
        'alternate_event_date', new.alternate_event_date,
        'event_timezone', new.event_timezone,
        'preferred_time', new.preferred_time,
        'budget_range', new.budget_range,
        'package_interest', new.package_interest,
        'decision_timeline', new.decision_timeline,
        'december_availability_risk', v_is_december
      )
    ) returning id into v_deal_id;
  else
    update public.deals set
      next_action = coalesce(public.deals.next_action, 'Respond and confirm holiday availability'),
      next_action_due_at = coalesce(public.deals.next_action_due_at, new.created_at + interval '15 minutes'),
      metadata = public.deals.metadata || jsonb_build_object(
        'latest_holiday_lead_id', new.id,
        'preferred_event_date', new.preferred_event_date,
        'event_timezone', new.event_timezone,
        'december_availability_risk', v_is_december
      ),
      updated_at = now()
    where id = v_deal_id;
  end if;

  return new;
end;
$$;

drop trigger if exists leads_holiday_sla_after_crm_sync on public.leads;
create trigger leads_holiday_sla_after_crm_sync
after insert or update of prospect_id on public.leads
for each row
when (new.prospect_id is not null)
execute function automation.prepare_holiday_lead_sla();

create or replace function automation.refresh_holiday_sla_tasks()
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  cancelled_count integer := 0;
  repaired_deals integer := 0;
begin
  update public.tasks t set
    status = 'cancelled',
    updated_at = now(),
    description = coalesce(t.description, '') || E'\nCancelled automatically because a reply was received.'
  from public.leads l
  where t.prospect_id = l.prospect_id
    and t.source = 'holiday_sla'
    and t.fingerprint like 'holiday:followup:%:' || l.id::text
    and t.status in ('open', 'in_progress')
    and exists (
      select 1 from public.messages m
      where m.prospect_id = l.prospect_id
        and m.direction = 'inbound'
        and coalesce(m.received_at, m.created_at) > l.created_at
    );
  get diagnostics cancelled_count = row_count;

  update public.deals set
    next_action = 'Review opportunity and set the next sales action',
    next_action_due_at = now(),
    updated_at = now()
  where outcome = 'open'
    and (nullif(trim(next_action), '') is null or next_action_due_at is null);
  get diagnostics repaired_deals = row_count;

  return jsonb_build_object('cancelled_followups', cancelled_count, 'repaired_open_deals', repaired_deals);
end;
$$;

revoke all on function automation.prepare_holiday_lead_sla() from public, anon, authenticated;
revoke all on function automation.refresh_holiday_sla_tasks() from public, anon, authenticated;
grant execute on function automation.prepare_holiday_lead_sla() to service_role;
grant execute on function automation.refresh_holiday_sla_tasks() to service_role;

do $$
begin
  if exists(select 1 from cron.job where jobname = 'holiday-sla-maintenance') then
    perform cron.unschedule('holiday-sla-maintenance');
  end if;
  perform cron.schedule(
    'holiday-sla-maintenance',
    '*/15 * * * *',
    'select automation.refresh_holiday_sla_tasks();'
  );
end $$;
