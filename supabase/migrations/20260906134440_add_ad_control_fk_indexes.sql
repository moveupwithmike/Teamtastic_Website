create index advertising_campaign_controls_draft_idx
  on public.advertising_campaign_controls(marketing_asset_draft_id)
  where marketing_asset_draft_id is not null;

create index advertising_campaign_controls_recommendation_idx
  on public.advertising_campaign_controls(recommendation_id)
  where recommendation_id is not null;
