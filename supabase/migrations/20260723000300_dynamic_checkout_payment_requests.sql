create table public.payment_requests (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete set null,
  deal_id uuid references public.deals(id) on delete set null,
  proposal_id uuid references public.proposals(id) on delete set null,
  source text not null,
  payment_kind text not null check (payment_kind in ('deposit','balance','full_payment')),
  quoted_total_cents integer not null check (quoted_total_cents > 0),
  amount_due_now_cents integer not null check (amount_due_now_cents > 0),
  currency text not null default 'usd' check (currency = lower(currency) and length(currency) = 3),
  pricing_version text not null,
  pricing_inputs jsonb not null default '{}'::jsonb,
  public_token_hash text unique,
  fingerprint text not null unique,
  status text not null default 'active'
    check (status in ('active','checkout_created','paid','expired','cancelled','mismatch')),
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  expires_at timestamptz not null,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index payment_requests_lead_idx on public.payment_requests(lead_id,created_at desc);
create index payment_requests_proposal_idx on public.payment_requests(proposal_id) where proposal_id is not null;
create index payment_requests_active_expiry_idx on public.payment_requests(expires_at)
  where status in ('active','checkout_created');

alter table public.payment_requests enable row level security;
revoke all on table public.payment_requests from public,anon,authenticated;
grant select,insert,update,delete on table public.payment_requests to service_role;

alter table public.stripe_events
  add column if not exists payment_request_id uuid references public.payment_requests(id) on delete set null,
  add column if not exists payment_kind text;

create unique index stripe_events_payment_request_idx
  on public.stripe_events(payment_request_id)
  where payment_request_id is not null;
