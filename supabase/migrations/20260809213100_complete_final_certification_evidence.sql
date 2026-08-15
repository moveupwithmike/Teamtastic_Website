create or replace function public.sign_off_final_production_certification(p_certification_id uuid,p_actor text)
returns jsonb language plpgsql security invoker set search_path=''
as $$declare r public.final_production_certifications%rowtype;
begin
  perform automation.observe_final_production_certifications();
  select * into r from public.final_production_certifications where id=p_certification_id for update;
  if r.status<>'ready_for_signoff' then raise exception 'Final certification gates are not complete'; end if;
  if coalesce((r.preflight_evidence->>'automated_tests_passed')::boolean,false)=false
    or coalesce((r.preflight_evidence->>'production_build_passed')::boolean,false)=false
    or coalesce((r.preflight_evidence->>'cross_browser_forms_verified')::boolean,false)=false
    or coalesce((r.preflight_evidence->>'office_access_verified')::boolean,false)=false
    or coalesce((r.preflight_evidence->>'email_auth_inbox_verified')::boolean,false)=false
    or coalesce((r.preflight_evidence->>'stripe_verified')::boolean,false)=false
    or coalesce((r.preflight_evidence->>'scheduled_automations_verified')::boolean,false)=false
    or coalesce((r.preflight_evidence->>'security_advisors_reviewed')::boolean,false)=false
    or coalesce((r.preflight_evidence->>'controlled_load_passed')::boolean,false)=false then raise exception 'Required preflight evidence is incomplete'; end if;
  update public.final_production_certifications set status='passed',signed_off_by=p_actor,signed_off_at=now(),completed_at=now() where id=r.id;
  return jsonb_build_object('passed',true,'certification_id',r.id,'signed_off_by',p_actor);
end;$$;
revoke all on function public.sign_off_final_production_certification(uuid,text) from public,anon,authenticated;
grant execute on function public.sign_off_final_production_certification(uuid,text) to service_role;
