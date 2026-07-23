-- Multi-touch cold-outreach follow-ups. Populates the sequences/sequence_steps/
-- sequence_enrollments scaffolding from the original Phase 3 foundation, which existed
-- but was never written to. The stop-on-reply (automation.handle_inbound_message) and
-- stop-on-booking (automation.on_booking_confirmed) triggers already handle
-- sequence_enrollments generically and need no changes.

alter table public.system_config
  add column if not exists sequence_followups_enabled boolean not null default false;

alter table public.outreach_drafts
  add column if not exists sequence_enrollment_id uuid references public.sequence_enrollments(id) on delete set null,
  add column if not exists sequence_step integer;

insert into public.sequences (name, description, channel, status, requires_approval)
values ('cold-outreach-followups-v1', 'Bump + breakup follow-ups for single-touch prospecting emails', 'email', 'active', true)
on conflict (name) do nothing;
