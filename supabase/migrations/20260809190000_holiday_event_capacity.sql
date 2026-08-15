-- Phase 6: holiday event capacity, expiring holds, and availability checks.

create table public.event_capacity_hosts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null default 'America/New_York',
  active boolean not null default true,
  max_concurrent_events integer not null default 1 check (max_concurrent_events between 1 and 20),
  weekly_availability jsonb not null default '{"monday":[{"start":"09:00","end":"18:00"}],"tuesday":[{"start":"09:00","end":"18:00"}],"wednesday":[{"start":"09:00","end":"18:00"}],"thursday":[{"start":"09:00","end":"18:00"}],"friday":[{"start":"09:00","end":"18:00"}],"saturday":[],"sunday":[]}'::jsonb,
  blocked_dates jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.event_capacity_hosts(name)
select 'Primary Teamtastic host'
where not exists (select 1 from public.event_capacity_hosts);

create table public.event_capacity_holds (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.event_capacity_hosts(id) on delete restrict,
  lead_id uuid references public.leads(id) on delete set null,
  prospect_id uuid references public.prospects(id) on delete set null,
  deal_id uuid references public.deals(id) on delete set null,
  event_id uuid references public.events(id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'tentative' check (status in ('tentative','confirmed','released','expired')),
  expires_at timestamptz,
  note text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (status <> 'tentative' or expires_at is not null)
);

create index event_capacity_holds_overlap_idx on public.event_capacity_holds(host_id,starts_at,ends_at)
  where status in ('tentative','confirmed');
create index event_capacity_holds_deal_idx on public.event_capacity_holds(deal_id,created_at desc);
create index event_capacity_holds_lead_idx on public.event_capacity_holds(lead_id,created_at desc);

create or replace function public.check_event_capacity(
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_host_id uuid default null,
  p_exclude_hold_id uuid default null
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_host public.event_capacity_hosts%rowtype;
  v_holds integer := 0;
  v_events integer := 0;
  v_local_start timestamp;
  v_day text;
  v_windows jsonb;
  v_in_window boolean := false;
  v_blocked boolean := false;
  v_prime boolean := false;
begin
  if p_starts_at is null or p_ends_at is null or p_ends_at <= p_starts_at then
    return jsonb_build_object('available',false,'reason','invalid_window');
  end if;
  select * into v_host from public.event_capacity_hosts
  where active and (p_host_id is null or id=p_host_id)
  order by created_at limit 1;
  if v_host.id is null then return jsonb_build_object('available',false,'reason','no_active_host'); end if;

  v_local_start := p_starts_at at time zone v_host.timezone;
  v_day := lower(trim(to_char(v_local_start,'Day')));
  v_windows := coalesce(v_host.weekly_availability->v_day,'[]'::jsonb);
  select exists(select 1 from jsonb_array_elements(v_windows) w
    where v_local_start::time >= (w->>'start')::time
      and (p_ends_at at time zone v_host.timezone)::date = v_local_start::date
      and (p_ends_at at time zone v_host.timezone)::time <= (w->>'end')::time)
    into v_in_window;
  v_blocked := v_host.blocked_dates ? v_local_start::date::text;

  select count(*) into v_holds from public.event_capacity_holds h
  where h.host_id=v_host.id and h.id is distinct from p_exclude_hold_id
    and h.status in ('tentative','confirmed')
    and (h.status='confirmed' or h.expires_at>now())
    and h.starts_at<p_ends_at and h.ends_at>p_starts_at;
  select count(*) into v_events from public.events e
  where e.scheduled_start_time is not null
    and e.scheduled_start_time<p_ends_at
    and e.scheduled_start_time+interval '90 minutes'>p_starts_at
    and (e.status is null or e.status::text not in ('completed','cancelled'));

  v_prime := extract(month from v_local_start)=12
    and extract(isodow from v_local_start) between 1 and 5
    and v_local_start::time >= time '12:00' and v_local_start::time < time '18:00';
  return jsonb_build_object(
    'available',v_in_window and not v_blocked and (v_holds+v_events)<v_host.max_concurrent_events,
    'reason',case when v_blocked then 'blocked_date' when not v_in_window then 'outside_host_hours' when (v_holds+v_events)>=v_host.max_concurrent_events then 'capacity_reached' else 'available' end,
    'host_id',v_host.id,'host_name',v_host.name,'timezone',v_host.timezone,
    'max_concurrent',v_host.max_concurrent_events,'active_holds',v_holds,'scheduled_events',v_events,
    'remaining_capacity',greatest(0,v_host.max_concurrent_events-v_holds-v_events),
    'december_prime_time_risk',v_prime
  );
end $$;

create or replace function public.expire_event_capacity_holds() returns integer
language plpgsql security invoker set search_path = '' as $$
declare v_count integer;
begin
  update public.event_capacity_holds set status='expired',updated_at=now()
  where status='tentative' and expires_at<=now();
  get diagnostics v_count=row_count;
  return v_count;
end $$;

alter table public.event_capacity_hosts enable row level security;
alter table public.event_capacity_holds enable row level security;
revoke all on table public.event_capacity_hosts,public.event_capacity_holds from anon,authenticated;
grant select,insert,update,delete on table public.event_capacity_hosts,public.event_capacity_holds to service_role;
revoke execute on function public.check_event_capacity(timestamptz,timestamptz,uuid,uuid) from public,anon,authenticated;
revoke execute on function public.expire_event_capacity_holds() from public,anon,authenticated;
grant execute on function public.check_event_capacity(timestamptz,timestamptz,uuid,uuid) to service_role;
grant execute on function public.expire_event_capacity_holds() to service_role;

do $$ begin
  if exists(select 1 from pg_extension where extname='pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname='expire-event-capacity-holds';
    perform cron.schedule('expire-event-capacity-holds','*/5 * * * *','select public.expire_event_capacity_holds()');
  end if;
end $$;
