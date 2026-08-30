-- Found during the final commercial mystery-shopper rehearsal (2026-08-30):
-- automation.handle_inbound_message() (added by inbound_reply_taxonomy_v2) writes
-- agent_log.outcome values 'suppressed', 'absence_ignored', 'hot', and 'deferred',
-- none of which agent_log_outcome_check permitted -- only 'escalated' worked. A real
-- prospect's unsubscribe, out-of-office, deferred, or hot pricing/booking reply would
-- each throw a hard database error on arrival, rolling back the entire message insert.
-- Widen the constraint to include the values the trigger actually needs.
alter table public.agent_log drop constraint agent_log_outcome_check;
alter table public.agent_log add constraint agent_log_outcome_check check (outcome = any (array['started','completed','skipped','blocked','failed','escalated','suppressed','absence_ignored','hot','deferred']));
