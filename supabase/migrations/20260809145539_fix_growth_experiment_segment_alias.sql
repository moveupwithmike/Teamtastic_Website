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
      case when (segment.value->>'qualified_leads')::int=0 then 'Improve lead quality on ' else 'Improve sales handoff from ' end || segment.value->>'landing_page',
      case when (segment.value->>'qualified_leads')::int=0
        then 'A clearer audience promise or qualification cue will increase the qualified-lead rate.'
        else 'A clearer next step and faster handoff will increase lead-to-conversion rate.' end,
      segment.value->>'landing_page',segment.value->>'utm_source',segment.value->>'utm_campaign',
      case when (segment.value->>'qualified_leads')::int=0 then 'qualified_lead_rate' else 'lead_to_conversion_rate' end,
      case when (segment.value->>'qualified_leads')::int=0 then (segment.value->>'qualification_rate')::numeric else (segment.value->>'conversion_rate')::numeric end,
      (segment.value->>'leads')::int,greatest(20,(segment.value->>'leads')::int*2),latest_brief.id,
      encode(extensions.digest(concat_ws('|','growth-experiment',date_trunc('quarter',current_date)::date,segment.value->>'landing_page',segment.value->>'utm_source',segment.value->>'utm_campaign',case when (segment.value->>'qualified_leads')::int=0 then 'qualified' else 'conversion' end),'sha256'),'hex'),
      case when (segment.value->>'qualified_leads')::int=0 then 'Review the page promise, targeting, and qualification cues; approve one controlled change.' else 'Review the CTA-to-sales handoff; approve one controlled change to the next step.' end
    from jsonb_array_elements(latest_brief.segments) as segment(value)
    where (segment.value->>'leads')::int>=3 and ((segment.value->>'qualified_leads')::int=0 or ((segment.value->>'qualified_leads')::int>0 and (segment.value->>'conversions')::int=0))
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
