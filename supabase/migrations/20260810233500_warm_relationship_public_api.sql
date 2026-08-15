-- Service-only Data API wrappers for the private automation implementation.

create or replace function public.record_warm_relationship_signal(
  p_prospect_id uuid,
  p_signal_type text,
  p_evidence text,
  p_source text,
  p_observed_at timestamptz default now(),
  p_company_id uuid default null,
  p_deal_id uuid default null,
  p_source_url text default null,
  p_strength numeric default 0.800,
  p_metadata jsonb default '{}'::jsonb,
  p_fingerprint text default null
) returns jsonb language sql security invoker set search_path='' as $$
  select automation.record_warm_relationship_signal(
    p_prospect_id,p_signal_type,p_evidence,p_source,p_observed_at,p_company_id,
    p_deal_id,p_source_url,p_strength,p_metadata,p_fingerprint
  );
$$;

create or replace function public.queue_closed_lost_reactivations()
returns jsonb language sql security invoker set search_path='' as $$
  select automation.queue_closed_lost_reactivations();
$$;

revoke all on function public.record_warm_relationship_signal(uuid,text,text,text,timestamptz,uuid,uuid,text,numeric,jsonb,text) from public,anon,authenticated;
revoke all on function public.queue_closed_lost_reactivations() from public,anon,authenticated;
grant execute on function public.record_warm_relationship_signal(uuid,text,text,text,timestamptz,uuid,uuid,text,numeric,jsonb,text) to service_role;
grant execute on function public.queue_closed_lost_reactivations() to service_role;
