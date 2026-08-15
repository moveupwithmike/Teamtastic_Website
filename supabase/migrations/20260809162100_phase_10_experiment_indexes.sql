create index growth_experiments_source_brief_idx on public.growth_experiments(source_brief_id) where source_brief_id is not null;
create index growth_experiments_next_experiment_idx on public.growth_experiments(next_experiment_id) where next_experiment_id is not null;
