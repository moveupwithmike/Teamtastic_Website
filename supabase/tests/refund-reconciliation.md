# Refund reconciliation — verification trace

Not part of the CI test suite (it needs a hand-built fixture schema standing in
for the tables `public.reconcile_stripe_refund` and
`public.record_hosted_event_cancellation` touch — see
`20260829120000_hosted_event_cancellation_and_refund_reconciliation.sql`). This
is a one-time verification record: the two functions' actual SQL bodies were
extracted from the migration and run against a real throwaway local Postgres
16 container (Docker, no Supabase project involved, destroyed after the run)
with minimal stand-in tables, to prove the logic — not just review it by eye.

Boundary-level policy math (`src/lib/cancellation-policy.js`) is covered by
real, CI-run vitest tests in `cancellation-policy.test.js`. Webhook-route
branching (which RPC gets called with which fields, for which event types) is
covered by CI-run vitest tests in `src/app/api/stripe/webhook/route.test.js`.
This trace covers the one layer those two can't reach on their own: the actual
Postgres aggregation, idempotency, and ordering logic inside the SQL functions.

## Scenarios run and result

| # | Scenario | Result |
|---|---|---|
| A | Full refund ($1,000 paid, $1,000 refunded) | PASSED — `refund_status='full'`, `amount_refunded=1000.00`, `net_revenue=0.00`, deal auto-`cancelled`, linked event `cancelled_at` set |
| B | Partial refund — the audit's exact worked example ($1,000 paid, 50% authorized → $500 refunded) | PASSED — `refund_status='partial'`, `amount_refunded=500.00`, `net_revenue=500.00`, stage **unchanged** (partial alone does not auto-cancel) |
| C | Multiple partial refunds on the same payment (two $300 refunds) | PASSED — summed correctly to `amount_refunded=600.00`, `net_revenue=400.00`; two distinct rows in `refunds`, not one overwritten row |
| D | Duplicate webhook delivery (identical event delivered twice) | PASSED — idempotent; `amount_refunded` stayed at 500.00 (not double-counted to 1000.00); exactly one `refunds` row |
| E | Out-of-order webhook delivery (a `succeeded` event arrives, then a stale `pending` event for the same refund arrives late) | PASSED — the stale event was rejected by the `last_stripe_event_created_at` guard; refund stayed `succeeded`, deal stayed `refund_status='full'` |
| F | Failed refund | PASSED — recorded with `status='failed'`, `failure_reason='insufficient_funds'`; deal financials/stage untouched (a failed refund refunded nothing) |
| G | Explicit cancellation via `record_hosted_event_cancellation` (not a Stripe event) | PASSED — deal moved to `cancelled` with `refund_eligible_percent`/`refund_eligible_amount` recorded, a manual-refund task created for the office; **no row was written to `refunds` and no Stripe call was made** — eligibility only, never an automatic refund |
| H | No-show, marked via the same RPC with `p_no_show := true` | PASSED — `deals.no_show`, `events.no_show_at`, `events.no_show_marked_by` all set; nothing in the schema sets these on a timer — only this explicit call does |

Command used (from repo root, after `docker run --rm -d -e POSTGRES_PASSWORD=test -p 5433:5432 postgres:16`):

```bash
docker exec teamtastic_refund_test psql -U postgres -f /refund_fixture.sql
docker exec teamtastic_refund_test psql -U postgres -f /refund_functions.sql   # extracted verbatim from the migration
docker exec teamtastic_refund_test psql -U postgres -f /refund_scenarios.sql   # DO blocks, RAISE EXCEPTION on any assertion failure
```

Full output ended with:

```
NOTICE:  SCENARIO A (full refund) PASSED
NOTICE:  SCENARIO B (partial refund, no auto-cancel) PASSED — matches the audit's worked example: $1,000 paid, 50% authorized -> $500 refunded, $500 net revenue
NOTICE:  SCENARIO C (multiple partial refunds, correctly summed and each individually recorded) PASSED
NOTICE:  SCENARIO D (duplicate webhook delivery is idempotent) PASSED
NOTICE:  SCENARIO E (out-of-order webhook delivery does not revert newer state) PASSED
NOTICE:  SCENARIO F (failed refund recorded, does not affect financials or stage) PASSED
NOTICE:  SCENARIO G (explicit cancellation establishes eligibility only, does not auto-refund) PASSED
NOTICE:  SCENARIO H (no-show is distinguishable and only set via explicit action) PASSED

=== ALL SCENARIOS PASSED ===
```

## What this does and doesn't prove

Proves: the SQL in the migration is syntactically valid, executes against a
real Postgres, and produces the correct aggregation/idempotency/ordering
behavior for all eight scenarios above.

Doesn't prove: that the migration applies cleanly against the actual
production schema (it wasn't run there — see the launch report's manual
verification list), or that RLS/grants behave correctly under the `anon`/
`authenticated` roles the fixture only stubbed out as empty roles. Both are
manual verification items, not gaps in the logic itself.
