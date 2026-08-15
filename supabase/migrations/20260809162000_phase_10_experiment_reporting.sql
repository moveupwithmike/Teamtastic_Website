-- Phase 10: defensible experiment reporting and permanent decision history.
alter table public.growth_experiments
  add column control_sample_size integer not null default 0 check (control_sample_size >= 0),
  add column control_successes integer not null default 0 check (control_successes >= 0),
  add column control_rate numeric(9,6),
  add column variant_sample_size integer not null default 0 check (variant_sample_size >= 0),
  add column variant_successes integer not null default 0 check (variant_successes >= 0),
  add column variant_rate numeric(9,6),
  add column absolute_lift numeric(9,6),
  add column relative_lift numeric(12,6),
  add column evidence_score numeric(7,6) not null default 0 check (evidence_score between 0 and 1),
  add column evidence_threshold numeric(7,6) not null default 0.90 check (evidence_threshold between 0.80 and 0.999999),
  add column minimum_sample_per_variant integer not null default 25 check (minimum_sample_per_variant between 5 and 5000),
  add column recommendation text not null default 'collect_data' check (recommendation in ('collect_data','continue','stop','adopt')),
  add column final_decision text check (final_decision is null or final_decision in ('continue','stop','adopt','inconclusive')),
  add column decision_by text,
  add column decision_at timestamptz,
  add column next_experiment_id uuid references public.growth_experiments(id) on delete set null;

update public.growth_experiments
set minimum_sample_per_variant = greatest(5, least(5000, ceil(minimum_sample_size::numeric / 2)::integer));

create table public.growth_experiment_history (
  id bigint generated always as identity primary key,
  experiment_id uuid not null references public.growth_experiments(id) on delete restrict,
  event_type text not null check (event_type in ('approved','rejected','started','metrics_refreshed','ready_review','decision_recorded','next_recommended')),
  from_status text,
  to_status text,
  snapshot jsonb not null default '{}'::jsonb,
  actor text,
  note text,
  created_at timestamptz not null default now()
);
create index growth_experiment_history_experiment_created_idx on public.growth_experiment_history(experiment_id,created_at desc);
alter table public.growth_experiment_history enable row level security;
revoke all on table public.growth_experiment_history from public,anon,authenticated;
revoke all on sequence public.growth_experiment_history_id_seq from public,anon,authenticated;
grant select,insert on table public.growth_experiment_history to service_role;
grant usage,select on sequence public.growth_experiment_history_id_seq to service_role;

create or replace function automation.prevent_experiment_history_mutation()
returns trigger language plpgsql security invoker set search_path=''
as $$begin raise exception 'Experiment history is append-only'; end;$$;
create trigger growth_experiment_history_immutable before update or delete on public.growth_experiment_history
for each row execute function automation.prevent_experiment_history_mutation();
revoke all on function automation.prevent_experiment_history_mutation() from public,anon,authenticated;

create or replace function automation.experiment_arm(p_properties jsonb,p_utm_content text,p_experiment_id uuid)
returns text language sql immutable security invoker set search_path=''
as $$
  select case
    when p_properties->>'experiment_id'=p_experiment_id::text and lower(p_properties->>'experiment_variant') in ('control','variant')
      then lower(p_properties->>'experiment_variant')
    when lower(coalesce(p_utm_content,'')) in ('experiment:'||p_experiment_id::text||':control',p_experiment_id::text||':control') then 'control'
    when lower(coalesce(p_utm_content,'')) in ('experiment:'||p_experiment_id::text||':variant',p_experiment_id::text||':variant') then 'variant'
    else null end;
$$;
revoke all on function automation.experiment_arm(jsonb,text,uuid) from public,anon,authenticated;

create or replace function public.evaluate_growth_experiment(p_experiment_id uuid)
returns jsonb language plpgsql security invoker set search_path=''
as $$
declare
  e public.growth_experiments%rowtype; cn integer:=0; cs integer:=0; vn integer:=0; vs integer:=0;
  cr numeric; vr numeric; pooled numeric; se numeric; z numeric; evidence numeric:=0; rec text:='collect_data'; new_status text; old_rec text; result jsonb;
