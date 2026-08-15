-- Add family/friends demand discovery and audience-aware event lead scoring.

update public.organic_sources
set config = jsonb_build_object(
  'query_sets', jsonb_build_object(
    'corporate', jsonb_build_array(
      '"virtual team building" recommendation',
      '"corporate holiday party" recommendation',
      '"remote team event" ideas',
      '"year end team celebration" virtual',
      '"large group" virtual holiday event'
    ),
    'family', jsonb_build_array(
      '"virtual family reunion"',
      '"long distance family game night"',
      '"college reunion" "virtual game"',
      '"virtual birthday party" family game',
      '"family reunion" online games'
    )
  ),
  'queries', jsonb_build_array(
    '"virtual team building" recommendation',
    '"corporate holiday party" recommendation',
    '"remote team event" ideas',
    '"year end team celebration" virtual',
    '"large group" virtual holiday event',
    '"virtual family reunion"',
    '"long distance family game night"',
    '"college reunion" "virtual game"',
    '"virtual birthday party" family game',
    '"family reunion" online games'
  ),
  'excluded_terms', jsonb_build_array('school assignment','classroom students','nsfw'),
  'blocked_communities', '[]'::jsonb,
  'minimum_capture_score', 45,
  'maximum_post_age_days', 30
), updated_at=now()
where source_key='reddit-approved-api';

create or replace function public.score_event_lead(p_lead_id uuid)
returns jsonb language plpgsql security invoker set search_path=''
as $$
declare l public.leads%rowtype; v_score integer:=0; v_final integer; v_reasons jsonb:='[]'::jsonb;
  v_days integer; v_engagement integer:=0; v_deposit boolean:=false; v_points integer;
  v_family boolean:=false; v_audience text; v_version constant text:='event-v3-audience';
