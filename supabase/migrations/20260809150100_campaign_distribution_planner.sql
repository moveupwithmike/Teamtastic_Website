alter table public.funnel_events add column if not exists utm_content text;

create table public.distribution_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  channel text not null check(channel in ('linkedin','newsletter','partner','community')),
  audience text not null,
  target_page text not null,
  body_text text not null,
  utm_source text not null,
  utm_medium text not null,
  utm_campaign text not null,
  utm_content text not null,
  tracked_url text not null,
  status text not null default 'draft' check(status in ('draft','approved','scheduled','published','rejected','archived')),
  scheduled_for timestamptz,
  published_at timestamptz,
  published_url text,
  visitors integer not null default 0,
  leads integer not null default 0,
  fingerprint text not null unique,
  decision jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index distribution_items_status_schedule_idx on public.distribution_items(status,scheduled_for);
create index distribution_items_campaign_idx on public.distribution_items(utm_source,utm_campaign,utm_content);
alter table public.distribution_items enable row level security;
revoke all on table public.distribution_items from public,anon,authenticated;
grant select,insert,update,delete on table public.distribution_items to service_role;
create trigger distribution_items_touch_updated_at before update on public.distribution_items
for each row execute function automation.touch_updated_at();

create or replace function automation.prepare_distribution_queue(p_month date default date_trunc('month',current_date)::date)
returns jsonb language plpgsql security invoker set search_path=''
as $$
declare created_count integer:=0;
begin
  insert into public.distribution_items(title,channel,audience,target_page,body_text,utm_source,utm_medium,utm_campaign,utm_content,tracked_url,fingerprint,decision)
  select v.title,v.channel,v.audience,v.target_page,v.body_text,v.channel,'organic_distribution',
    'holiday_'||to_char(p_month,'YYYY_MM'),v.content_key,
    'https://www.teamtastic.events'||v.target_page||'?utm_source='||v.channel||'&utm_medium=organic_distribution&utm_campaign=holiday_'||to_char(p_month,'YYYY_MM')||'&utm_content='||v.content_key,
    encode(extensions.digest(concat_ws('|','distribution',p_month,v.channel,v.content_key),'sha256'),'hex'),
    jsonb_build_object('generated_by','deterministic_campaign_planner','automatic_publishing',false)
  from (values
    ('Inclusive year-end celebrations','linkedin','People Ops and global team leaders','/virtual-year-end-team-celebration',
      'Planning a global year-end event without centering one holiday? Build the experience around team recognition, company awards, custom year-in-review trivia, and inclusive winter programming. Teamtastic handles the live hosting and production so organizers can participate too.','inclusive_year_end_people_ops'),
    ('Inclusive year-end planning note','newsletter','HR, People Ops, and executive assistants','/virtual-year-end-team-celebration',
      'A strong year-end celebration does not need Christmas-specific language. Recognition, custom company moments, friendly competition, and a clear 60-minute run of show can bring a global team together while keeping the program inclusive.','inclusive_year_end_newsletter'),
    ('Large holiday events without the chaos','linkedin','Event planners and People leaders planning for 75–300+ attendees','/virtual-holiday-party-for-large-groups',
      'Large virtual holiday events need more than a game link. The participation structure, team scoring, host permissions, production backup, customization, and run of show should all be settled before event day. Here is the planning framework we use for groups of 75–300+.','large_groups_people_ops'),
    ('Procurement-ready large event checklist','partner','Executive assistants, procurement teams, and event partners','/virtual-holiday-party-for-large-groups',
      'For a large virtual holiday event, confirm platform support, attendee flow, customization scope, accessibility, host backup, pricing, deposit schedule, and organizer responsibilities before approval. Teamtastic packages these details into a clear implementation plan.','large_groups_procurement'),
    ('December prime-time availability','linkedin','Corporate event organizers comparing holiday options','/virtual-holiday-party',
      'December prime-time dates fill quickly. If your team is considering a virtual holiday party, start with the date, time zone, group size, and decision timeline. Those four details make availability and package recommendations much faster.','holiday_availability'),
    ('A practical 60-minute holiday agenda','newsletter','Busy team organizers','/virtual-holiday-party',
      'A simple virtual holiday run of show: 5 minutes to welcome, 10 minutes to warm up, 35 minutes of hosted team competition, 5 minutes for recognition, and 5 minutes for winners and photos. The organizer should be able to join the fun instead of running production.','holiday_agenda')
  ) as v(title,channel,audience,target_page,body_text,content_key)
  on conflict(fingerprint) do nothing;
  get diagnostics created_count=row_count;
  return jsonb_build_object('prepared',true,'drafts_created',created_count,'automatic_publishing',false);
end; $$;

create or replace function automation.refresh_distribution_metrics()
returns jsonb language plpgsql security invoker set search_path=''
as $$
declare updated_count integer:=0;
begin
  update public.distribution_items d set
    visitors=(select count(distinct f.session_id) from public.funnel_events f where f.utm_source=d.utm_source and f.utm_campaign=d.utm_campaign and f.utm_content=d.utm_content),
    leads=(select count(distinct l.id) from public.leads l where l.utm_source=d.utm_source and l.utm_campaign=d.utm_campaign and l.utm_content=d.utm_content),
    updated_at=now()
  where d.status in ('approved','scheduled','published');
  get diagnostics updated_count=row_count;
  return jsonb_build_object('updated',updated_count);
end; $$;

create or replace function public.prepare_distribution_queue(p_month date default date_trunc('month',current_date)::date)
returns jsonb language sql security invoker set search_path=''
as $$select automation.prepare_distribution_queue(p_month);$$;
revoke all on function public.prepare_distribution_queue(date) from public,anon,authenticated;
grant execute on function public.prepare_distribution_queue(date) to service_role;
revoke all on function automation.prepare_distribution_queue(date),automation.refresh_distribution_metrics() from public,anon,authenticated;

do $job$
declare job_id bigint;
begin
  select jobid into job_id from cron.job where jobname='refresh-distribution-planner' limit 1;
  if job_id is not null then perform cron.unschedule(job_id); end if;
  perform cron.schedule('refresh-distribution-planner','40 11 * * *','select automation.prepare_distribution_queue(date_trunc(''month'',current_date)::date); select automation.refresh_distribution_metrics();');
end $job$;
