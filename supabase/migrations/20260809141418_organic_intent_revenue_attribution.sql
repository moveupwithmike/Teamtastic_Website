alter table public.organic_attribution
  add column if not exists booking_id uuid references public.bookings(id) on delete set null,
  add column if not exists payment_id uuid references public.deal_payments(id) on delete set null;

create index if not exists organic_attribution_prospect_idx on public.organic_attribution(prospect_id, occurred_at desc) where prospect_id is not null;
create index if not exists organic_attribution_deal_idx on public.organic_attribution(deal_id, occurred_at desc) where deal_id is not null;

create or replace function automation.capture_organic_deal_attribution()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare source_touch public.organic_attribution;
declare attribution_enabled boolean;
begin
  select organic_attribution_enabled into attribution_enabled from public.system_config where id = true;
  if not coalesce(attribution_enabled, false) or new.prospect_id is null then return new; end if;
  select * into source_touch from public.organic_attribution where prospect_id = new.prospect_id order by occurred_at asc limit 1;
  if source_touch.id is null then return new; end if;
  insert into public.organic_attribution(opportunity_id,draft_id,lead_id,prospect_id,deal_id,touch_type,landing_page,utm_source,utm_medium,utm_campaign,utm_content,fingerprint,occurred_at)
  values(source_touch.opportunity_id,source_touch.draft_id,source_touch.lead_id,new.prospect_id,new.id,'deal',source_touch.landing_page,source_touch.utm_source,source_touch.utm_medium,source_touch.utm_campaign,source_touch.utm_content,source_touch.opportunity_id::text || '|deal|' || new.id::text,coalesce(new.created_at,now()))
  on conflict (fingerprint) do nothing;
  return new;
end; $$;

create or replace function automation.capture_organic_booking_attribution()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare source_touch public.organic_attribution;
declare attribution_enabled boolean;
begin
  select organic_attribution_enabled into attribution_enabled from public.system_config where id = true;
  if not coalesce(attribution_enabled, false) or new.status not in ('confirmed','completed') then return new; end if;
  select * into source_touch from public.organic_attribution where (new.lead_id is not null and lead_id=new.lead_id) or prospect_id=new.prospect_id order by occurred_at asc limit 1;
  if source_touch.id is null then return new; end if;
  insert into public.organic_attribution(opportunity_id,draft_id,lead_id,prospect_id,deal_id,booking_id,touch_type,landing_page,utm_source,utm_medium,utm_campaign,utm_content,fingerprint,occurred_at)
  values(source_touch.opportunity_id,source_touch.draft_id,coalesce(new.lead_id,source_touch.lead_id),new.prospect_id,source_touch.deal_id,new.id,'booking',source_touch.landing_page,source_touch.utm_source,source_touch.utm_medium,source_touch.utm_campaign,source_touch.utm_content,source_touch.opportunity_id::text || '|booking|' || new.id::text,coalesce(new.confirmed_at,new.created_at,now()))
  on conflict (fingerprint) do nothing;
  return new;
end; $$;

create or replace function automation.capture_organic_revenue_attribution()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare source_touch public.organic_attribution;
declare attribution_enabled boolean;
begin
  select organic_attribution_enabled into attribution_enabled from public.system_config where id = true;
  if not coalesce(attribution_enabled, false) then return new; end if;
  select * into source_touch from public.organic_attribution where deal_id=new.deal_id order by occurred_at asc limit 1;
  if source_touch.id is null then return new; end if;
  insert into public.organic_attribution(opportunity_id,draft_id,lead_id,prospect_id,deal_id,payment_id,touch_type,landing_page,utm_source,utm_medium,utm_campaign,utm_content,revenue,fingerprint,occurred_at)
  values(source_touch.opportunity_id,source_touch.draft_id,source_touch.lead_id,source_touch.prospect_id,new.deal_id,new.id,'revenue',source_touch.landing_page,source_touch.utm_source,source_touch.utm_medium,source_touch.utm_campaign,source_touch.utm_content,new.amount,source_touch.opportunity_id::text || '|revenue|' || new.id::text,new.paid_at)
  on conflict (fingerprint) do nothing;
  return new;
end; $$;

drop trigger if exists deals_capture_organic_attribution on public.deals;
create trigger deals_capture_organic_attribution after insert or update of prospect_id on public.deals for each row execute function automation.capture_organic_deal_attribution();
drop trigger if exists bookings_capture_organic_attribution on public.bookings;
create trigger bookings_capture_organic_attribution after insert or update of status,prospect_id,lead_id on public.bookings for each row execute function automation.capture_organic_booking_attribution();
drop trigger if exists deal_payments_capture_organic_attribution on public.deal_payments;
create trigger deal_payments_capture_organic_attribution after insert on public.deal_payments for each row execute function automation.capture_organic_revenue_attribution();

revoke all on function automation.capture_organic_deal_attribution() from public,anon,authenticated;
revoke all on function automation.capture_organic_booking_attribution() from public,anon,authenticated;
revoke all on function automation.capture_organic_revenue_attribution() from public,anon,authenticated;
