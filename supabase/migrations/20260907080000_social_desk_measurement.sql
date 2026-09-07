-- Social desk measurement -------------------------------------------------
-- Roll up first-party funnel events into lifetime per-item counts so the
-- desk can show clicks + leads against what was actually posted.

alter table public.distribution_items add column if not exists engaged integer not null default 0 check (engaged >= 0);

create table if not exists public.social_measurement_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null,
  item_id uuid not null references public.distribution_items(id) on delete cascade,
  platform text not null,
  content_key text not null,
  visitors integer not null default 0 check (visitors >= 0),
  engaged integer not null default 0 check (engaged >= 0),
  leads integer not null default 0 check (leads >= 0),
  created_at timestamptz not null default now()
);
create unique index if not exists social_measurement_snapshots_item_date_idx on public.social_measurement_snapshots(item_id, snapshot_date);
create index if not exists social_measurement_snapshots_date_idx on public.social_measurement_snapshots(snapshot_date desc);

alter table public.social_measurement_snapshots enable row level security;
revoke all on table public.social_measurement_snapshots from public, anon, authenticated;
grant select, insert, update, delete on table public.social_measurement_snapshots to service_role;

create or replace function automation.refresh_social_measurement(p_date date default current_date)
returns jsonb language plpgsql security invoker set search_path=''
as $$
declare
  snapshot_count integer := 0;
  item_count integer := 0;
begin
  delete from public.social_measurement_snapshots s
  using public.distribution_items d
  where s.item_id = d.id and s.snapshot_date = p_date;

  -- Match funnel events to posts via the tracked link pieces the post carries
  -- (utm_content + utm_source + utm_campaign), so legacy holiday_YYYY_MM and
  -- the newer social_YYYY_MM campaigns never cross-attribute.
  insert into public.social_measurement_snapshots(snapshot_date, item_id, platform, content_key, visitors, engaged, leads)
  select
    p_date,
    d.id,
    d.utm_source,
    d.utm_content,
    count(distinct f.session_id) filter (where f.event_name = 'landing_page_viewed')::int,
    count(distinct f.session_id) filter (where f.event_name = 'page_engaged')::int,
    count(distinct f.session_id) filter (where f.event_name = 'lead_captured')::int
  from public.distribution_items d
  left join public.funnel_events f
    on f.utm_content = d.utm_content
   and f.utm_source = d.utm_source
   and f.utm_campaign = d.utm_campaign
   and f.occurred_at::date = p_date
  where d.utm_content is not null
  group by d.id;
  get diagnostics snapshot_count = row_count;

  -- Lifetime counters are recomputed from every stored snapshot so refreshing
  -- an earlier date retroactively repairs totals too.
  update public.distribution_items d
  set visitors = coalesce(agg.visitors, 0),
      leads = coalesce(agg.leads, 0),
      engaged = coalesce(agg.engaged, 0)
  from (
    select item_id, sum(visitors)::int visitors, sum(leads)::int leads, sum(engaged)::int engaged
    from public.social_measurement_snapshots
    group by item_id
  ) agg
  where agg.item_id = d.id;
  get diagnostics item_count = row_count;

  return jsonb_build_object('date', p_date, 'snapshots', snapshot_count, 'items_updated', item_count);
end;
$$;

-- Office calls PostgREST's public RPC surface. Keep the implementation in the
-- private automation schema and expose only this service-role wrapper.
create or replace function public.refresh_social_measurement(p_date date default current_date)
returns jsonb language sql security invoker set search_path=''
as $$select automation.refresh_social_measurement(p_date);$$;

revoke all on function public.refresh_social_measurement(date) from public, anon, authenticated;
grant execute on function public.refresh_social_measurement(date) to service_role;
revoke all on function automation.refresh_social_measurement(date) from public, anon, authenticated;
