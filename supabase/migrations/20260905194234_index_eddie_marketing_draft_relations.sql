create index if not exists marketing_asset_drafts_recommendation_idx
  on public.marketing_asset_drafts(recommendation_id)
  where recommendation_id is not null;

create index if not exists marketing_asset_drafts_deal_idx
  on public.marketing_asset_drafts(deal_id)
  where deal_id is not null;
