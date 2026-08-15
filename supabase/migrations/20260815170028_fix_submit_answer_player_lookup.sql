do $fix$
declare
  v_definition text;
begin
  select pg_get_functiondef(p.oid)
    into v_definition
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'submit_answer'
    and pg_get_function_identity_arguments(p.oid) =
      'p_event_id uuid, p_player_id uuid, p_question_index integer, p_answer_value text, p_answer_text text, p_is_correct boolean, p_points_awarded integer, p_round_type text, p_team_id uuid, p_base_points integer, p_answer_type text, p_server_grade boolean, p_question_id uuid, p_round_id uuid, p_question_sub_index integer, p_grading_status text, p_wager numeric, p_score_metadata jsonb';

  if v_definition is null then
    raise exception 'submit_answer function not found';
  end if;

  v_definition := replace(
    v_definition,
    'where id = p_player_id and event_id = p_event_id and coalesce(is_active, true);',
    'where id = p_player_id and event_id = p_event_id;'
  );

  if position('coalesce(is_active, true)' in v_definition) > 0 then
    raise exception 'submit_answer player lookup correction did not apply';
  end if;

  execute v_definition;
end
$fix$;
