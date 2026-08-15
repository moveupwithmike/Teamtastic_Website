create table public.final_certification_attestations (
  id bigint generated always as identity primary key,
  certification_id uuid not null references public.final_production_certifications(id) on delete restrict,
  evidence_key text not null check(evidence_key in ('cross_browser_forms_verified','email_auth_inbox_verified')),
  passed boolean not null,
  notes text not null check(length(trim(notes))>=10),
  actor text not null,
  created_at timestamptz not null default now()
);
create index final_certification_attestations_run_idx on public.final_certification_attestations(certification_id,created_at desc);
alter table public.final_certification_attestations enable row level security;
revoke all on table public.final_certification_attestations from public,anon,authenticated;
revoke all on sequence public.final_certification_attestations_id_seq from public,anon,authenticated;
grant select,insert on table public.final_certification_attestations to service_role;
grant usage,select on sequence public.final_certification_attestations_id_seq to service_role;

create or replace function public.record_final_certification_attestation(p_certification_id uuid,p_evidence_key text,p_passed boolean,p_notes text,p_actor text)
returns jsonb language plpgsql security invoker set search_path=''
as $$declare evidence jsonb;
begin
  if p_evidence_key not in ('cross_browser_forms_verified','email_auth_inbox_verified') then raise exception 'Unsupported evidence key'; end if;
  if length(trim(coalesce(p_notes,'')))<10 then raise exception 'Evidence notes are required'; end if;
  if not exists(select 1 from public.final_production_certifications where id=p_certification_id and status in ('running','ready_for_signoff')) then raise exception 'Certification is not active'; end if;
  insert into public.final_certification_attestations(certification_id,evidence_key,passed,notes,actor) values(p_certification_id,p_evidence_key,p_passed,trim(p_notes),p_actor);
  select preflight_evidence||jsonb_build_object(p_evidence_key,p_passed,p_evidence_key||'_notes',trim(p_notes),p_evidence_key||'_actor',p_actor,p_evidence_key||'_recorded_at',now()) into evidence
  from public.final_production_certifications where id=p_certification_id;
  update public.final_production_certifications set preflight_evidence=evidence where id=p_certification_id;
  return jsonb_build_object('recorded',true,'evidence_key',p_evidence_key,'passed',p_passed);
end;$$;
revoke all on function public.record_final_certification_attestation(uuid,text,boolean,text,text) from public,anon,authenticated;
grant execute on function public.record_final_certification_attestation(uuid,text,boolean,text,text) to service_role;
