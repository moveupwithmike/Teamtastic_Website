-- Complete Phase 4's operational gaps without enabling autonomous sending.

create table public.learning_recommendations (
  id uuid primary key default gen_random_uuid(),
  period_start date not null,
  period_end date not null,
  segment_key text not null,
  sample_size integer not null check (sample_size >= 0),
  sent_count integer not null check (sent_count >= 0),
  reply_count integer not null check (reply_count >= 0),
  interested_count integer not null check (interested_count >= 0),
  negative_count integer not null check (negative_count >= 0),
  reply_rate numeric(7,4),
  interested_rate numeric(7,4),
  recommendation text not null,
  evidence jsonb not null default '{}'::jsonb,
  status text not null default 'review' check (status in ('review', 'accepted', 'rejected', 'superseded')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by text,
  unique(period_start, period_end, segment_key)
);

alter table public.learning_recommendations enable row level security;
revoke all on table public.learning_recommendations from anon, authenticated;
grant select, insert, update, delete on table public.learning_recommendations to service_role;

create or replace function automation.handle_inbound_message()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  should_suppress boolean;
  escalation jsonb;
  should_escalate boolean;
  escalation_priority text;
  reasons text;
begin
  if new.direction <> 'inbound' or new.prospect_id is null then return new; end if;

  should_suppress := new.classification in ('unsubscribe', 'not_interested', 'complaint', 'legal');
  escalation := automation.evaluate_phase4_escalation(
    coalesce(new.subject, '') || E'\n' || coalesce(new.body_text, ''),
    coalesce(new.classification_confidence, 0),
    0
  );
  should_escalate := coalesce((escalation->>'escalate')::boolean, false)
    or new.classification in ('interested', 'question', 'referral', 'complaint', 'legal', 'unknown');
  select coalesce(string_agg(value->>'rule_key', ', '), new.classification, 'reply review')
    into reasons from jsonb_array_elements(coalesce(escalation->'reasons', '[]'::jsonb));
  select case when bool_or(value->>'priority' = 'urgent') then 'urgent' else 'high' end
    into escalation_priority from jsonb_array_elements(coalesce(escalation->'reasons', '[]'::jsonb));
  escalation_priority := coalesce(escalation_priority,
    case when new.classification in ('complaint', 'legal') then 'urgent'
         when new.classification = 'interested' then 'high' else 'normal' end);

  update public.prospects set
    last_inbound_at = coalesce(new.received_at, new.created_at),
    status = case when should_suppress then 'suppressed'
      when new.classification = 'interested' then 'interested' else 'replied' end,
    updated_at = now()
  where id = new.prospect_id;

  update public.sequence_enrollments set status='stopped_reply',
    stopped_reason=coalesce(new.classification, 'inbound_reply'), next_action_at=null, updated_at=now()
  where prospect_id=new.prospect_id and status in ('pending','active','paused');

  if should_suppress then
    insert into public.suppression_list(email, reason, source, provider_event_id)
    select p.email_normalized,
      case when new.classification='unsubscribe' then 'unsubscribe' else 'manual' end,
      'gmail_reply:' || coalesce(new.classification,'unknown'), new.provider_message_id
    from public.prospects p where p.id=new.prospect_id and p.email_normalized is not null
    on conflict (email_normalized) do nothing;
  end if;

  if should_escalate then
    insert into public.tasks(prospect_id,title,description,priority,due_at,source,fingerprint)
    values (new.prospect_id, 'Review reply: ' || coalesce(new.subject,'(no subject)'),
      'Escalation reasons: ' || coalesce(reasons,'reply review') || '. Classification: ' ||
      coalesce(new.classification,'unknown') || ' (' || coalesce(new.classification_confidence::text,'0') || ').',
      escalation_priority, case when escalation_priority='urgent' then now() else now()+interval '2 hours' end,
      'phase4_escalation', 'phase4:reply-escalation:' || new.id::text)
    on conflict (fingerprint) where fingerprint is not null do nothing;
  end if;

  insert into public.agent_log(agent_name,action,outcome,prospect_id,message_id,decision)
  values ('phase4-escalation','evaluate_inbound_reply',
    case when should_escalate then 'escalated' else 'completed' end,new.prospect_id,new.id,
    jsonb_build_object('classification',new.classification,'confidence',new.classification_confidence,
      'suppressed',should_suppress,'sequence_stopped',true,'engine_result',escalation));
  return new;
end;
$$;

create or replace function automation.evaluate_pipeline_draft()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  result jsonb;
  opportunity numeric := 0;
begin
  select case when coalesce(p.metadata->>'opportunity_value','') ~ '^\d+(\.\d+)?$'
    then (p.metadata->>'opportunity_value')::numeric else 0 end
  into opportunity from public.prospects p where p.id=new.prospect_id;
  result := automation.evaluate_phase4_escalation(new.subject || E'\n' || new.body_text, 1, opportunity);
  if coalesce((result->>'escalate')::boolean,false) then
    insert into public.tasks(prospect_id,title,description,priority,due_at,source,fingerprint)
    values (new.prospect_id,'Review escalated outreach draft',
      'The Phase 4 escalation engine flagged this pipeline draft: ' || (result->'reasons')::text,
      case when (result->'reasons')::text like '%"urgent"%' then 'urgent' else 'high' end,
      now(),'phase4_escalation','phase4:draft-escalation:' || new.id::text)
    on conflict (fingerprint) where fingerprint is not null do nothing;
    insert into public.agent_log(agent_name,action,outcome,prospect_id,decision)
    values ('phase4-escalation','evaluate_pipeline_draft','escalated',new.prospect_id,
      jsonb_build_object('draft_id',new.id,'engine_result',result,'send_enabled',false));
  end if;
  return new;
end;
$$;

drop trigger if exists outreach_drafts_phase4_escalation on public.outreach_drafts;
create trigger outreach_drafts_phase4_escalation after insert or update of subject,body_text
on public.outreach_drafts for each row execute function automation.evaluate_pipeline_draft();

create or replace function automation.prepare_phase4_learning_report()
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  config public.system_config%rowtype;
  created_count integer := 0;
begin
  select * into config from public.system_config where id=true;
  if config.id is null or not config.master_enabled then
    return jsonb_build_object('prepared',false,'reason','master_kill_switch');
  end if;
  if not config.phase4_learning_enabled then
    return jsonb_build_object('prepared',false,'reason','phase4_learning_disabled');
  end if;

  insert into public.learning_recommendations(
    period_start,period_end,segment_key,sample_size,sent_count,reply_count,interested_count,
    negative_count,reply_rate,interested_rate,recommendation,evidence
  )
  select current_date-interval '28 days',current_date,
    coalesce(d.prompt_version,'unknown'),count(distinct d.prospect_id),
    count(distinct d.prospect_id) filter (where d.status in ('approved','retired')),
    count(distinct m.prospect_id),
    count(distinct m.prospect_id) filter (where m.classification='interested'),
    count(distinct m.prospect_id) filter (where m.classification in ('not_interested','unsubscribe','complaint','legal')),
    round(count(distinct m.prospect_id)::numeric/nullif(count(distinct d.prospect_id) filter (where d.status in ('approved','retired')),0),4),
    round((count(distinct m.prospect_id) filter (where m.classification='interested'))::numeric/
      nullif(count(distinct d.prospect_id) filter (where d.status in ('approved','retired')),0),4),
    case when count(distinct d.prospect_id) filter (where d.status in ('approved','retired')) < 20
      then 'Keep collecting data; do not change scoring or copy yet.'
      when count(distinct m.prospect_id)::numeric/nullif(count(distinct d.prospect_id) filter (where d.status in ('approved','retired')),0) < 0.05
      then 'Review this template and segment for retirement; human approval is required.'
      else 'Retain this pattern and compare it with the next four-week period.' end,
    jsonb_build_object('mode','recommendation_only','automatic_weight_changes',false)
  from public.outreach_drafts d
  left join public.messages m on m.prospect_id=d.prospect_id and m.direction='inbound'
    and m.received_at >= current_date-interval '28 days'
  where d.created_at >= current_date-interval '28 days'
  group by coalesce(d.prompt_version,'unknown')
  on conflict (period_start,period_end,segment_key) do update set
    sample_size=excluded.sample_size,sent_count=excluded.sent_count,reply_count=excluded.reply_count,
    interested_count=excluded.interested_count,negative_count=excluded.negative_count,
    reply_rate=excluded.reply_rate,interested_rate=excluded.interested_rate,
    recommendation=excluded.recommendation,evidence=excluded.evidence;
  get diagnostics created_count=row_count;
  insert into public.agent_log(agent_name,action,outcome,decision)
  values ('phase4-learning','prepare_weekly_recommendations','completed',
    jsonb_build_object('recommendations_upserted',created_count,'automatic_changes',false));
  return jsonb_build_object('prepared',true,'recommendations_upserted',created_count,'automatic_changes',false);
end;
$$;

create or replace function public.backfill_phase4_paid_conversions(p_limit integer default 50)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  payment record;
  result jsonb;
  attempted integer := 0;
  converted integer := 0;
begin
  if p_limit < 1 or p_limit > 500 then raise exception 'p_limit must be between 1 and 500'; end if;
  for payment in
    select s.id,s.lifecycle_status
    from public.stripe_events s
    where s.product_key='hosted_event_deposit' and s.payment_status='paid'
      and s.lifecycle_status in ('pending','skipped','failed','needs_lead_match')
    order by s.paid_at asc for update skip locked limit p_limit
  loop
    attempted := attempted+1;
    if payment.lifecycle_status='needs_lead_match' then
      delete from public.client_conversions
      where stripe_event_id=payment.id and status='needs_lead_match' and client_id is null;
    end if;
    result := public.process_paid_conversion(payment.id);
    update public.stripe_events set
      lifecycle_status=case when (result->>'converted')::boolean then
        case when result->>'status'='needs_event_details' then 'needs_event_details' else 'converted' end
        when result->>'status'='needs_lead_match' then 'needs_lead_match' else 'skipped' end,
      lifecycle_attempts=lifecycle_attempts+1,
      lifecycle_error=case when (result->>'converted')::boolean then null else coalesce(result->>'reason',result->>'status') end,
      lifecycle_processed_at=now()
    where id=payment.id;
    if coalesce((result->>'converted')::boolean,false) then converted:=converted+1; end if;
  end loop;
  insert into public.agent_log(agent_name,action,outcome,decision)
  values ('phase4-conversion-backfill','retry_skipped_conversions','completed',
    jsonb_build_object('attempted',attempted,'converted',converted,'email_sent',false));
  return jsonb_build_object('attempted',attempted,'converted',converted,'email_sent',false);
end;
$$;

revoke all on function automation.prepare_phase4_learning_report() from public,anon,authenticated;
revoke all on function public.backfill_phase4_paid_conversions(integer) from public,anon,authenticated;
grant execute on function automation.prepare_phase4_learning_report() to service_role;
grant execute on function public.backfill_phase4_paid_conversions(integer) to service_role;

do $$
declare job_id bigint;
begin
  if exists(select 1 from cron.job where jobname='phase4-weekly-learning') then
    perform cron.unschedule('phase4-weekly-learning');
  end if;
  perform cron.schedule('phase4-weekly-learning','30 13 * * 1',
    'select automation.prepare_phase4_learning_report();');
  select jobid into job_id from cron.job where jobname='phase4-weekly-learning';
  perform cron.alter_job(job_id:=job_id,active:=false);
end $$;
