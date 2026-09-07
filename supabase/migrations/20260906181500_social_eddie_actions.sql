-- Eddie gains tightly controlled social actions. The signed-action pipeline and
-- content-fingerprint confirmation guards already exist; this migration only
-- widens the closed action set and the marketing asset draft types so a social
-- plan can be saved for owner review.

alter table public.eddie_action_receipts drop constraint if exists eddie_action_receipts_action_type_check;
alter table public.eddie_action_receipts add constraint eddie_action_receipts_action_type_check check (action_type in (
  'create_task',
  'update_prospect_status',
  'create_response_draft',
  'send_response_draft',
  'create_marketing_experiment',
  'turn_research_into_task',
  'prepare_ad_campaign',
  'prepare_landing_page_content',
  'prepare_customer_proposal',
  'schedule_follow_up',
  'decide_recommendation',
  'set_ad_campaign_status',
  'prepare_social_plan',
  'create_social_post',
  'revise_social_post',
  'create_social_video',
  'approve_social_item',
  'schedule_social_item',
  'publish_social_item',
  'pause_scheduled_social_item',
  'prepare_comment_reply'
));

alter table public.marketing_asset_drafts drop constraint if exists marketing_asset_drafts_draft_type_check;
alter table public.marketing_asset_drafts add constraint marketing_asset_drafts_draft_type_check
  check (draft_type in ('advertising_campaign', 'landing_page_content', 'customer_proposal', 'social_plan'));