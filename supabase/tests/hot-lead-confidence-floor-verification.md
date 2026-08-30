# Hot-lead confidence-floor fix — verification trace

Regression check for a real defect found during closure verification: `automation.handle_inbound_message()`
(in `20260830120000_inbound_reply_taxonomy_v2.sql`) computed `is_hot` with a confidence floor
(0.75, matching `src/lib/server/office/hot-lead.js`'s `HOT_MIN_CONFIDENCE`) but then ignored that
floor when setting `prospects.status` and `task_priority` — a low-confidence `interested` or
`booking_request` reply was still flipped to `status='interested'` and given a `high`/`urgent`
task, exactly the "aggressive automation on ambiguous input" the taxonomy's own header comment
says to avoid. The Office dashboard's "Hot replies" query had the same gap (no confidence filter
on `HOT_INTENTS`).

Fixed by making `is_hot` require the confidence floor for **all three** hot intents (previously
only `interested` was gated; `pricing_request`/`booking_request` were unconditionally hot), and
using `is_hot` — not raw classification membership — to drive both the status transition and the
task-priority escalation. The dashboard query now adds `.gte("classification_confidence",
HOT_MIN_CONFIDENCE)`.

This can't be exercised by vitest (it's a Postgres trigger), so it was verified against a real,
throwaway local Postgres 16 container the same way the refund-reconciliation migration was:
extracted the corrected function verbatim, applied it to a minimal fixture schema, and ran five
`DO` blocks that `RAISE EXCEPTION` on any assertion failure.

| # | Scenario | Result |
|---|---|---|
| A | High-confidence (0.90) `interested` | PASSED — `status='interested'`, `high`-priority task |
| B | Low-confidence (0.60) `interested` — the exact bug | PASSED — `status` stays `replied`, only a `normal`-priority review task, no `high`/`urgent` task created |
| C | Low-confidence (0.55) `booking_request` — same bug, other intent | PASSED — status stays `replied`, no `urgent` task |
| D | High-confidence (0.87) `booking_request` | PASSED — `status='interested'`, `urgent` task |
| E | Exactly at the 0.75 boundary | PASSED — inclusive boundary counts as hot |

```
=== ALL HOT-LEAD CONFIDENCE-FLOOR SCENARIOS PASSED ===
```

Container destroyed after the run. This migration has not been applied to production (confirmed
separately via `supabase_migrations.schema_migrations` — see the seasonal-engine and hot-lead
closure reports); the fix lives only in the local migration file pending that deployment decision.
