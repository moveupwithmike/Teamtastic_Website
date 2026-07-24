-- Make missing sequence configuration visibly terminal instead of allowing an
-- active enrollment with no scheduled next action.

alter table public.sequence_enrollments
  drop constraint if exists sequence_enrollments_status_check;
alter table public.sequence_enrollments
  add constraint sequence_enrollments_status_check
  check (status in (
    'pending','active','paused','completed','stopped_reply',
    'stopped_suppressed','stopped_missing_step','failed'
  ));
