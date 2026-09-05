-- Give private-event inquiries a first-class identity without pretending they
-- belong to a company. The lead is the canonical per-inquiry classification;
-- the prospect classification is a convenient CRM rollup and can be "mixed"
-- when the same person has both corporate and private inquiries.

alter table public.leads
  add column if not exists audience_type text,
  add column if not exists group_name text;

update public.leads
set audience_type = case
  when lead_source = 'michael_family_concierge' then 'family'
  when lower(coalesce(context->>'audience_type', context->>'audience', '')) = 'friends' then 'friends'
  when lower(coalesce(context->>'audience_type', context->>'audience', '')) in ('private', 'other_private_event') then 'other_private_event'
  else 'corporate'
end
where audience_type is null;

update public.leads
set group_name = coalesce(group_name, company),
    company = null
where audience_type in ('family', 'friends', 'other_private_event');

alter table public.leads
  alter column audience_type set default 'corporate',
  alter column audience_type set not null;

alter table public.leads
  drop constraint if exists leads_audience_type_check,
  add constraint leads_audience_type_check
    check (audience_type in ('corporate', 'family', 'friends', 'other_private_event'));

create index if not exists leads_audience_created_idx
  on public.leads(audience_type, created_at desc);

alter table public.prospects
  add column if not exists audience_type text;

with lead_audiences as (
  select
    prospect_id,
    count(distinct audience_type) as audience_count,
    max(audience_type) as only_audience
  from public.leads
  where prospect_id is not null
  group by prospect_id
)
update public.prospects p
set audience_type = case
  when la.audience_count > 1 then 'mixed'
  else la.only_audience
end
from lead_audiences la
where p.id = la.prospect_id
  and p.audience_type is null;

update public.prospects
set audience_type = 'corporate'
where audience_type is null;

alter table public.prospects
  alter column audience_type set default 'corporate',
  alter column audience_type set not null;

alter table public.prospects
  drop constraint if exists prospects_audience_type_check,
  add constraint prospects_audience_type_check
    check (audience_type in ('corporate', 'family', 'friends', 'other_private_event', 'mixed'));

create index if not exists prospects_audience_updated_idx
  on public.prospects(audience_type, updated_at desc);

comment on column public.leads.audience_type is
  'Audience for this inquiry: corporate, family, friends, or other_private_event.';
comment on column public.leads.group_name is
  'Optional family/friend group label. Never use the company field as a substitute.';
comment on column public.prospects.audience_type is
  'CRM rollup of linked inquiry audiences; mixed means the contact has both corporate and private inquiries.';

-- One fail-closed stop check shared by both inbound nurture tracks. A reply,
-- booking, suppression, conversion, or explicit negative state ends automation.
create or replace function public.lead_nurture_stop_reason(p_lead_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  lead_record public.leads%rowtype;
  prospect_status text;
begin
  select * into lead_record from public.leads where id = p_lead_id;
  if not found then return 'lead_missing'; end if;

  if lead_record.status in ('converted', 'suppressed', 'disqualified') then
    return 'lead_' || lead_record.status;
  end if;
  if exists (
    select 1 from public.suppression_list
    where email_normalized = lead_record.email_normalized
  ) then return 'suppressed'; end if;

  if lead_record.prospect_id is null then return null; end if;
  select status into prospect_status from public.prospects where id = lead_record.prospect_id;
  if prospect_status in ('replied', 'interested', 'not_interested', 'converted', 'suppressed', 'disqualified') then
    return 'prospect_' || prospect_status;
  end if;
  if exists (
    select 1 from public.messages
    where prospect_id = lead_record.prospect_id
      and direction = 'inbound'
      and created_at >= lead_record.created_at
  ) then return 'replied'; end if;
  if exists (
    select 1 from public.bookings
    where prospect_id = lead_record.prospect_id
      and status in ('held', 'confirmed', 'completed', 'rescheduled')
      and created_at >= lead_record.created_at
  ) then return 'booked'; end if;

  return null;
end;
$$;

revoke execute on function public.lead_nurture_stop_reason(uuid) from public, anon, authenticated;
grant execute on function public.lead_nurture_stop_reason(uuid) to service_role;
