-- Atomically claim the Office magic-link send window. The claim row is written
-- before the transaction releases its advisory lock, so a caller arriving just
-- after the RPC commits still observes the 60-second cooldown.

create or replace function automation.try_claim_magic_link_send(p_email text)
returns boolean
language plpgsql
security invoker
set search_path=''
as $$
declare
  normalized_email text:=lower(trim(coalesce(p_email,'')));
begin
  if normalized_email='' then
    return false;
  end if;

  if not pg_try_advisory_xact_lock(
    hashtextextended('office_magic_link:'||normalized_email,0)
  ) then
    return false;
  end if;

  if exists(
    select 1
    from public.agent_log
    where agent_name='office'
      and action='office_magic_link_send_claim'
      and decision->>'email_normalized'=normalized_email
      and created_at>=now()-interval '60 seconds'
  ) then
    return false;
  end if;

  insert into public.agent_log(agent_name,action,outcome,decision)
  values (
    'office',
    'office_magic_link_send_claim',
    'started',
    jsonb_build_object('email_normalized',normalized_email)
  );
  return true;
end;
$$;

revoke all on function automation.try_claim_magic_link_send(text)
  from public,anon,authenticated;
grant execute on function automation.try_claim_magic_link_send(text)
  to service_role;
