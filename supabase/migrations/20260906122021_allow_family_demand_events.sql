-- Keep the database event allowlist aligned with the public route. These are
-- anonymous, consent-aware family funnel signals; they contain no form PII.
alter table public.funnel_events
  drop constraint if exists funnel_events_event_name_check;

alter table public.funnel_events
  add constraint funnel_events_event_name_check check (event_name in (
    'landing_page_viewed',
    'page_engaged',
    'concierge_modal_opened',
    'quiz_started',
    'lead_submit_attempted',
    'lead_captured',
    'lead_capture_failed',
    'pricing_cta_clicked',
    'deposit_cta_clicked',
    'booking_call_clicked',
    'holiday_checklist_downloaded',
    'free_game_clicked',
    'family_date_check_clicked',
    'family_trivia_preview_generated',
    'family_trivia_starter_unlocked'
  ));
