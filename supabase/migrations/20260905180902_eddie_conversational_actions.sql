-- One-time receipts make confirmed Eddie actions auditable and replay-safe.
-- The table is server-only: browser roles have no grants and RLS is enabled
-- as defense in depth.
create table public.eddie_action_receipts (
  id uuid primary key,
  actor_email text not null,
  action_type text not null check (action_type in (
    'create_task',
    'update_prospect_status',
    'create_response_draft',
    'send_response_draft'
  )),
  action_payload jsonb not null default '{}'::jsonb,
  status text not null default 'started' check (status in ('started', 'completed', 'failed')),
  result jsonb,
  error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index eddie_action_receipts_actor_idx
  on public.eddie_action_receipts(actor_email, created_at desc);

alter table public.eddie_action_receipts enable row level security;
revoke all on table public.eddie_action_receipts from public, anon, authenticated;
grant select, insert, update on table public.eddie_action_receipts to service_role;