begin
  select * into e from public.growth_experiments where id=p_experiment_id for update;
  if e.id is null then raise exception 'Experiment not found'; end if;
  if e.status not in ('running','ready_review') then
    return jsonb_build_object('experiment_id',e.id,'status',e.status,'recommendation',e.recommendation,'refreshed',false);
  end if;

  if e.primary_metric='visitor_to_lead_rate' then
    with tagged as (
      select session_id,submission_id,event_name,automation.experiment_arm(properties,utm_content,e.id) arm
      from public.funnel_events
      where landing_page=e.target_page and occurred_at>=e.started_at
        and coalesce(utm_source,'direct')=e.utm_source and coalesce(utm_campaign,'unattributed')=e.utm_campaign
    )
    select count(distinct session_id) filter(where arm='control'),count(distinct submission_id) filter(where arm='control' and event_name='lead_captured'),
           count(distinct session_id) filter(where arm='variant'),count(distinct submission_id) filter(where arm='variant' and event_name='lead_captured')
    into cn,cs,vn,vs from tagged;
  else
    with tagged as (
      select l.id,automation.experiment_arm(coalesce(l.context,'{}'::jsonb),l.utm_content,e.id) arm,
        bool_or(case when e.primary_metric='qualified_lead_rate'
          then coalesce(l.lead_score,0)>=60 or (d.stage is not null and d.stage<>'new_lead')
          else d.outcome='won' or d.stage in ('deposit_paid','event_scheduled','completed','rebooking') end) success
      from public.leads l left join public.deals d on d.prospect_id=l.prospect_id
      where coalesce(nullif(l.landing_page,''),'Direct / unknown')=e.target_page and l.created_at>=e.started_at
        and coalesce(nullif(l.utm_source,''),'direct')=e.utm_source and coalesce(nullif(l.utm_campaign,''),'unattributed')=e.utm_campaign
      group by l.id,l.context,l.utm_content
    )
    select count(*) filter(where arm='control'),count(*) filter(where arm='control' and success),
           count(*) filter(where arm='variant'),count(*) filter(where arm='variant' and success)
    into cn,cs,vn,vs from tagged;
  end if;

  cr:=cs::numeric/nullif(cn,0); vr:=vs::numeric/nullif(vn,0);
  if cn>0 and vn>0 then
    pooled:=(cs+vs)::numeric/(cn+vn);
    se:=sqrt(greatest(0,pooled*(1-pooled)*(1::numeric/cn+1::numeric/vn)));
    if se>0 then
      z:=abs(vr-cr)/se;
      evidence:=least(0.999999,greatest(0,1-exp(-0.717*z-0.416*z*z)));
    elsif cr<>vr then evidence:=0.999999; end if;
  end if;

  if cn<e.minimum_sample_per_variant or vn<e.minimum_sample_per_variant then rec:='collect_data';
  elsif evidence<e.evidence_threshold then rec:='continue';
  elsif vr>cr then rec:='adopt';
  else rec:='stop'; end if;
  new_status:=case when e.status='running' and now()>=e.review_due_at and cn>=e.minimum_sample_per_variant and vn>=e.minimum_sample_per_variant then 'ready_review' else e.status end;
  old_rec:=e.recommendation;

  update public.growth_experiments set control_sample_size=cn,control_successes=cs,control_rate=cr,
    variant_sample_size=vn,variant_successes=vs,variant_rate=vr,absolute_lift=vr-cr,
    relative_lift=case when cr>0 then (vr-cr)/cr else null end,evidence_score=evidence,
    latest_sample_size=cn+vn,latest_value=vr,recommendation=rec,status=new_status
  where id=e.id;
  result:=jsonb_build_object('experiment_id',e.id,'status',new_status,'control',jsonb_build_object('sample',cn,'successes',cs,'rate',cr),
    'variant',jsonb_build_object('sample',vn,'successes',vs,'rate',vr),'absolute_lift',vr-cr,'relative_lift',case when cr>0 then (vr-cr)/cr else null end,
    'evidence_score',evidence,'evidence_threshold',e.evidence_threshold,'recommendation',rec);
  if new_status<>e.status or rec<>old_rec then
    insert into public.growth_experiment_history(experiment_id,event_type,from_status,to_status,snapshot,note)
    values(e.id,case when new_status='ready_review' and e.status<>'ready_review' then 'ready_review' else 'metrics_refreshed' end,e.status,new_status,result,'Automated evidence evaluation');
  end if;
  return result;
