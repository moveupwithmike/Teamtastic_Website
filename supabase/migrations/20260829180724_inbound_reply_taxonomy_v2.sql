-- Inbound reply intelligence v2: richer intent taxonomy, safer state transitions,
-- and the first time-to-first-response measurement.
--
-- Rationale (matches src/lib/server/office/hot-lead.js, the canonical intent model):
--   * pricing_request / booking_request are HOT intents (high-priority owner tasks, prospect
--     marked interested) -- but only above the confidence floor; low-confidence replies always
--     degrade to a review task, never a hot alert.
--   * not_now is NOT a negative: it stops current marketing, schedules a re-engagement task,
--     and never suppresses the address.
--   * out_of_office is an absence, not an intent: it must not mark a lead interested, must not
--     surface a review task, and must not destroy active sequence enrollment state.
--   * objection is a live conversation (address the concern), never auto-suppression.
--   * referral keeps preserves the original contact and asks the owner to record the referral.
-- Hard negatives (unsubscribe / not_interested / complaint / legal) keep their deterministic
-- suppression + urgent paths unchanged.

-- 1) Extend the messages.classification taxonomy. The original constraint is the
--    default Postgres name for an unnamed inline check on this column
--    (confirmed directly against production: `messages_classification_check`,
--    stored internally as `= ANY (ARRAY[...])`, not textually as `IN (...)` — a
--    dynamic ILIKE '%classification in (%' search against
--    pg_get_constraintdef() never matches that rendering and silently finds
--    nothing to drop). Drop by the known, deterministic name instead, matching
--    the same pattern already used elsewhere in this codebase (e.g.
--    deals_stage_check, outreach_drafts_status_check).
alter table public.messages drop constraint if exists messages_classification_check;

alter table public.messages
  add constraint messages_classification_check check (
    classification is null or classification in (
      'interested', 'not_interested', 'question', 'referral',
      'pricing_request', 'booking_request', 'objection', 'not_now',
      'unsubscribe', 'out_of_office', 'complaint', 'legal', 'unknown'
    )
  );

-- 2) Time-to-first-response measurement: first human outbound reply per lead.
--    Only human-authored sends (Office sales responses / proposals) count; nurture,
--    confirmations, and internal messages never do. Derived minutes column lets the office
--    read response speed without a BI layer.
alter table public.leads
  add column if not exists first_replied_at timestamptz;
alter table public.leads
  add column if not exists first_response_minutes numeric generated always as (
    case when first_replied_at is not null and created_at is not null then
      round(extract(epoch from (first_replied_at - created_at)) / 60.0, 2)
    else null end
  ) stored;

create or replace function automation.mark_first_reply()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.direction = 'outbound' and new.prospect_id is not null
     and new.message_type in ('manual', 'proposal')
     and new.sent_at is not null then
    update public.leads
    set first_replied_at = new.sent_at
    where prospect_id = new.prospect_id
      and first_replied_at is null
      and created_at <= new.sent_at;
  end if;
  return new;
end;
$$;

drop trigger if exists messages_mark_first_reply on public.messages;
create trigger messages_mark_first_reply
after insert on public.messages
for each row execute function automation.mark_first_reply();

-- 3) Intent-aware inbound handling. Replaces the v1 handler (phase4_operational_completion).
create or replace function automation.handle_inbound_message()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  should_suppress boolean;
  should_absence boolean;
  should_defer boolean;
  is_hot boolean;
  confidence numeric;
  task_priority text;
  task_due timestamptz;
  task_title text;
  task_note text;
  escalation jsonb;
