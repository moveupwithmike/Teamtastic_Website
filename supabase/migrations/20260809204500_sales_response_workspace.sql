-- Phase 9: human-approved response workspace and immutable edit record.
create table public.sales_response_drafts (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  prospect_id uuid references public.prospects(id) on delete set null,
  deal_id uuid references public.deals(id) on delete set null,
  response_type text not null check(response_type in ('availability','discovery_call','proposal','deposit_request')),
  recipient_email text not null,
  recommended_package text not null,
  subject text not null,
  generated_body text not null,
  body_text text not null,
  status text not null default 'draft' check(status in ('draft','sending','sent','send_failed','rejected')),
  capacity_snapshot jsonb not null default '{}'::jsonb,
  generated_by text not null,
  approved_by text,
  approved_at timestamptz,
  provider_message_id text,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index sales_response_drafts_review_idx on public.sales_response_drafts(status,created_at desc);
create index sales_response_drafts_lead_idx on public.sales_response_drafts(lead_id,created_at desc);
create table public.sales_response_revisions(
  id bigint generated always as identity primary key,
  response_id uuid not null references public.sales_response_drafts(id) on delete cascade,
  revision_type text not null check(revision_type in ('generated','approved_edit','sent','failed')),
  subject text,
  body_text text,
  actor text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index sales_response_revisions_response_idx on public.sales_response_revisions(response_id,created_at);
alter table public.sales_response_drafts enable row level security;
alter table public.sales_response_revisions enable row level security;
revoke all on table public.sales_response_drafts,public.sales_response_revisions from public,anon,authenticated;
revoke all on sequence public.sales_response_revisions_id_seq from public,anon,authenticated;
grant select,insert,update,delete on table public.sales_response_drafts,public.sales_response_revisions to service_role;
grant usage,select on sequence public.sales_response_revisions_id_seq to service_role;
create trigger sales_response_drafts_touch_updated_at before update on public.sales_response_drafts for each row execute function automation.touch_updated_at();
