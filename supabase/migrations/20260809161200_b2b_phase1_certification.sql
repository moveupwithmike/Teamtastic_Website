create table public.b2b_certification_runs (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'running' check(status in ('running','passed','failed')),
  started_by text not null,
  lead_ids uuid[] not null default '{}',
  stripe_event_id uuid references public.stripe_events(id) on delete set null,
  checkpoints jsonb not null default '[]'::jsonb,
  passed_count integer not null default 0,
  failed_count integer not null default 0,
  external_messages_sent integer not null default 0 check(external_messages_sent = 0),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.b2b_certification_runs enable row level security;
revoke all on table public.b2b_certification_runs from public,anon,authenticated;
grant select,insert,update,delete on table public.b2b_certification_runs to service_role;

create or replace function public.process_synthetic_paid_conversion(p_stripe_event_id uuid)
returns jsonb language plpgsql security invoker set search_path=''
as $$
declare v_lead public.leads%rowtype; v_previous boolean; v_result jsonb;
begin
  select l.* into v_lead from public.stripe_events s join public.leads l on l.id=s.lead_id
  where s.id=p_stripe_event_id for update of s;
  if v_lead.id is null or coalesce((v_lead.context->>'synthetic_test')::boolean,false) is not true then
    return jsonb_build_object('converted',false,'reason','not_a_synthetic_certification_lead');
  end if;
  select phase4_lifecycle_enabled into v_previous from public.system_config where id=true for update;
  update public.system_config set phase4_lifecycle_enabled=true where id=true;
  v_result:=public.process_paid_conversion(p_stripe_event_id);
  update public.system_config set phase4_lifecycle_enabled=v_previous where id=true;
  return v_result||jsonb_build_object('synthetic_test',true,'external_send',false);
exception when others then
  update public.system_config set phase4_lifecycle_enabled=coalesce(v_previous,false) where id=true;
  raise;
end; $$;
revoke all on function public.process_synthetic_paid_conversion(uuid) from public,anon,authenticated;
grant execute on function public.process_synthetic_paid_conversion(uuid) to service_role;
