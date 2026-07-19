alter table public.system_config
  add column if not exists phase3_apollo_enrichment_daily_cap integer not null default 5
    check (phase3_apollo_enrichment_daily_cap between 0 and 25);

alter table public.enrichment_requests
  add column if not exists apollo_candidate_id uuid references public.apollo_candidates(id) on delete cascade;

alter table public.enrichment_requests
  drop constraint if exists enrichment_requests_check;
alter table public.enrichment_requests
  add constraint enrichment_requests_target_check check (
    company_id is not null or prospect_id is not null or apollo_candidate_id is not null
  );

create unique index enrichment_requests_candidate_active_key
  on public.enrichment_requests(apollo_candidate_id, provider, request_kind)
  where apollo_candidate_id is not null and status in ('pending','processing');

create or replace function automation.queue_selected_apollo_candidates()
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  daily_cap integer;
  already_queued integer;
  queued_count integer;
begin
  select phase3_apollo_enrichment_daily_cap into daily_cap
  from public.system_config where id=true;

  select count(*) into already_queued
  from public.enrichment_requests
  where provider='apollo'
    and request_kind='person_enrichment'
    and created_at >= date_trunc('day', now());

  with eligible as (
    select c.id
    from public.apollo_candidates c
    where c.status='selected'
      and not exists (
        select 1 from public.enrichment_requests r
        where r.apollo_candidate_id=c.id
          and r.provider='apollo'
          and r.request_kind='person_enrichment'
          and r.status in ('pending','processing','completed')
      )
    order by c.discovered_at
    limit greatest(0, daily_cap - already_queued)
  ), inserted as (
    insert into public.enrichment_requests(apollo_candidate_id,provider,status,request_kind,request_payload)
    select id,'apollo','pending','person_enrichment',jsonb_build_object('reveal_personal_emails',false,'reveal_phone_number',false)
    from eligible
    returning apollo_candidate_id
  )
  update public.apollo_candidates c
  set status='enrichment_queued', reviewed_at=coalesce(reviewed_at,now())
  from inserted i where c.id=i.apollo_candidate_id;

  get diagnostics queued_count = row_count;
  return queued_count;
end;
$$;

revoke all on function automation.queue_selected_apollo_candidates() from public, anon, authenticated;
grant execute on function automation.queue_selected_apollo_candidates() to service_role;
