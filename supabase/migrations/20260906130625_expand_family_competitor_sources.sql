-- Add direct and substitute competitors that explicitly target birthdays,
-- reunions, friends, or family game nights. Research remains read-only and
-- findings still require owner review before Teamtastic changes anything.
insert into public.family_competitor_sources (source_key, name, public_url, audience) values
  ('trivana-party-trivia', 'Trivana Party Trivia', 'https://trivana.ai/use-cases/party-trivia', 'family_private_events'),
  ('naquel-personalized-game-shows', 'Na''Quel Games', 'https://www.naquelgames.com/', 'family_private_events'),
  ('fateround-virtual-game-night', 'FateRound', 'https://fateround.com/virtual-game-night', 'family_private_events'),
  ('family-game-night-app', 'Family Game Night', 'https://familygamenight.app/', 'family_private_events')
on conflict (source_key) do update set
  name=excluded.name,
  public_url=excluded.public_url,
  audience=excluded.audience,
  enabled=true,
  updated_at=now();
