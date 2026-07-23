-- service_role was granted EXECUTE on individual automation.* functions but never USAGE
-- on the automation schema itself. Postgres requires schema USAGE to invoke any
-- qualified function in it — including implicitly, from a trigger. This broke every
-- insert/update on outreach_drafts(subject, body_text) done via service_role (the
-- outreach_drafts_phase4_escalation trigger calls automation.evaluate_pipeline_draft()),
-- which includes /office's approve/reject action from Milestone 2 and the drafting
-- pipeline in Milestone 3. Found while activating Milestone 3's drafting cron for real.
grant usage on schema automation to service_role;
