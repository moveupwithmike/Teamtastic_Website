-- Trivana returns HTTP 403 to the read-only collector. Keep its history but
-- disable future checks, and replace it with an accessible digital private-
-- event game-show benchmark.
update public.family_competitor_sources
set enabled=false, updated_at=now()
where source_key='trivana-party-trivia';

insert into public.family_competitor_sources (source_key, name, public_url, audience) values
  ('family-feud-live-digital', 'Family Feud Live Digital', 'https://familyfeudlive.com/', 'family_private_events')
on conflict (source_key) do update set
  name=excluded.name,
  public_url=excluded.public_url,
  audience=excluded.audience,
  enabled=true,
  updated_at=now();
