alter table public.system_config
  add column if not exists outbound_mode text not null default 'off'
  check (outbound_mode in ('off','review','autonomous'));

-- Schedules may run in every mode; the functions remain fail-closed behind
-- system_config feature flags and outbound_mode. This removes manual invocation
-- as a hidden pipeline dependency without enabling sending by migration alone.
do $$
declare
  job_name text;
  job_id bigint;
begin
  foreach job_name in array array[
    'phase3-apollo-discovery',
    'phase3-apollo-enrichment',
    'phase3-signal-collector',
    'phase3-score-and-draft',
    'draft-sequence-followups',
    'send-approved-outreach',
    'gmail-reply-ingestion'
  ]
  loop
    select jobid into job_id from cron.job where jobname=job_name;
    if job_id is not null then
      perform cron.alter_job(job_id:=job_id,active:=true);
    end if;
    job_id:=null;
  end loop;
end $$;

create or replace function automation.outbound_pipeline_readiness()
returns jsonb
language sql
security invoker
set search_path=''
as $$
  select jsonb_build_object(
    'master_enabled',c.master_enabled,
    'outbound_mode',c.outbound_mode,
    'prospecting_enabled',c.prospecting_enabled,
    'outbound_auto_paused',c.outbound_auto_paused,
    'discovery_enabled',c.phase3_apollo_discovery_enabled,
    'enrichment_enabled',c.phase3_enrichment_enabled,
    'signal_research_enabled',c.phase3_research_enabled,
    'scoring_enabled',c.phase3_scoring_enabled,
    'drafting_enabled',c.phase3_drafting_enabled,
    'sequence_followups_enabled',c.sequence_followups_enabled,
    'resend_webhook_last_seen_at',(select max(processed_at) from public.resend_webhook_events),
    'cron_jobs',(
      select coalesce(jsonb_object_agg(j.jobname,j.active),'{}'::jsonb)
      from cron.job j
      where j.jobname in (
        'phase3-apollo-discovery','phase3-apollo-enrichment','phase3-signal-collector',
        'phase3-score-and-draft',
        'draft-sequence-followups','send-approved-outreach','gmail-reply-ingestion'
      )
    ),
    'ready_to_send',
      c.master_enabled
      and c.prospecting_enabled
      and c.phase3_apollo_discovery_enabled
      and c.phase3_enrichment_enabled
      and c.phase3_research_enabled
      and c.phase3_scoring_enabled
      and c.phase3_drafting_enabled
      and c.sequence_followups_enabled
      and c.outbound_mode in ('review','autonomous')
      and not c.outbound_auto_paused
      and (
        select count(*)=7 and bool_and(j.active)
        from cron.job j
        where j.jobname in (
          'phase3-apollo-discovery','phase3-apollo-enrichment','phase3-signal-collector',
          'phase3-score-and-draft','draft-sequence-followups',
          'send-approved-outreach','gmail-reply-ingestion'
        )
      )
      and (select max(processed_at) > now()-interval '24 hours' from public.resend_webhook_events)
  )
  from public.system_config c
  where c.id=true
$$;

revoke all on function automation.outbound_pipeline_readiness() from public,anon,authenticated;
grant execute on function automation.outbound_pipeline_readiness() to service_role;
