-- Regression test for the Aug 15 2026 player-RPC authorization hardening:
--   20260815165113_harden_high_risk_game_rpcs.sql
--   20260815165909_harden_submit_answer_grading.sql (+ 20260815170028 fixup)
--   20260815172132_revoke_anon_host_scoring_resolvers.sql
--
-- Proves two things those migrations changed:
--   1. GRANT/REVOKE: anon has lost EXECUTE on the host/admin-only RPCs, and
--      still has it on the RPCs anonymous players must keep calling.
--   2. Internal authorization: an unauthenticated or unauthorized caller is
--      rejected by the function body itself, not just by the grant, and a
--      legitimate caller (host / client_admin) is still allowed through.
--
-- auth.uid() reads request.jwt.claim.sub (see auth.uid()'s own definition),
-- so a transaction-local set_config(...) is enough to simulate "logged in
-- as this user" without a real Supabase Auth session — the standard
-- technique for exercising security-definer RPCs from a plain SQL test.
--
-- public.users.id, events.host_id, players.user_id, and
-- client_contacts.user_id all foreign-key back to auth.users(id), so the
-- fixtures below insert minimal auth.users rows first. That's expected and
-- safe against a local/CI Supabase instance (this is the standard pattern
-- for exercising security-definer RPCs — see the Supabase docs on testing
-- database functions) but this file must never be pointed at a live/shared
-- project's auth schema.

begin;

select plan(1);

do $$
declare
  v_admin_user_id uuid := gen_random_uuid();
  v_host_user_id uuid := gen_random_uuid();
  v_client_admin_user_id uuid := gen_random_uuid();
  v_viewer_user_id uuid := gen_random_uuid();
  v_client_id uuid;
  v_event_id uuid;
  v_anon_player_id uuid;
  v_bound_player_id uuid;
  v_rejected boolean;
  v_credits_before integer;
  v_credits_after integer;
  v_queue jsonb;
  v_result jsonb;
begin
  -- Fixtures ---------------------------------------------------------------
  insert into auth.users (id) values
    (v_admin_user_id), (v_host_user_id), (v_client_admin_user_id), (v_viewer_user_id);

  insert into public.users (id, email, role) values
    (v_admin_user_id, 'admin-rpc-hardening-test@example.invalid', 'admin'),
    (v_host_user_id, 'host-rpc-hardening-test@example.invalid', 'player'),
    (v_client_admin_user_id, 'client-admin-rpc-hardening-test@example.invalid', 'player'),
    (v_viewer_user_id, 'viewer-rpc-hardening-test@example.invalid', 'player');

  insert into public.clients (name, email, ai_credits_used, ai_credits_limit)
  values ('RPC hardening test client', 'client-rpc-hardening-test@example.invalid', 0, 5)
  returning id into v_client_id;

  insert into public.client_contacts (client_id, user_id, name, email, portal_role) values
    (v_client_id, v_client_admin_user_id, 'Client Admin', 'client-admin-rpc-hardening-test@example.invalid', 'client_admin'),
    (v_client_id, v_viewer_user_id, 'Viewer', 'viewer-rpc-hardening-test@example.invalid', 'viewer');

  insert into public.events (host_id, host_code, status, title, event_type)
  values (v_host_user_id, 'rpctest-' || left(replace(gen_random_uuid()::text, '-', ''), 16), 'lobby', 'RPC hardening test event', 'trivia')
  returning id into v_event_id;

  insert into public.round_states (event_id, buzzer_queue, first_buzzer_id, buzzer_time)
  values (v_event_id, '[]'::jsonb, null, null);

  -- No user_id: this is what an anonymous player looks like.
  insert into public.players (event_id, user_id, name, status)
  values (v_event_id, null, 'Anonymous Player', 'active')
  returning id into v_anon_player_id;
  -- Bound to a real user: identity spoofing should be rejected for this one.
  insert into public.players (event_id, user_id, name, status)
  values (v_event_id, v_viewer_user_id, 'Identity-bound Player', 'active')
  returning id into v_bound_player_id;

  -- 1. GRANT/REVOKE ----------------------------------------------------------
  if has_function_privilege('anon', 'public.increment_ai_credits(uuid)', 'execute') then
    raise exception 'anon retains EXECUTE on increment_ai_credits';
  end if;
  if has_function_privilege('anon', 'public.clear_buzzers(uuid)', 'execute') then
    raise exception 'anon retains EXECUTE on clear_buzzers';
  end if;
  if has_function_privilege('anon', 'public.pop_buzzer(uuid)', 'execute') then
    raise exception 'anon retains EXECUTE on pop_buzzer';
  end if;
  if has_function_privilege('anon', 'public.resolve_checkout_challenge_item(uuid,uuid,integer)', 'execute') then
    raise exception 'anon retains EXECUTE on resolve_checkout_challenge_item';
  end if;
  if has_function_privilege('anon', 'public.resolve_scribbles_giggles_reveal(uuid,uuid)', 'execute') then
    raise exception 'anon retains EXECUTE on resolve_scribbles_giggles_reveal';
  end if;
  -- These two must stay anonymous-callable — that's the whole point of a
  -- buzzer game — so a regression that accidentally locks them down is just
  -- as much a bug as one that leaves the host-only RPCs open.
  if not has_function_privilege('anon', 'public.append_buzzer(uuid,uuid,text,text)', 'execute') then
    raise exception 'anon lost EXECUTE on append_buzzer (must remain anonymous-player callable)';
  end if;
  if not has_function_privilege('anon', 'public.submit_answer(uuid,uuid,integer,text,text,boolean,integer,text,uuid,integer,text,boolean,uuid,uuid,integer,text,numeric,jsonb)', 'execute') then
    raise exception 'anon lost EXECUTE on submit_answer (must remain anonymous-player callable)';
  end if;

  -- 2a. increment_ai_credits: internal authorization ------------------------
  perform set_config('request.jwt.claim.sub', '', true); -- unauthenticated
  v_rejected := false;
  begin
    perform public.increment_ai_credits(v_client_id);
  exception when others then v_rejected := true;
  end;
  if not v_rejected then raise exception 'increment_ai_credits allowed an unauthenticated caller'; end if;

  perform set_config('request.jwt.claim.sub', v_viewer_user_id::text, true); -- authenticated, but only a 'viewer'
  v_rejected := false;
  begin
    perform public.increment_ai_credits(v_client_id);
  exception when others then v_rejected := true;
  end;
  if not v_rejected then raise exception 'increment_ai_credits allowed a non-admin/organizer client contact'; end if;

  select ai_credits_used into v_credits_before from public.clients where id = v_client_id;
  perform set_config('request.jwt.claim.sub', v_client_admin_user_id::text, true); -- the legitimate case
  perform public.increment_ai_credits(v_client_id);
  select ai_credits_used into v_credits_after from public.clients where id = v_client_id;
  if v_credits_after <> v_credits_before + 1 then
    raise exception 'increment_ai_credits did not credit the authorized client_admin call';
  end if;

  -- 2b. clear_buzzers: internal authorization --------------------------------
  update public.round_states
  set buzzer_queue = '[{"id":"someone"}]'::jsonb, first_buzzer_id = gen_random_uuid(), buzzer_time = now()
  where event_id = v_event_id;

  perform set_config('request.jwt.claim.sub', v_viewer_user_id::text, true); -- authenticated, but not this event's host
  v_rejected := false;
  begin
    perform public.clear_buzzers(v_event_id);
  exception when others then v_rejected := true;
  end;
  if not v_rejected then raise exception 'clear_buzzers allowed a non-host caller'; end if;

  select buzzer_queue into v_queue from public.round_states where event_id = v_event_id;
  if jsonb_array_length(v_queue) = 0 then
    raise exception 'clear_buzzers test setup is invalid: queue was already empty before the authorized call';
  end if;

  perform set_config('request.jwt.claim.sub', v_host_user_id::text, true); -- the actual host
  perform public.clear_buzzers(v_event_id);
  select buzzer_queue into v_queue from public.round_states where event_id = v_event_id;
  if jsonb_array_length(v_queue) <> 0 then
    raise exception 'clear_buzzers did not clear the queue for the authorized host';
  end if;

  -- 2c. append_buzzer: anonymous buzzing preserved, identity spoofing blocked
  perform set_config('request.jwt.claim.sub', '', true); -- unauthenticated
  perform public.append_buzzer(v_event_id, v_anon_player_id, 'Anonymous Player', '');
  select buzzer_queue into v_queue from public.round_states where event_id = v_event_id;
  if not exists (select 1 from jsonb_array_elements(v_queue) entry where entry->>'id' = v_anon_player_id::text) then
    raise exception 'append_buzzer rejected a legitimate anonymous player buzz';
  end if;

  perform set_config('request.jwt.claim.sub', v_admin_user_id::text, true); -- a real user, but not this player
  v_rejected := false;
  begin
    perform public.append_buzzer(v_event_id, v_bound_player_id, 'Identity-bound Player', '');
  exception when others then v_rejected := true;
  end;
  if not v_rejected then raise exception 'append_buzzer allowed buzzing as a player bound to a different user'; end if;

  -- 3. submit_answer: scoring cannot be self-reported by an untrusted caller
  perform set_config('request.jwt.claim.sub', '', true); -- unauthenticated player
  v_result := public.submit_answer(
    v_event_id, v_anon_player_id, 0, 'whatever the player typed',
    p_is_correct := true, p_points_awarded := 9999
  );
  if (v_result->>'trusted_grader')::boolean is distinct from false
     or v_result->>'is_correct' is not null
     or (v_result->>'points_awarded')::integer <> 0
     or v_result->>'grading_status' <> 'pending' then
    raise exception 'submit_answer let an untrusted caller self-report is_correct/points_awarded (got %)', v_result;
  end if;

  perform set_config('request.jwt.claim.sub', v_host_user_id::text, true); -- the actual host, grading the same submission
  v_result := public.submit_answer(
    v_event_id, v_anon_player_id, 0, 'whatever the player typed',
    p_is_correct := true, p_points_awarded := 50
  );
  if (v_result->>'trusted_grader')::boolean is distinct from true
     or (v_result->>'is_correct')::boolean is distinct from true
     or (v_result->>'points_awarded')::integer <> 50
     or v_result->>'grading_status' <> 'host_override' then
    raise exception 'submit_answer did not honor the authorized host override (got %)', v_result;
  end if;
end $$;

select pass('game RPC authorization hardening remains enforced');
select * from finish();

rollback;