end;$$;
revoke all on function public.evaluate_growth_experiment(uuid) from public,anon,authenticated;
grant execute on function public.evaluate_growth_experiment(uuid) to service_role;

create or replace function automation.refresh_growth_experiment_metrics()
returns jsonb language plpgsql security invoker set search_path=''
as $$
declare experiment_id uuid; refreshed integer:=0;
begin
  for experiment_id in select id from public.growth_experiments where status in ('running','ready_review') loop
    perform public.evaluate_growth_experiment(experiment_id); refreshed:=refreshed+1;
  end loop;
  return jsonb_build_object('refreshed',refreshed,'automatic_campaign_changes',false);
end;$$;
revoke all on function automation.refresh_growth_experiment_metrics() from public,anon,authenticated;

create or replace function public.record_growth_experiment_transition(p_experiment_id uuid,p_decision text,p_actor text,p_owner_action text default null,p_notes text default null)
returns jsonb language plpgsql security invoker set search_path=''
as $$
declare e public.growth_experiments%rowtype; next_status text; event_name text;
begin
  select * into e from public.growth_experiments where id=p_experiment_id for update;
  if e.id is null then raise exception 'Experiment not found'; end if;
  if p_decision='approve' and e.status='proposed' then next_status:='approved';event_name:='approved';
  elsif p_decision='start' and e.status='approved' then next_status:='running';event_name:='started';
  elsif p_decision='reject' and e.status in ('proposed','approved') then next_status:='rejected';event_name:='rejected';
  else raise exception 'Invalid experiment transition'; end if;
  update public.growth_experiments set status=next_status,
    approved_at=case when p_decision='approve' then now() else approved_at end,
    approved_by=case when p_decision='approve' then p_actor else approved_by end,
    owner_action=case when p_decision='approve' then nullif(trim(p_owner_action),'') else owner_action end,
    started_at=case when p_decision='start' then now() else started_at end,
    review_due_at=case when p_decision='start' then now()+interval '14 days' else review_due_at end,
    result_notes=case when p_decision='reject' then coalesce(nullif(trim(p_notes),''),'Rejected in Office') else result_notes end
  where id=e.id;
  insert into public.growth_experiment_history(experiment_id,event_type,from_status,to_status,actor,note,snapshot)
  values(e.id,event_name,e.status,next_status,p_actor,p_notes,jsonb_build_object('owner_action',p_owner_action));
  return jsonb_build_object('experiment_id',e.id,'status',next_status);
