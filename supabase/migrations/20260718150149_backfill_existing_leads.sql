-- Bring existing website leads into the unified person-level CRM without
-- sending email or enrolling anyone in a sequence.

insert into public.prospects (
  full_name,
  email,
  phone,
  source,
  status,
  last_inbound_at,
  metadata
)
select distinct on (l.email_normalized)
  l.name,
  l.email_normalized,
  l.phone,
  'inbound',
  case
    when coalesce(l.unsubscribed, false) then 'suppressed'
    when exists (select 1 from public.stripe_events s where s.lead_id = l.id) then 'converted'
    else 'new'
  end,
  l.created_at,
  jsonb_build_object('first_lead_source', l.lead_source, 'backfilled', true)
from public.leads l
where l.email_normalized is not null
  and not exists (
    select 1 from public.prospects p where p.email_normalized = l.email_normalized
  )
order by l.email_normalized, l.created_at desc;

update public.leads l
set prospect_id = p.id
from public.prospects p
where l.prospect_id is null
  and p.email_normalized = l.email_normalized;

insert into public.suppression_list(email, reason, source)
select distinct l.email_normalized, 'unsubscribe', 'legacy_leads'
from public.leads l
where coalesce(l.unsubscribed, false)
  and l.email_normalized is not null
on conflict (email_normalized) do nothing;

insert into public.tasks(prospect_id, title, description, priority, due_at, source)
select
  l.prospect_id,
  'Review existing inbound lead: ' || l.name,
  'Imported from the existing Teamtastic lead funnel. Source: ' || coalesce(l.lead_source, 'website') || '.',
  'normal',
  now(),
  'inbound_lead:' || l.id::text
from public.leads l
where l.prospect_id is not null
  and lower(coalesce(l.status, 'new')) = 'new'
  and not exists (
    select 1 from public.tasks t where t.source = 'inbound_lead:' || l.id::text
  );