begin
  if new.direction <> 'inbound' or new.prospect_id is null then return new; end if;

  confidence := coalesce(new.classification_confidence, 0);
  should_suppress := new.classification in ('unsubscribe', 'not_interested', 'complaint', 'legal');
  should_absence := new.classification = 'out_of_office';
  should_defer := new.classification = 'not_now';
  -- Mirrors src/lib/server/office/hot-lead.js HOT_INTENTS/HOT_MIN_CONFIDENCE exactly:
  -- all three hot intents require the same 0.75 confidence floor, not just "interested".
  -- A low-confidence guess must never be treated the same as a confident one.
  is_hot := new.classification in ('interested', 'pricing_request', 'booking_request')
    and confidence >= 0.75;

  -- a) Prospect status only changes on real signals; absence and deferral preserve state.
  --    A low-confidence hot-intent classification stays "replied", not "interested",
  --    until a human confirms it — ambiguity must fail safe, not aggressive.
  update public.prospects set
    last_inbound_at = coalesce(new.received_at, new.created_at),
    status = case when should_suppress then 'suppressed'
                  when should_absence then status
                  when is_hot then 'interested'
                  else 'replied' end,
    updated_at = now()
  where id = new.prospect_id;

  -- b) Stop outreach sequences on any real human reply, but NOT on absence auto-replies.
  if not should_absence then
    update public.sequence_enrollments set status='stopped_reply',
      stopped_reason=coalesce(new.classification, 'inbound_reply'), next_action_at=null, updated_at=now()
    where prospect_id=new.prospect_id and status in ('pending','active','paused');
  end if;

  -- c) Durable suppression for hard negatives only.
  if should_suppress then
    insert into public.suppression_list(email, reason, source, provider_event_id)
    select p.email_normalized,
      case when new.classification='unsubscribe' then 'unsubscribe' else 'manual' end,
      'gmail_reply:' || coalesce(new.classification,'unknown'), new.provider_message_id
    from public.prospects p where p.id=new.prospect_id and p.email_normalized is not null
    on conflict (email_normalized) do nothing;
  end if;

  -- d) One purpose-built owner task per intent. Absence and hard negatives are quiet by design;
  --    deferral becomes a dated re-engagement task so "check back in January" cannot disappear.
  if not should_suppress and not should_absence then
    task_title := case new.classification
      when 'not_now' then 'Re-engage later: ' || coalesce(new.subject,'(no subject)')
      when 'referral' then 'Record referral: ' || coalesce(new.subject,'(no subject)')
      when 'objection' then 'Address objection: ' || coalesce(new.subject,'(no subject)')
      when 'pricing_request' then 'Pricing request: ' || coalesce(new.subject,'(no subject)')
      when 'booking_request' then 'Booking request: ' || coalesce(new.subject,'(no subject)')
      when 'question' then 'Answer question: ' || coalesce(new.subject,'(no subject)')
      when 'unknown' then 'Review ambiguous reply: ' || coalesce(new.subject,'(no subject)')
      else 'Review reply: ' || coalesce(new.subject,'(no subject)') end;
    -- Task priority only escalates when the classification is also confident
    -- (is_hot). A low-confidence pricing/booking/interested guess still gets a
    -- review task via the 'else' branches below — it just isn't treated as urgent.
    task_priority := case
      when new.classification = 'booking_request' and is_hot then 'urgent'
      when new.classification in ('interested', 'pricing_request') and is_hot then 'high'
      else 'normal' end;
    task_due := case when new.classification = 'not_now' then now() + interval '30 days'
                     when task_priority = 'urgent' then now()
                     else now() + interval '2 hours' end;
    task_note := case new.classification
      when 'not_now' then 'Acknowledge and schedule a documented re-engagement window; do not re-pitch now.'
      when 'referral' then 'Preserve the original contact; contact the referred person only after approval.'
      when 'objection' then 'Address the stated concern; do not treat this as a no until it is answered.'
      when 'pricing_request' then 'Reply with canonical pricing only; confirm date and capacity first.'
      when 'booking_request' then 'Confirm availability from the authoritative calendar, then route to booking.'
      when 'question' then 'Answer with verified facts; escalate to a call if intent strengthens.'
      else 'Read the thread and confirm intent before any automation acts.' end;

    escalation := automation.evaluate_phase4_escalation(
      coalesce(new.subject,'') || E'\n' || coalesce(new.body_text,''), confidence, 0);
    if coalesce((escalation->>'escalate')::boolean, false)
       and task_priority = 'normal'
       and new.classification in ('unknown','question','objection') then
      task_priority := case when (escalation->'reasons')::text like '%"urgent"%' then 'urgent' else 'high' end;
      task_due := now();
    end if;

    insert into public.tasks(prospect_id,title,description,priority,due_at,source,fingerprint)
    values (new.prospect_id, task_title,
      'Classification: ' || coalesce(new.classification,'unknown') || ' (' ||
        coalesce(confidence::text,'0') || '). ' || task_note,
      task_priority, task_due, 'phase4_escalation',
      case when should_defer then 'phase4:reengage:' || new.id::text
           when new.classification = 'referral' then 'phase4:referral:' || new.id::text
           else 'phase4:reply-escalation:' || new.id::text end)
    on conflict (fingerprint) where fingerprint is not null do nothing;
  end if;

  insert into public.agent_log(agent_name,action,outcome,prospect_id,message_id,decision)
  values ('phase4-escalation','evaluate_inbound_reply',
    case when should_suppress then 'suppressed'
         when should_absence then 'absence_ignored'
         when is_hot then 'hot' when should_defer then 'deferred' else 'escalated' end,
    new.prospect_id, new.id,
    jsonb_build_object('classification',new.classification,'confidence',confidence,
      'suppressed',should_suppress,'absence',should_absence,'deferred',should_defer,
      'hot',is_hot,'sequence_stopped',not should_absence,'escalation_reasons',
      coalesce(escalation->'reasons','[]'::jsonb)));
  return new;
end;
$$;