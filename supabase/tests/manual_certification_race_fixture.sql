-- Builds one additional fully-gated certification (cert_race) used by the
-- two-session concurrency regressions in run_manual_certification_tests.sh.
\set ON_ERROR_STOP on

insert into public.final_production_certifications(started_by, preflight_evidence, known_limitations)
values ('race@teamtastic.test', '{}'::jsonb, '[]'::jsonb);
update public.final_production_certifications
set started_at = now() - interval '30 hours', observation_ends_at = now() - interval '6 hours'
where started_by = 'race@teamtastic.test';
create temp table cert_race as select id from public.final_production_certifications where started_by='race@teamtastic.test';

-- Accepted production journey for the race certification.
insert into public.prospects(full_name, email, source, status)
values ('Race Journey Ryan', 'ryan.race@example.test', 'inbound', 'new');
create temp table prospect_race as select id from public.prospects where email_normalized='ryan.race@example.test';

insert into public.leads(submission_id, name, email, email_normalized, lead_source, status, context, prospect_id, created_at)
values (gen_random_uuid(), 'Race Journey Ryan', 'ryan.race@example.test', 'ryan.race@example.test',
        'website', 'new', '{}'::jsonb, (select id from prospect_race), now() - interval '29 hours');

insert into public.clients(name, primary_prospect_id) select 'Race Client Co', id from prospect_race;
create temp table client_race as
  select c.id from public.clients c join public.prospects p on p.id=c.primary_prospect_id
  where p.email_normalized='ryan.race@example.test';
insert into public.client_contacts(client_id, name, email, portal_invite_status, accepted_at)
select id, 'Ryan Contact', 'ryan.race@example.test', 'sent', now() - interval '20 hours' from client_race;
create temp table contact_race as select cc.id from public.client_contacts cc join client_race on client_race.id=cc.client_id;
insert into public.portal_invitations(client_contact_id, idempotency_key, status, sent_at, created_at)
select id, 'invite-race-stub', 'sent', now() - interval '21 hours', now() - interval '22 hours' from contact_race;
create temp table invitation_race as select pi.id from public.portal_invitations pi join contact_race on contact_race.id=pi.client_contact_id;
insert into public.deals(prospect_id, title, stage, outcome, next_action, next_action_due_at)
select id, 'Race open deal', 'proposal_sent', 'open', 'Follow up', now() + interval '1 day' from prospect_race;

-- Nine simple automated gates.
do $$
declare c text;
begin
  foreach c in array array['automated_tests_passed','production_build_passed','stripe_verified','scheduled_automations_verified','controlled_load_passed','chromium_public_lead_form','firefox_public_lead_form','mobile_viewport_basics','server_confirmed_lead_persistence']
  loop
    perform automation.record_automated_certification_result(
      (select id from cert_race), c, 'passed', 'ci://run/race-'||c,
      'Canonical runner result captured for the race regression fixture.',
      '{}'::jsonb, now(), 'execution', now(), null, 'race:'||c);
  end loop;
end $$;

-- Email gates with race-scoped provider evidence.
insert into public.email_delivery_evidence(provider_message_id, evidence_stage, evidence_source, source_event_id, evidence_reference, observed_at, recorded_by, metadata)
values ('pm-cert-race-1', 'api_accepted', 'resend_api', 'evt-race-accept-1', 'resend://accepted/pm-cert-race-1', now() - interval '3 hours', 'automation:final-certification',
        jsonb_build_object('certification_id', (select id from cert_race), 'recipient_classification', 'teamtastic_owned_test_mailbox',
                           'execution_id', 'exec-race-1', 'sender_identity', 'hello@teamtastic.events', 'provider_acceptance_result', 'accepted')),
       ('pm-cert-race-1', 'provider_delivered', 'resend_webhook', 'evt-race-deliver-1', 'resend://delivered/pm-cert-race-1', now() - interval '3 hours' + interval '4 seconds', 'automation:final-certification',
        jsonb_build_object('certification_id', (select id from cert_race)));

do $$
begin
  perform automation.record_automated_certification_result((select id from cert_race),'email_api_accepted','passed','provider://stub','Resend accepted a certification-scoped message.','{}'::jsonb,now(),'execution',now(),null,'race:email_api_accepted');
  perform automation.record_automated_certification_result((select id from cert_race),'email_provider_delivered','passed','provider://stub','Signed webhook delivered the certification-scoped message.','{}'::jsonb,now(),'execution',now(),null,'race:email_provider_delivered');
  perform automation.record_automated_certification_result((select id from cert_race),'authenticated_email_delivery','passed','provider://stub','Authenticated SMTP delivery verified for the controlled mailbox.','{}'::jsonb,now(),'execution',now(),null,'race:authenticated_email_delivery');
end $$;

-- Booking gate.
insert into public.bookings(booking_type_id, prospect_id, name, email, visitor_timezone, starts_at, ends_at,
                            blocked_starts_at, blocked_ends_at, status, manage_token_hash, source, context)
select bt.id, pr.id, 'Teamtastic Certification', 'cert.mailbox@teamtastic.test', 'America/New_York',
       now() - interval '4 hours', now() - interval '3 hours',
       now() - interval '4 hours', now() - interval '3 hours',
       'completed', md5(random()::text), 'final_certification',
       jsonb_build_object('synthetic_test', true, 'certification_id', (select id from cert_race),
                          'execution_key', 'race-booking-1', 'recipient_classification', 'teamtastic_owned_test_mailbox')
from public.booking_types bt cross join prospect_race pr
where bt.slug='suite-cert-type';

do $$ begin
  perform automation.record_automated_certification_result((select id from cert_race),'booking_workflow','passed','booking://stub','Certification booking exercised native persistence safely.','{}'::jsonb,now(),'execution',now(),null,'race:booking_workflow');
end $$;

-- Genuine inbound customer reply for journey completeness.
insert into public.messages(prospect_id, direction, channel, from_address, to_addresses, subject, body_text, status, received_at)
select pr.id, 'inbound', 'email', 'ryan.race@example.test', array['hello@teamtastic.events']::text[], 'Re: your event quote', 'Thanks - this looks great for our team.', 'received', now() - interval '26 hours'
from prospect_race pr;

-- Eleven manual gates.
do $$
declare m text;
begin
  foreach m in array array['office_access_verified','security_advisors_reviewed','safari_public_lead_form','turnstile_success_behavior','turnstile_rejection_behavior','email_mailbox_receipt','real_inbox_placement','calendar_zoom_workflow','real_lead_client_journey','client_portal_access','operational_owner_attestation']
  loop
    perform public.record_final_certification_evidence(
      (select id from cert_race), m, 'passed', 'office://manual/race-'||m, 'Operator Person',
      'Named operator verified this gate directly in production for the race.',
      'manual', 'production', case when m in ('client_portal_access','real_lead_client_journey','calendar_zoom_workflow')
        then jsonb_build_object('client_id', (select id from client_race),
                                'invitation_id', (select id from invitation_race))
        else '{}'::jsonb end);
  end loop;
end $$;

do $$
declare v_status text;
begin
  perform automation.observe_final_production_certifications();
  select status into v_status from public.final_production_certifications where id=(select id from cert_race);
  if v_status <> 'ready_for_signoff' then
    raise exception 'race fixture not ready: %', v_status;
  end if;
end $$;
