-- First tranche of the player-RPC authorization audit.
-- Protect host/client mutations while preserving anonymous player buzz calls.

create or replace function public.increment_ai_credits(p_client_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not (
    exists (
      select 1 from public.client_contacts cc
      where cc.client_id = p_client_id
        and cc.user_id = v_uid
        and cc.portal_role in ('client_admin', 'organizer')
    )
    or exists (
      select 1 from public.users u
      where u.id = v_uid and u.role = 'admin'
    )
  ) then
    raise exception 'Not authorized to consume AI credits for this client';
  end if;

  update public.clients
  set ai_credits_used = coalesce(ai_credits_used, 0) + 1
  where id = p_client_id
    and (ai_credits_limit is null or coalesce(ai_credits_used, 0) < ai_credits_limit);

  if not found then
    raise exception 'Client not found or AI credit limit reached';
  end if;
end;
$$;

revoke all on function public.increment_ai_credits(uuid) from public, anon;
grant execute on function public.increment_ai_credits(uuid) to authenticated, service_role;

create or replace function public.clear_buzzers(target_event_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not (
    exists (select 1 from public.events e where e.id = target_event_id and e.host_id = v_uid)
    or exists (select 1 from public.users u where u.id = v_uid and u.role = 'admin')
  ) then
    raise exception 'Only the event host can clear buzzers';
  end if;

  update public.round_states
  set buzzer_queue = '[]'::jsonb,
      first_buzzer_id = null,
      buzzer_time = null
  where event_id = target_event_id;
end;
$$;

create or replace function public.pop_buzzer(target_event_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_uid uuid := auth.uid();
  new_queue jsonb;
  new_first_id uuid;
begin
  if v_uid is null or not (
    exists (select 1 from public.events e where e.id = target_event_id and e.host_id = v_uid)
    or exists (select 1 from public.users u where u.id = v_uid and u.role = 'admin')
  ) then
    raise exception 'Only the event host can remove buzzers';
  end if;

  select coalesce(buzzer_queue, '[]'::jsonb) - 0
  into new_queue
  from public.round_states
  where event_id = target_event_id;

  if jsonb_array_length(coalesce(new_queue, '[]'::jsonb)) > 0 then
    new_first_id := (new_queue->0->>'id')::uuid;
  end if;

  update public.round_states
  set buzzer_queue = coalesce(new_queue, '[]'::jsonb),
      first_buzzer_id = new_first_id,
      buzzer_time = case when new_first_id is not null then buzzer_time else null end
  where event_id = target_event_id;
end;
$$;

revoke all on function public.clear_buzzers(uuid) from public, anon;
revoke all on function public.pop_buzzer(uuid) from public, anon;
grant execute on function public.clear_buzzers(uuid) to authenticated, service_role;
grant execute on function public.pop_buzzer(uuid) to authenticated, service_role;

-- Anonymous players may buzz, but they may no longer spoof a name/avatar or
-- submit a player id that does not belong to the target event.
create or replace function public.append_buzzer(
  target_event_id uuid,
  player_id uuid,
  player_name text,
  player_avatar text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_player public.players%rowtype;
begin
  select * into v_player
  from public.players p
  where p.id = player_id and p.event_id = target_event_id and coalesce(p.status, 'active') = 'active';

  if not found then
    raise exception 'Player not found in event';
  end if;

  if auth.uid() is not null and v_player.user_id is not null and auth.uid() <> v_player.user_id then
    raise exception 'Player identity mismatch';
  end if;

  update public.round_states
  set buzzer_queue = coalesce(buzzer_queue, '[]'::jsonb) || jsonb_build_object(
        'id', v_player.id,
        'name', coalesce(v_player.screen_name, v_player.name),
        'avatar', coalesce(v_player.avatar_url, v_player.avatar_emoji, ''),
        'time', round(extract(epoch from clock_timestamp()) * 1000)
      ),
      first_buzzer_id = coalesce(first_buzzer_id, v_player.id),
      buzzer_time = coalesce(buzzer_time, clock_timestamp())
  where event_id = target_event_id
    and not exists (
      select 1 from jsonb_array_elements(coalesce(buzzer_queue, '[]'::jsonb)) entry
      where entry->>'id' = v_player.id::text
    );
end;
$$;

create or replace function public.append_buzz(
  p_event_id uuid,
  p_player_id uuid,
  p_player_name text,
  p_team_id text default '',
  p_team_name text default '',
  p_buzz_time bigint default 0
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_player public.players%rowtype;
  v_team_name text := '';
  v_current_gs jsonb;
  v_buzzer_queue jsonb;
begin
  select * into v_player
  from public.players p
  where p.id = p_player_id and p.event_id = p_event_id and coalesce(p.status, 'active') = 'active';

  if not found then
    raise exception 'Player not found in event';
  end if;

  if auth.uid() is not null and v_player.user_id is not null and auth.uid() <> v_player.user_id then
    raise exception 'Player identity mismatch';
  end if;

  if v_player.team_id is not null then
    select coalesce(t.name, '') into v_team_name
    from public.teams t where t.id = v_player.team_id and t.event_id = p_event_id;
  end if;

  select coalesce(game_state, '{}'::jsonb) into v_current_gs
  from public.round_states where event_id = p_event_id for update;

  if not found then
    raise exception 'Round state not found for event';
  end if;

  v_buzzer_queue := coalesce(v_current_gs->'buzzer_queue', '[]'::jsonb);
  if not exists (
    select 1 from jsonb_array_elements(v_buzzer_queue) entry
    where entry->>'player_id' = v_player.id::text
  ) then
    update public.round_states
    set game_state = v_current_gs || jsonb_build_object(
          'buzzer_queue', v_buzzer_queue || jsonb_build_array(jsonb_build_object(
            'player_id', v_player.id,
            'player_name', coalesce(v_player.screen_name, v_player.name),
            'team_id', coalesce(v_player.team_id::text, ''),
            'team_name', v_team_name,
            'buzz_time', case when p_buzz_time > 0 then p_buzz_time else round(extract(epoch from clock_timestamp()) * 1000) end
          ))
        ),
        updated_at = now()
    where event_id = p_event_id;
  end if;
end;
$$;

revoke all on function public.append_buzzer(uuid, uuid, text, text) from public;
revoke all on function public.append_buzz(uuid, uuid, text, text, text, bigint) from public;
grant execute on function public.append_buzzer(uuid, uuid, text, text) to anon, authenticated, service_role;
grant execute on function public.append_buzz(uuid, uuid, text, text, text, bigint) to anon, authenticated, service_role;
