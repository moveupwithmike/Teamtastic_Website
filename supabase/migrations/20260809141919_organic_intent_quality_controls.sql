update public.organic_sources
set config = jsonb_build_object(
  'queries', jsonb_build_array(
    '"virtual team building" recommendation',
    '"corporate holiday party" recommendation',
    '"remote team event" ideas',
    '"year end team celebration" virtual',
    '"large group" virtual holiday event'
  ),
  'excluded_terms', jsonb_build_array('school','students','birthday','wedding','family reunion','nsfw'),
  'blocked_communities', '[]'::jsonb,
  'minimum_capture_score', 45,
  'maximum_post_age_days', 30
), updated_at = now()
where source_key = 'reddit-approved-api';
