update public.marketing_recommendations
set suggested_daily_budget_cents = 1000,
    test_days = 5,
    evidence = evidence || jsonb_build_object(
      'eddie_daily_budget_cents', 1000,
      'eddie_hard_daily_cap_cents', 1500,
      'maximum_planned_test_cost_cents', 7500
    )
where fingerprint in ('family-demand:google:reunion:v1', 'family-demand:google:long-distance:v1')
  and status = 'proposed';

insert into public.marketing_recommendations (
  recommendation_type, title, target_customer, occasion, platform,
  suggested_daily_budget_cents, test_days, proposed_keywords, proposed_audience,
  advertisement_text, creative_brief, landing_page, expected_result, reason,
  evidence, source_type, fingerprint
) values (
  'advertising',
  'Test family-party demand on Facebook and Instagram',
  'Adults planning a birthday, reunion, or long-distance family celebration',
  'Private family party',
  'Meta Ads — recommendation only',
  1000,
  7,
  '{}',
  'US adults interested in family celebrations, reunions, birthdays, trivia, and online games; Facebook and Instagram placements combined',
  'Your family can be miles apart and still share one unforgettable game night. Teamtastic hosts the whole live online game show for you.',
  'Use one approved, authentic multigenerational family image or short video. Show several homes laughing together on a video call; do not use an unapproved testimonial or a fake customer photograph.',
  '/virtual-family-game-night',
  'Measure qualified private-party inquiries and establish a first cost-per-lead baseline across Facebook and Instagram.',
  'Meta can create family demand before someone searches. Begin with one combined campaign so Facebook and Instagram share a single controlled budget.',
  jsonb_build_object(
    'baseline', 'not_yet_established',
    'eddie_daily_budget_cents', 1000,
    'eddie_hard_daily_cap_cents', 1000,
    'maximum_planned_test_cost_cents', 7000,
    'placements', jsonb_build_array('facebook', 'instagram')
  ),
  'family_demand_launch',
  'family-demand:meta:private-parties:v1'
)
on conflict (fingerprint) do nothing;
