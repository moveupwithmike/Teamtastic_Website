-- Cover the proposal-to-prospect foreign key used by the Office timeline.
create index if not exists proposals_prospect_idx
  on public.proposals(prospect_id, created_at desc)
  where prospect_id is not null;
