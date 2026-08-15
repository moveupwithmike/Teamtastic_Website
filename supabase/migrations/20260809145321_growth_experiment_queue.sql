-- Review-first growth experimentation. Proposes and measures; never edits campaigns.
create table public.growth_experiments (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  hypothesis text not null,
  target_page text not null,
  utm_source text not null default 'direct',
  utm_campaign text not null default 'unattributed',
  primary_metric text not null check(primary_metric in ('visitor_to_lead_rate','qualified_lead_rate','lead_to_conversion_rate')),
  baseline_value numeric(9,6),
  baseline_sample_size integer not null default 0 check(baseline_sample_size>=0),
  latest_value numeric(9,6),
  latest_sample_size integer not null default 0 check(latest_sample_size>=0),
  minimum_sample_size integer not null default 50 check(minimum_sample_size between 10 and 10000),
  status text not null default 'proposed' check(status in ('proposed','approved','running','ready_review','completed','rejected','paused')),
  source_brief_id uuid references public.growth_briefs(id) on delete set null,
  fingerprint text not null unique,
  proposed_action text not null,
  owner_action text,
  result_notes text,
  outcome text check(outcome is null or outcome in ('won','lost','inconclusive')),
  proposed_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by text,
  started_at timestamptz,
  review_due_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);
create index growth_experiments_status_due_idx on public.growth_experiments(status,review_due_at);
alter table public.growth_experiments enable row level security;
revoke all on table public.growth_experiments from public,anon,authenticated;
grant select,insert,update,delete on table public.growth_experiments to service_role;
create trigger growth_experiments_touch_updated_at before update on public.growth_experiments
for each row execute function automation.touch_updated_at();

create or replace function automation.prepare_growth_experiment_queue()
returns jsonb language plpgsql security invoker set search_path=''
as $$
declare latest_brief public.growth_briefs%rowtype; inserted_count integer:=0; funnel_count integer:=0;
begin
  select * into latest_brief from public.growth_briefs order by brief_date desc limit 1;
  if latest_brief.id is not null then
    insert into public.growth_experiments(title,hypothesis,target_page,utm_source,utm_campaign,primary_metric,
      baseline_value,baseline_sample_size,minimum_sample_size,source_brief_id,fingerprint,proposed_action)
    select
      case when (s->>'qualified_leads')::int=0 then 'Improve lead quality on ' else 'Improve sales handoff from ' end || s->>'landing_page',
      case when (s->>'qualified_leads')::int=0
        then 'A clearer audience promise or qualification cue will increase the qualified-lead rate.'
        else 'A clearer next step and faster handoff will increase lead-to-conversion rate.' end,
      s->>'landing_page',s->>'utm_source',s->>'utm_campaign',
      case when (s->>'qualified_leads')::int=0 then 'qualified_lead_rate' else 'lead_to_conversion_rate' end,
      case when (s->>'qualified_leads')::int=0 then (s->>'qualification_rate')::numeric else (s->>'conversion_rate')::numeric end,
      (s->>'leads')::int,greatest(20,(s->>'leads')::int*2),latest_brief.id,
      encode(extensions.digest(concat_ws('|','growth-experiment',date_trunc('quarter',current_date)::date,s->>'landing_page',s->>'utm_source',s->>'utm_campaign',case when (s->>'qualified_leads')::int=0 then 'qualified' else 'conversion' end),'sha256'),'hex'),
      case when (s->>'qualified_leads')::int=0 then 'Review the page promise, targeting, and qualification cues; approve one controlled change.' else 'Review the CTA-to-sales handoff; approve one controlled change to the next step.' end
    from jsonb_array_elements(latest_brief.segments) s
    where (s->>'leads')::int>=3 and ((s->>'qualified_leads')::int=0 or ((s->>'qualified_leads')::int>0 and (s->>'conversions')::int=0))
    on conflict(fingerprint) do nothing;
    get diagnostics inserted_count=row_count;
  end if;

  with paths as (
    select landing_page,coalesce(utm_source,'direct') utm_source,coalesce(utm_campaign,'unattributed') utm_campaign,
      count(distinct session_id)::int visitors,count(distinct submission_id) filter(where event_name='lead_captured')::int leads
    from public.funnel_events where occurred_at>=now()-interval '30 days'
    group by landing_page,coalesce(utm_source,'direct'),coalesce(utm_campaign,'unattributed')
  )
  insert into public.growth_experiments(title,hypothesis,target_page,utm_source,utm_campaign,primary_metric,
    baseline_value,baseline_sample_size,minimum_sample_size,source_brief_id,fingerprint,proposed_action)
  select 'Improve visitor-to-lead path on '||landing_page,
    'A more specific CTA or clearer value proposition will turn engaged traffic into qualified inquiries.',
    landing_page,utm_source,utm_campaign,'visitor_to_lead_rate',leads::numeric/nullif(visitors,0),visitors,
    greatest(50,visitors*2),latest_brief.id,
    encode(extensions.digest(concat_ws('|','growth-experiment',date_trunc('quarter',current_date)::date,landing_page,utm_source,utm_campaign,'visitor-to-lead'),'sha256'),'hex'),
    'Review the page CTA and value proposition; approve one controlled variant.'
  from paths where visitors>=25 and leads=0 on conflict(fingerprint) do nothing;
  get diagnostics funnel_count=row_count;
  return jsonb_build_object('prepared',true,'brief_proposals',inserted_count,'funnel_proposals',funnel_count,'automatic_changes',false);
