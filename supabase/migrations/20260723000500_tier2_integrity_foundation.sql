-- Tier 2: proposal reconciliation, booking continuity, canonical payment checks,
-- and data-driven outreach sequence steps.

alter table public.proposals drop constraint if exists proposals_status_check;
alter table public.proposals add constraint proposals_status_check
  check (status in (
    'draft','sending','sent','send_failed','reconcile_required',
    'rejected','expired','approved','failed'
  ));
alter table public.proposals
  add column if not exists send_attempted_at timestamptz,
  add column if not exists reconciliation_attempts integer not null default 0;

create or replace function public.finalize_proposal_send(
  p_proposal_id uuid,
  p_provider_message_id text,
  p_from_address text,
  p_subject text,
  p_body_text text,
  p_sent_at timestamptz,
  p_actor text
)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  proposal_record public.proposals%rowtype;
begin
  select * into proposal_record from public.proposals
  where id=p_proposal_id for update;
  if proposal_record.id is null then
    return jsonb_build_object('finalized',false,'reason','proposal_not_found');
  end if;
  if proposal_record.status='sent' and proposal_record.provider_message_id=p_provider_message_id then
    return jsonb_build_object('finalized',true,'duplicate',true);
  end if;
  if proposal_record.status not in ('sending','reconcile_required') then
    return jsonb_build_object('finalized',false,'reason','proposal_not_finalizable');
  end if;

  insert into public.messages(
    prospect_id,direction,message_type,provider,provider_message_id,
    from_address,to_addresses,subject,body_text,status,sent_at
  ) values (
    proposal_record.prospect_id,'outbound','proposal','resend',p_provider_message_id,
    p_from_address,array[proposal_record.recipient_email],p_subject,p_body_text,'sent',p_sent_at
  ) on conflict do nothing;

  update public.proposals set
    status='sent',sent_at=p_sent_at,provider_message_id=p_provider_message_id,
    subject=p_subject,body_text=p_body_text,last_error=null,
    reconciliation_attempts=reconciliation_attempts+1
  where id=p_proposal_id;

  update public.deals set
    stage='proposal_sent',
    next_action='Follow up on the proposal',
    next_action_due_at=p_sent_at+interval '3 days',
    decision_date=proposal_record.expires_on,
    stage_source='office_proposal',
    stage_source_id=p_proposal_id::text,
    updated_at=now()
  where id=proposal_record.deal_id and outcome='open';

  insert into public.agent_log(agent_name,action,outcome,prospect_id,decision)
  values (
    'office','send_proposal','completed',proposal_record.prospect_id,
    jsonb_build_object(
      'proposal_id',p_proposal_id,
      'provider_message_id',p_provider_message_id,
      'actor',left(coalesce(p_actor,'office'),200)
    )
  );
  return jsonb_build_object('finalized',true);
end;
$$;
revoke all on function public.finalize_proposal_send(uuid,text,text,text,text,timestamptz,text)
  from public,anon,authenticated;
grant execute on function public.finalize_proposal_send(uuid,text,text,text,text,timestamptz,text)
  to service_role;

create index if not exists bookings_rescheduled_to_idx
  on public.bookings(rescheduled_to_id) where rescheduled_to_id is not null;
alter table public.bookings drop constraint if exists bookings_rescheduled_to_not_self;
alter table public.bookings add constraint bookings_rescheduled_to_not_self
  check (rescheduled_to_id is null or rescheduled_to_id<>id);

create or replace function automation.lead_has_paid_hosted_event(p_lead_id uuid)
returns boolean
language sql
stable
security invoker
set search_path=''
as $$
  select exists(
    select 1
    from public.stripe_events s
    left join public.payment_requests pr on pr.id=s.payment_request_id
    where s.lead_id=p_lead_id
      and s.product_key='hosted_event_deposit'
      and s.payment_status='paid'
      and s.amount_total>0
      and (s.payment_request_id is null or pr.status='paid')
  )
$$;
revoke all on function automation.lead_has_paid_hosted_event(uuid) from public,anon,authenticated;
grant execute on function automation.lead_has_paid_hosted_event(uuid) to service_role;

insert into public.sequences(name,description,channel,status,requires_approval)
values (
  'cold-outreach-followups-v1',
  'Initial outreach plus two no-reply follow-ups.',
  'email','active',true
)
on conflict(name) do update set
  description=excluded.description,status='active',updated_at=now();

insert into public.sequence_steps(
  sequence_id,step_number,delay_minutes,subject_template,body_template,status
)
select s.id,v.step_number,v.delay_minutes,v.subject_template,v.body_template,'approved'
from public.sequences s
cross join (values
  (1,0,'An idea for {{company}}','initial_template:phase3-v3.1-teamtastic-voice'),
  (2,4320,'Following up — {{company}}',
   E'Hi {{first_name}},\n\nWanted to make sure this did not get lost in the shuffle — I sent a note about bringing a hosted Teamtastic experience to the {{company}} team.\n\nStill worth a quick look, or is now just not the right time?\n\nMichael'),
  (3,5760,'Last note from me — {{company}}',
   E'Hi {{first_name}},\n\nI do not want to keep showing up in your inbox, so I will leave this as my last note for now.\n\nIf the timing is ever right for {{company}} to do something fun together as a team, just reply — happy to pick this back up anytime.\n\nMichael')
) as v(step_number,delay_minutes,subject_template,body_template)
where s.name='cold-outreach-followups-v1'
on conflict(sequence_id,step_number) do update set
  delay_minutes=excluded.delay_minutes,
  subject_template=excluded.subject_template,
  body_template=excluded.body_template,
  status='approved',
  updated_at=now();
