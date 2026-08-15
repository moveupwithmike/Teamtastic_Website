-- Separate trusted host/server grading from untrusted player submission while
-- preserving the existing RPC signature used by deployed game clients.

create or replace function public.submit_answer(
  p_event_id uuid,
  p_player_id uuid,
  p_question_index integer,
  p_answer_value text,
  p_answer_text text default null,
  p_is_correct boolean default false,
  p_points_awarded integer default 0,
  p_round_type text default 'trivia',
  p_team_id uuid default null,
  p_base_points integer default null,
  p_answer_type text default 'standard',
  p_server_grade boolean default false,
  p_question_id uuid default null,
  p_round_id uuid default null,
  p_question_sub_index integer default null,
  p_grading_status text default null,
  p_wager numeric default 1,
  p_score_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_player record;
  v_question record;
  v_round record;
  v_existing record;
  v_submission record;
  v_targets text[] := '{}';
  v_detail jsonb;
  v_has_options boolean;
  v_trusted_grader boolean := false;
  v_should_server_grade boolean := false;
  v_correct boolean;
  v_points integer := 0;
  v_base_points integer := 100;
  v_status text := 'pending';
  v_team_id uuid;
  v_score_metadata jsonb := '{}'::jsonb;
  v_streak integer := 0;
  v_multiplier numeric := 1;
  v_weight numeric := 1;
  v_accuracy numeric;
  v_rank numeric;
  v_name_like boolean := p_round_type in ('eyeconic', 'star_fusion', 'name_that_tune');
begin
  if p_event_id is null or p_player_id is null then
    raise exception 'Event and player are required';
  end if;
  if p_question_index is null or p_question_index < 0 then
    raise exception 'Invalid question index';
  end if;
  if length(coalesce(p_answer_value, '')) > 10000 or length(coalesce(p_answer_text, '')) > 10000 then
    raise exception 'Answer is too long';
  end if;

  select id, team_id, user_id
    into v_player
  from public.players
  where id = p_player_id and event_id = p_event_id and coalesce(is_active, true);
  if not found then raise exception 'Player not found in event'; end if;

  if auth.uid() is not null and v_player.user_id is not null and auth.uid() <> v_player.user_id then
    raise exception 'Player identity mismatch';
  end if;

  v_trusted_grader :=
    coalesce(auth.jwt()->>'role', '') = 'service_role'
    or exists (
      select 1 from public.events e
      where e.id = p_event_id and e.host_id = auth.uid()
    )
    or exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'admin'
    );

  -- Callers that are not an event host, platform admin, or service role may
  -- submit answer content only. Scoring, team attribution, and metadata are
  -- derived here and never accepted from the player request.
  v_team_id := case when v_trusted_grader then coalesce(p_team_id, v_player.team_id) else v_player.team_id end;
  v_score_metadata := case when v_trusted_grader then coalesce(p_score_metadata, '{}'::jsonb) else '{}'::jsonb end;

  select null::uuid as id, null::text[] as correct_answers,
         '{}'::jsonb as game_metadata, null::jsonb as options
    into v_question;
  select '{}'::jsonb as settings into v_round;

  if p_question_id is not null then
    select * into v_question
    from public.questions
    where id = p_question_id and event_id = p_event_id;
    if not found then raise exception 'Question not found in event'; end if;
  end if;

  if p_round_id is not null then
    select * into v_round
    from public.rounds
    where id = p_round_id and event_id = p_event_id;
    if not found then raise exception 'Round not found in event'; end if;
    if v_question.id is not null and v_question.round_id is distinct from p_round_id then
      raise exception 'Question does not belong to round';
    end if;
  end if;

  select * into v_existing
  from public.submissions
  where event_id = p_event_id and player_id = p_player_id
    and question_index = p_question_index and answer_type = p_answer_type
    and round_id is not distinct from p_round_id;
  if found and v_existing.grading_status = 'host_override' then
    return jsonb_build_object(
      'submission_id', v_existing.id,
      'is_correct', v_existing.is_correct,
      'points_awarded', v_existing.points_awarded,
      'grading_status', v_existing.grading_status,
      'preserved_override', true
    );
  end if;

  if v_trusted_grader and not p_server_grade then
    v_correct := p_is_correct;
    v_points := least(greatest(coalesce(p_points_awarded, 0), -10000), 10000);
    v_status := coalesce(nullif(p_grading_status, ''), 'host_override');
    v_base_points := least(greatest(coalesce(p_base_points, abs(v_points), 100), 0), 10000);
  else
    v_should_server_grade := v_question.id is not null;
    v_status := 'pending';
    v_correct := null;
    v_points := 0;

    if coalesce(v_question.game_metadata->>'points', '') ~ '^[0-9]{1,5}$' then
      v_base_points := least((v_question.game_metadata->>'points')::integer, 10000);
    elsif coalesce(v_round.settings->>'basePoints', '') ~ '^[0-9]{1,5}$' then
      v_base_points := least((v_round.settings->>'basePoints')::integer, 10000);
    else
      v_base_points := 100;
    end if;
  end if;

  if v_should_server_grade then
    v_targets := coalesce(v_question.correct_answers, '{}');
    if jsonb_typeof(v_question.game_metadata->'accepted_answers') = 'array' then
      v_targets := v_targets || array(select jsonb_array_elements_text(v_question.game_metadata->'accepted_answers'));
    end if;
    if jsonb_typeof(v_question.game_metadata->'acceptable_answers') = 'array' then
      v_targets := v_targets || array(select jsonb_array_elements_text(v_question.game_metadata->'acceptable_answers'));
    end if;

    if coalesce(array_length(v_targets, 1), 0) > 0 then
      v_has_options := jsonb_typeof(v_question.options) = 'array' and jsonb_array_length(v_question.options) > 0;
      v_detail := case
        when v_has_options then public.grade_options_answer_detail(p_answer_value, v_targets)
        else public.grade_text_answer_detail(p_answer_value, v_targets, v_name_like)
      end;
      v_correct := (v_detail->>'matched')::boolean;
      v_status := case
        when not v_correct and coalesce((v_detail->>'borderline')::boolean, false) then 'needs_review'
        else 'auto'
      end;
      v_points := case when v_correct then v_base_points else 0 end;
    end if;
  end if;

  if v_correct is true and coalesce((v_round.settings->>'streakEnabled')::boolean, false) then
    select count(*) into v_streak
    from public.submissions
    where player_id = p_player_id and round_id = p_round_id and is_correct is true;
    v_multiplier := least(1.5, 1 + (v_streak * 0.1));
  end if;
  if coalesce((v_round.settings->>'wagerEnabled')::boolean, false) then
    if v_correct is true then
      v_multiplier := v_multiplier * least(greatest(coalesce(p_wager, 1), 1), 3);
    elsif v_correct is false then
      v_points := -round(v_base_points * least(greatest(coalesce(p_wager, 1) - 1, 0), 2));
    end if;
  end if;
  if v_correct is true and coalesce((v_round.settings->>'difficultyBonusEnabled')::boolean, false) then
    select avg(case when is_correct then 1 else 0 end)::numeric into v_accuracy
    from public.submissions
    where event_id = p_event_id and question_id = p_question_id
      and grading_status in ('auto', 'host_override');
    v_points := v_points + round(v_base_points * least(0.25, greatest(0, 0.5 - coalesce(v_accuracy, 0.5))));
  end if;
  if coalesce((v_round.settings->>'catchUpEnabled')::boolean, false) then
    select ranked.rnk into v_rank
    from (
      select id, percent_rank() over (order by score desc) as rnk
      from public.players where event_id = p_event_id
    ) ranked where ranked.id = p_player_id;
    if coalesce(v_rank, 0) >= 0.5 then v_multiplier := v_multiplier * 1.25; end if;
  end if;
  v_points := round(v_points * v_multiplier);
  v_weight := coalesce((v_round.settings->>'weight')::numeric, 1);

  insert into public.submissions(
    event_id, player_id, team_id, round_id, question_id,
    question_index, question_sub_index, answer_value, answer_text, answer_type,
    is_correct, points_awarded, grading_status, grading_reason, score_metadata
  ) values (
    p_event_id, p_player_id, v_team_id, p_round_id, p_question_id,
    p_question_index, p_question_sub_index, p_answer_value, p_answer_text, p_answer_type,
    v_correct, v_points, v_status, v_detail->>'reason',
    v_score_metadata || jsonb_build_object(
      'streak', v_streak,
      'multiplier', v_multiplier,
      'round_weight', v_weight,
      'wager', least(greatest(coalesce(p_wager, 1), 1), 3),
      'trusted_grader', v_trusted_grader
    )
  )
  on conflict (event_id, coalesce(round_id, '00000000-0000-0000-0000-000000000000'::uuid), player_id, question_index, answer_type)
  do update set
    team_id = excluded.team_id,
    round_id = excluded.round_id,
    question_id = excluded.question_id,
    question_sub_index = excluded.question_sub_index,
    answer_value = excluded.answer_value,
    answer_text = excluded.answer_text,
    is_correct = excluded.is_correct,
    points_awarded = excluded.points_awarded,
    grading_status = excluded.grading_status,
    grading_reason = excluded.grading_reason,
    score_metadata = excluded.score_metadata
  where public.submissions.grading_status <> 'host_override'
  returning * into v_submission;

  return jsonb_build_object(
    'submission_id', v_submission.id,
    'is_correct', v_submission.is_correct,
    'points_awarded', v_submission.points_awarded,
    'grading_status', v_submission.grading_status,
    'grading_reason', v_submission.grading_reason,
    'server_graded', v_should_server_grade,
    'trusted_grader', v_trusted_grader,
    'streak', v_streak
  );
end;
$$;

revoke execute on function public.submit_answer(uuid, uuid, integer, text, text, boolean, integer, text, uuid, integer, text, boolean, uuid, uuid, integer, text, numeric, jsonb) from public;
grant execute on function public.submit_answer(uuid, uuid, integer, text, text, boolean, integer, text, uuid, integer, text, boolean, uuid, uuid, integer, text, numeric, jsonb) to anon, authenticated, service_role;
