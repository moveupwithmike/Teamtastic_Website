-- Minimal production-derived surface needed by game_rpc_hardening.sql.
--
-- The tracked migration directory intentionally does not contain the legacy
-- production baseline, so a fresh local database cannot replay it end to end.
-- Keep this fixture narrow: it exists only to compile and exercise the four
-- game-RPC hardening migrations in an isolated CI database.

create table public.users (
  id uuid primary key references auth.users(id),
  email text,
  role text
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text,
  ai_credits_used integer default 0,
  ai_credits_limit integer
);

create table public.client_contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id),
  user_id uuid references auth.users(id),
  name text,
  email text,
  portal_role text
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  host_id uuid references auth.users(id),
  host_code text,
  status text,
  title text,
  event_type text
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id),
  name text
);

create table public.players (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id),
  user_id uuid references auth.users(id),
  team_id uuid references public.teams(id),
  name text,
  screen_name text,
  avatar_url text,
  avatar_emoji text,
  status text,
  score integer default 0
);

create table public.round_states (
  event_id uuid primary key references public.events(id),
  buzzer_queue jsonb default '[]'::jsonb,
  first_buzzer_id uuid,
  buzzer_time timestamptz,
  game_state jsonb default '{}'::jsonb,
  updated_at timestamptz default now()
);

create table public.rounds (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id),
  settings jsonb default '{}'::jsonb
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id),
  round_id uuid references public.rounds(id),
  correct_answers text[],
  game_metadata jsonb default '{}'::jsonb,
  options jsonb
);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id),
  player_id uuid references public.players(id),
  team_id uuid references public.teams(id),
  round_id uuid references public.rounds(id),
  question_id uuid references public.questions(id),
  question_index integer not null,
  question_sub_index integer,
  answer_value text,
  answer_text text,
  answer_type text not null,
  is_correct boolean,
  points_awarded integer,
  grading_status text,
  grading_reason text,
  score_metadata jsonb default '{}'::jsonb
);

create unique index submissions_answer_identity
  on public.submissions (
    event_id,
    coalesce(round_id, '00000000-0000-0000-0000-000000000000'::uuid),
    player_id,
    question_index,
    answer_type
  );

create function public.grade_options_answer_detail(text, text[])
returns jsonb language sql immutable as $$
  select '{"matched":false,"borderline":false,"reason":"fixture"}'::jsonb
$$;

create function public.grade_text_answer_detail(text, text[], boolean)
returns jsonb language sql immutable as $$
  select '{"matched":false,"borderline":false,"reason":"fixture"}'::jsonb
$$;

create function public.resolve_checkout_challenge_item(uuid, uuid, integer)
returns void language plpgsql as $$ begin null; end $$;

create function public.resolve_scribbles_giggles_reveal(uuid, uuid)
returns void language plpgsql as $$ begin null; end $$;
