-- Pre-existing gap in the Phase 3 scaffolding, found while activating it for Milestone 3:
-- automation.queue_selected_apollo_candidates() only ever looked at apollo_candidates with
-- status='selected', but nothing in the codebase ever set that status on a freshly
-- discovered candidate (it was only ever set as a side effect deep inside enrichment
-- itself). The result: the enrichment queue could never receive new candidates, so
-- discovery ran forever without ever feeding enrichment.
--
-- Fix: queue directly from status='discovered'. Apollo's discovery search already filters
-- by title/seniority/company size, so no extra manual "selection" step is needed — every
-- discovered candidate is already a reasonable target.

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
    where c.status='discovered'
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

-- Queue freshly discovered candidates right before each enrichment run picks up the queue,
-- so the two stages stay connected without touching the edge function code.
do $$
declare
  job_id bigint;
begin
  if exists (select 1 from cron.job where jobname = 'phase3-apollo-enrichment') then
    perform cron.unschedule('phase3-apollo-enrichment');
  end if;
  perform cron.schedule(
    'phase3-apollo-enrichment',
    '15 12 * * 1-5',
    'select automation.queue_selected_apollo_candidates(); select automation.trigger_phase3_apollo_enrichment();'
  );
  select jobid into job_id from cron.job where jobname = 'phase3-apollo-enrichment';
  perform cron.alter_job(job_id := job_id, active := true);
end $$;