end;$$;
revoke all on function public.record_growth_experiment_transition(uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.record_growth_experiment_transition(uuid,text,text,text,text) to service_role;

create or replace function public.complete_growth_experiment(p_experiment_id uuid,p_decision text,p_notes text,p_actor text)
returns jsonb language plpgsql security invoker set search_path=''
as $$
declare e public.growth_experiments%rowtype; evaluation jsonb; next_id uuid; mapped_outcome text; brief_id uuid;
begin
  if p_decision not in ('continue','stop','adopt','inconclusive') then raise exception 'Invalid final decision'; end if;
  evaluation:=public.evaluate_growth_experiment(p_experiment_id);
  select * into e from public.growth_experiments where id=p_experiment_id for update;
  if e.status not in ('running','ready_review') then raise exception 'Experiment is not active'; end if;
  if p_decision='adopt' and (e.status<>'ready_review' or e.recommendation<>'adopt' or e.evidence_score<e.evidence_threshold
      or e.control_sample_size<e.minimum_sample_per_variant or e.variant_sample_size<e.minimum_sample_per_variant) then
    raise exception 'Premature winner blocked: minimum sample and evidence thresholds are not met';
  end if;
  if p_decision='continue' then
    update public.growth_experiments set status='running',final_decision='continue',decision_by=p_actor,decision_at=now(),
      review_due_at=greatest(now(),coalesce(review_due_at,now()))+interval '7 days',result_notes=nullif(trim(p_notes),'') where id=e.id;
    insert into public.growth_experiment_history(experiment_id,event_type,from_status,to_status,actor,note,snapshot)
    values(e.id,'decision_recorded',e.status,'running',p_actor,p_notes,evaluation||jsonb_build_object('decision','continue'));
    return jsonb_build_object('experiment_id',e.id,'status','running','decision','continue','recommendation',e.recommendation);
  end if;
  mapped_outcome:=case when p_decision='adopt' then 'won' when p_decision='stop' then 'lost' else 'inconclusive' end;
  update public.growth_experiments set status='completed',completed_at=now(),outcome=mapped_outcome,final_decision=p_decision,
    decision_by=p_actor,decision_at=now(),result_notes=nullif(trim(p_notes),'') where id=e.id;
  insert into public.growth_experiment_history(experiment_id,event_type,from_status,to_status,actor,note,snapshot)
  values(e.id,'decision_recorded',e.status,'completed',p_actor,p_notes,evaluation||jsonb_build_object('decision',p_decision));

  select id into brief_id from public.growth_briefs order by brief_date desc limit 1;
  if brief_id is not null then
    update public.growth_briefs set recommendations=coalesce(recommendations,'[]'::jsonb)||jsonb_build_array(jsonb_build_object(
      'type','experiment_result','experiment_id',e.id,'action','Experiment decision: '||p_decision||' — '||e.title,
      'segment',e.target_page||' · '||e.utm_source||' / '||e.utm_campaign,'evidence',evaluation,'recorded_at',now())) where id=brief_id;
  end if;

  insert into public.growth_experiments(title,hypothesis,target_page,utm_source,utm_campaign,primary_metric,baseline_value,
    baseline_sample_size,minimum_sample_size,minimum_sample_per_variant,source_brief_id,fingerprint,proposed_action)
  values('Next test after '||e.title,
    case when p_decision='adopt' then 'Extending the winning treatment to the next funnel step will preserve or improve conversion.'
      else 'A materially different treatment may improve the same primary metric without repeating the completed test.' end,
    e.target_page,e.utm_source,e.utm_campaign,e.primary_metric,coalesce(e.variant_rate,e.control_rate,e.baseline_value),e.control_sample_size+e.variant_sample_size,
    e.minimum_sample_size,e.minimum_sample_per_variant,brief_id,
    encode(extensions.digest(concat_ws('|','next-growth-experiment',e.id,p_decision),'sha256'),'hex'),
    case when p_decision='adopt' then 'Define one controlled follow-up at the next funnel step, then approve it.' else 'Define one substantially different controlled variant, then approve it.' end)
  on conflict(fingerprint) do update set updated_at=now() returning id into next_id;
  update public.growth_experiments set next_experiment_id=next_id where id=e.id;
  insert into public.growth_experiment_history(experiment_id,event_type,from_status,to_status,actor,note,snapshot)
  values(e.id,'next_recommended','completed','completed',p_actor,'Generated the next evidence-led experiment',jsonb_build_object('next_experiment_id',next_id));
  return jsonb_build_object('experiment_id',e.id,'status','completed','decision',p_decision,'next_experiment_id',next_id,'growth_brief_updated',brief_id is not null);
end;$$;
revoke all on function public.complete_growth_experiment(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.complete_growth_experiment(uuid,text,text,text) to service_role;