end; $$;

create or replace function automation.refresh_growth_experiment_metrics()
returns jsonb language plpgsql security invoker set search_path=''
as $$
declare e public.growth_experiments%rowtype; sample_count integer; success_count integer; refreshed integer:=0;
begin
  for e in select * from public.growth_experiments where status='running' for update skip locked loop
    if e.primary_metric='visitor_to_lead_rate' then
      select count(distinct session_id),count(distinct submission_id) filter(where event_name='lead_captured')
      into sample_count,success_count from public.funnel_events where landing_page=e.target_page and occurred_at>=e.started_at
        and coalesce(utm_source,'direct')=e.utm_source and coalesce(utm_campaign,'unattributed')=e.utm_campaign;
    else
      select count(distinct l.id),count(distinct l.id) filter(where
        case when e.primary_metric='qualified_lead_rate' then coalesce(l.lead_score,0)>=60 or d.stage is not null and d.stage<>'new_lead'
        else d.outcome='won' or d.stage in ('deposit_paid','event_scheduled','completed','rebooking') end)
      into sample_count,success_count from public.leads l left join public.deals d on d.prospect_id=l.prospect_id
      where coalesce(nullif(l.landing_page,''),'Direct / unknown')=e.target_page and l.created_at>=e.started_at
        and coalesce(nullif(l.utm_source,''),'direct')=e.utm_source and coalesce(nullif(l.utm_campaign,''),'unattributed')=e.utm_campaign;
    end if;
    update public.growth_experiments set latest_sample_size=coalesce(sample_count,0),
      latest_value=success_count::numeric/nullif(sample_count,0),
      status=case when coalesce(sample_count,0)>=minimum_sample_size and now()>=review_due_at then 'ready_review' else status end
    where id=e.id;
    refreshed:=refreshed+1;
  end loop;
  return jsonb_build_object('refreshed',refreshed,'automatic_campaign_changes',false);
end; $$;

create or replace function public.prepare_growth_experiment_queue() returns jsonb language sql security invoker set search_path=''
as $$select automation.prepare_growth_experiment_queue();$$;
revoke all on function public.prepare_growth_experiment_queue() from public,anon,authenticated;
grant execute on function public.prepare_growth_experiment_queue() to service_role;
revoke all on function automation.prepare_growth_experiment_queue(),automation.refresh_growth_experiment_metrics() from public,anon,authenticated;

do $job$
declare job_id bigint;
begin
  select jobid into job_id from cron.job where jobname='prepare-growth-experiment-queue' limit 1;
  if job_id is not null then perform cron.unschedule(job_id); end if;
  perform cron.schedule('prepare-growth-experiment-queue','30 11 * * *','select automation.prepare_growth_experiment_queue(); select automation.refresh_growth_experiment_metrics();');
end $job$;
