-- PostgREST on this project only exposes public/graphql_public (confirmed live:
-- automation is rejected with PGRST106). Every other RPC callable via supabase-js
-- already follows a public-wrapper-around-automation-internals pattern
-- (reserve_email_send, finalize_proposal_send, process_paid_conversion). These
-- three were added directly in automation.* and called via .rpc()/.schema("automation")
-- from application code, which cannot resolve through PostgREST. Add the same
-- wrapper pattern so score_prospect, try_claim_magic_link_send, and
-- lead_has_paid_hosted_event are actually callable.

create or replace function public.score_prospect(p_prospect_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select automation.score_prospect(p_prospect_id)
$$;
revoke all on function public.score_prospect(uuid) from public, anon, authenticated;
grant execute on function public.score_prospect(uuid) to service_role;

create or replace function public.try_claim_magic_link_send(p_email text)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  select automation.try_claim_magic_link_send(p_email)
$$;
revoke all on function public.try_claim_magic_link_send(text) from public, anon, authenticated;
grant execute on function public.try_claim_magic_link_send(text) to service_role;

create or replace function public.lead_has_paid_hosted_event(p_lead_id uuid)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  select automation.lead_has_paid_hosted_event(p_lead_id)
$$;
revoke all on function public.lead_has_paid_hosted_event(uuid) from public, anon, authenticated;
grant execute on function public.lead_has_paid_hosted_event(uuid) to service_role;
