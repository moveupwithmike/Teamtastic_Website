-- Milestone 4: reschedule/cancel link support and no-show follow-up tracking.
alter table public.bookings
  add column if not exists rescheduled_at timestamptz,
  add column if not exists rescheduled_from_id uuid references public.bookings(id) on delete set null,
  add column if not exists rescheduled_to_id uuid references public.bookings(id) on delete set null,
  add column if not exists no_show_followup_sent_at timestamptz;