begin
  select * into l from public.leads where id=p_lead_id for update;
  if l.id is null then return jsonb_build_object('scored',false,'reason','lead_not_found'); end if;
  if coalesce((l.context->>'synthetic_test')::boolean,false) then return jsonb_build_object('scored',false,'reason','synthetic_lead'); end if;

  v_family:=l.lead_source='michael_family_concierge'
    or coalesce(l.context->>'audience','')~*'family|friends|reunion'
    or coalesce(l.context->>'entry_point','')~*'family'
    or coalesce(l.landing_page,'')~*'virtual-family-game-night';
  v_audience:=case when v_family then 'family' else 'corporate' end;

  if l.preferred_event_date is not null then
    v_days:=l.preferred_event_date-current_date;
    v_points:=case when v_days<0 then 0 when v_days<=14 then 20 when v_days<=30 then 18 when v_days<=60 then 14 when v_days<=120 then 8 else 3 end;
    v_score:=v_score+v_points; v_reasons:=v_reasons||jsonb_build_array(jsonb_build_object('component','event_urgency','points',v_points,'detail',case when v_days<0 then 'Requested date has passed' else v_days||' days until requested event' end,'audience',v_audience));
  else v_reasons:=v_reasons||jsonb_build_array(jsonb_build_object('component','event_urgency','points',0,'detail','Event date missing','audience',v_audience)); end if;

  if v_family then
    v_points:=case when coalesce(l.team_size,'')~*'^50\+|50-plus' then 18 when coalesce(l.team_size,'')~*'25-50' then 14 when coalesce(l.team_size,'')~*'10-25' then 9 when coalesce(l.team_size,'')~*'under-10' then 5 when l.team_size is not null then 4 else 0 end;
  else
    v_points:=case when coalesce(l.team_size,'')~*'150\+|150-300|300\+' then 18 when coalesce(l.team_size,'')~*'50-150|75-|81-|200' then 14 when coalesce(l.team_size,'')~*'15-50|25-74|31-80' then 9 when l.team_size is not null then 4 else 0 end;
  end if;
  v_score:=v_score+v_points; v_reasons:=v_reasons||jsonb_build_array(jsonb_build_object('component','team_size','points',v_points,'detail',coalesce(l.team_size,'Group size missing'),'audience',v_audience));

  if v_family then
    v_points:=case when coalesce(l.budget_range,'')~*'2500|2,500|5000|5,000' then 18 when coalesce(l.budget_range,'')~*'1000-2500|1,000.*2,500' then 16 when coalesce(l.budget_range,'')~*'under-1000|500-1000|500.*1,000' then 12 when coalesce(l.budget_range,'')~*'not-sure' then 4 when l.budget_range is not null then 8 else 0 end;
  else
    v_points:=case when coalesce(l.budget_range,'')~*'5000|5,000' then 18 when coalesce(l.budget_range,'')~*'2500-5000|2,500.*5,000|2000.*5000' then 14 when coalesce(l.budget_range,'')~*'1000-2500|1,000.*2,500' then 9 when coalesce(l.budget_range,'')~*'under-1000' then 3 when l.budget_range is not null then 5 else 0 end;
  end if;
  v_score:=v_score+v_points; v_reasons:=v_reasons||jsonb_build_array(jsonb_build_object('component','budget_package_fit','points',v_points,'detail',concat_ws(' · ',l.budget_range,l.package_interest),'audience',v_audience));

  v_points:=case l.decision_timeline when 'this-week' then 15 when '1-2-weeks' then 12 when 'this-month' then 8 when 'researching' then 3 else 0 end;
  v_score:=v_score+v_points; v_reasons:=v_reasons||jsonb_build_array(jsonb_build_object('component','decision_timeline','points',v_points,'detail',coalesce(l.decision_timeline,'Decision timing missing'),'audience',v_audience));

  v_points:=case when v_family and coalesce(l.team_size,'')~*'^50\+|50-plus' then 10 when not v_family and (l.lead_source='large_holiday_event_page' or l.package_interest='large-event-production' or coalesce(l.team_size,'')~*'150\+|150-300|300\+') then 10 else 0 end;
  v_score:=v_score+v_points; v_reasons:=v_reasons||jsonb_build_array(jsonb_build_object('component','large_event_complexity','points',v_points,'detail',case when v_points>0 and v_family then 'Large family or reunion production signal' when v_points>0 then 'Large-group corporate production signal' else 'Standard event complexity' end,'audience',v_audience));

  select count(distinct event_name) into v_engagement from public.funnel_events where submission_id=l.submission_id;
  v_points:=least(10,v_engagement*2); v_score:=v_score+v_points;
  v_reasons:=v_reasons||jsonb_build_array(jsonb_build_object('component','funnel_engagement','points',v_points,'detail',v_engagement||' distinct first-party actions','audience',v_audience));

  select exists(select 1 from public.stripe_events s where (s.lead_id=l.id or s.submission_id=l.submission_id) and s.payment_status='paid') into v_deposit;
  v_points:=case when v_deposit then 25 else 0 end; v_score:=least(100,v_score+v_points);
  v_reasons:=v_reasons||jsonb_build_array(jsonb_build_object('component','deposit_activity','points',v_points,'detail',case when v_deposit then 'Payment or deposit received' else 'No paid deposit yet' end,'audience',v_audience));

  v_final:=coalesce(l.lead_score_override,v_score);
  if l.lead_score is distinct from v_final or l.lead_score_reasons is distinct from v_reasons or l.lead_score_version is distinct from v_version then
    update public.leads set lead_score=v_final,lead_score_reasons=v_reasons,lead_score_version=v_version,lead_scored_at=now() where id=l.id;
    insert into public.lead_score_history(lead_id,calculated_score,final_score,reasons,scoring_version,override_applied) values(l.id,v_score,v_final,v_reasons,v_version,l.lead_score_override is not null);
  end if;
  return jsonb_build_object('scored',true,'lead_id',l.id,'audience',v_audience,'calculated_score',v_score,'final_score',v_final,'override_applied',l.lead_score_override is not null,'reasons',v_reasons,'scoring_version',v_version);
end $$;

revoke execute on function public.score_event_lead(uuid) from public,anon,authenticated;
grant execute on function public.score_event_lead(uuid) to service_role;

select public.refresh_event_lead_scores(730);
