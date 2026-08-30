# Sales-Engine Hardening — Migration Verification & Launch Checklist

Applies to migrations (now applied to production under different registered version numbers
than the original local filenames — see note at the bottom):
- `inbound_reply_taxonomy_v2` (local file, renamed to match: `20260829180724_inbound_reply_taxonomy_v2.sql`)
- `payment_request_expiry_recovery` (local file, renamed to match: `20260829180742_payment_request_expiry_recovery.sql`)

## Status labels used below

- **[EXECUTED — VERIFIED]**: actually run, with captured output, against either a real local
  Postgres or production, this session or the one that fixed the confidence-floor bug.
- **[RUNBOOK — NOT YET EXECUTED]**: a query or step someone should run to check a specific
  fact; included for operator convenience, but not itself evidence anything was checked.

Do not read a RUNBOOK section as proof of anything until it has actually been run and its
real output recorded here.

## 1. Taxonomy applied correctly — [EXECUTED — VERIFIED, against production, 2026-08-29]

```sql
select pg_get_constraintdef(oid) from pg_constraint where conname = 'messages_classification_check';
```
Actual production result (captured this session):
```
CHECK (((classification IS NULL) OR (classification = ANY (ARRAY[
  'interested', 'not_interested', 'question', 'referral', 'pricing_request',
  'booking_request', 'objection', 'not_now', 'unsubscribe', 'out_of_office',
  'complaint', 'legal', 'unknown']))))
```
13 labels, matches exactly. Also verified this session: `first_replied_at` and
`first_response_minutes` columns exist on `public.leads`; `automation.mark_first_reply()`
exists.

**Correction to the original version of this document**: the constraint-drop step in the
migration originally searched for the existing constraint dynamically via
`pg_get_constraintdef(oid) ilike '%classification in (%'`. This **failed silently** the first
time it was actually applied to production — Postgres renders an `IN (...)` check constraint
internally as `= ANY (ARRAY[...])`, so the pattern never matched, the drop never ran, and the
subsequent `add constraint messages_classification_check` collided with the constraint already
there under that exact (default, deterministic) name. Fixed by dropping the constraint by its
known name directly (`drop constraint if exists messages_classification_check`), matching the
pattern already used elsewhere in this codebase (e.g. `deals_stage_check`). Confirmed working
on the second, corrected apply.

## 2. Behavioural spot-checks — [EXECUTED — VERIFIED, against a real local Postgres 16, not production]

The table below was originally written as a RUNBOOK (a plan of what *should* happen) before
being executed. It has since actually been run, and one row in the original version of this
document was **wrong** — the code did not yet match it. That code defect (not this table) was
the bug: `automation.handle_inbound_message()` computed a confidence-gated `is_hot` flag
correctly, but then updated `prospects.status` and `task_priority` using raw classification
membership instead of that flag — a low-confidence `interested`/`booking_request` was still
treated as hot. See `supabase/tests/hot-lead-confidence-floor-verification.md` for the full,
executed trace (5 scenarios, all passed, against the *fixed* trigger) and the boundary test
added to `src/lib/server/office/hot-lead.test.js` covering the exact values
0.74 / 0.7499 / 0.75 / 0.7501 / 0.95.

| Case | Insert classification | Expect | Status |
|---|---|---|---|
| Booking ask | `booking_request` @0.87 | task `Booking request: …` priority `urgent`, due `now()`; prospect → `interested`; agent_log outcome `hot` | EXECUTED — matches (Scenario D) |
| Pricing ask | `pricing_request` @0.82 | task `Pricing request: …` priority `high`, due `now()+2h`; prospect → `interested`; no suppression | Consistent with executed Scenario A/D pattern; not separately re-run under this exact label — RUNBOOK for a dedicated pricing_request case |
| Deferred | `not_now` @0.85 | task `Re-engage later: …` priority `normal`, due `now()+30d`, fingerprint `phase4:reengage:`; prospect NOT suppressed; suppression_list NOT written; agent_log `deferred` | RUNBOOK — not directly exercised in the confidence-floor scenario run (unaffected by that fix) |
| Absence | `out_of_office` @0.96 | NO new task; prospect.status unchanged; sequence enrollment NOT stopped; agent_log `absence_ignored` | RUNBOOK — unaffected by the confidence-floor fix, not separately re-run |
| Objection | `objection` @0.84 | task `Address objection: …` normal; no suppression | RUNBOOK |
| Referral | `referral` @0.86 | task `Record referral: …` fingerprint `phase4:referral:`; no suppression | RUNBOOK |
| Low confidence hot | `interested` @0.6 | NOT hot; review task only; prospect NOT set `interested` (stays `replied`) | **EXECUTED — matches (Scenario B), the exact case that was previously wrong before the fix** |
| Hard negative | `not_interested` @0.94 | no task; suppression_list row `manual`; prospect → `suppressed`; sequences stopped | RUNBOOK — behavior unchanged by this fix, not re-run |
| Unsubscribe | `unsubscribe` @0.99 | suppression_list row `unsubscribe`; prospect → `suppressed`; no task | RUNBOOK — behavior unchanged by this fix, not re-run |

Additionally executed and passed: high-confidence `interested` @0.90 (Scenario A), low-confidence
`booking_request` @0.55 (Scenario C, the same bug class on a different intent), and the exact
0.75 boundary (Scenario E, inclusive).

Duplicate insertion of the same message id → unique `(provider, provider_message_id)` guards it;
no duplicate task because fingerprint is fixed per message (`phase4:reply-escalation:<message.id>`).
**[RUNBOOK — NOT YET EXECUTED]**: not separately re-verified this session; unaffected by the
confidence-floor fix.

## 3. First-reply measurement — [RUNBOOK — NOT YET EXECUTED]

```sql
select id, name, email, created_at, first_replied_at, first_response_minutes from public.leads
where first_replied_at is not null order by created_at desc limit 20;
```
Column existence confirmed executed (section 1). The trigger's actual behavior on a real send
has not been separately exercised against production or a local harness this session.

## 4. Abandoned-checkout recovery (expiry migration) — [PARTIALLY EXECUTED]

**[EXECUTED — VERIFIED, against production]**: the cron job exists and is active.
```sql
select jobname, active, schedule from cron.job where jobname='expire-payment-requests';
-- actual result: active=true, schedule='*/10 * * * *'
```
**[RUNBOOK — NOT YET EXECUTED]**: the function's actual behavior on real `payment_requests`
rows (expiring stale ones, creating exactly one deduplicated task per abandoned lead, zero
emails sent) has not been exercised against production data this session — it will run for
real on its next scheduled tick. The local Postgres scenario coverage for this migration's SQL
logic in isolation (idempotent re-apply, no functional regression) predates this document and
was executed when the migration was first authored, not re-verified here.

## 5. Launch-enablement state — corrected, [EXECUTED — VERIFIED against production, 2026-08-29]

**This section was wrong in the original version of this document and is corrected here.**
The original text stated: *"Inbound reply ingestion is built but currently OFF in production."*
That was not true at the time it mattered — checked directly against production this session:

```sql
select master_enabled, gmail_ingestion_enabled, gmail_llm_classification_enabled
from public.system_config where id = true;
-- actual result: master_enabled=true, gmail_ingestion_enabled=true,
--                 gmail_llm_classification_enabled=false
select active, schedule from cron.job where jobname='gmail-reply-ingestion';
-- actual result: active=true, schedule='*/5 * * * *'
select status from public.mailbox_sync_state order by updated_at desc limit 1;
-- actual result: 'healthy'
```

**Gmail ingestion is live and has been for some time** — `master_enabled`, `gmail_ingestion_enabled`
are both `true`, the poller cron is active every 5 minutes, and the mailbox sync status is
`healthy`. `gmail_llm_classification_enabled` is `false`, so every inbound reply is currently
classified by the deterministic regex path only (`classifyHardStop` / `classifyFuzzyRegex`),
never the LLM. Zero inbound messages were received in the last 30–90 days (checked this
session), so this live pipeline has had no real-world exposure yet — but it is armed, not
dormant, and the confidence-floor bug in section 2 was a real, live defect for however long it
existed, not a theoretical one.

**Current deployed edge function** (`ingest-gmail-replies`, confirmed via direct inspection of
the live function source): still the **original 5-label classifier**
(`interested`/`not_interested`/`referral`/`question`/`unknown`) — the 9-label enhancement in
this repo's `index.ts` (adding `pricing_request`/`booking_request`/`objection`/`not_now` to the
regex/LLM classifier) has **not been redeployed**. This is a deliberate, disclosed choice, not
an oversight: the database migration (a bug fix to already-armed live logic) has been deployed;
the classifier enhancement (new capability, not a fix to broken behavior) has not, pending an
explicit decision — see the closure report's Production State Matrix.

Because the constraint now accepts 13 labels and the deployed classifier only ever emits 5 of
them, there is **no compatibility risk**: the deployed classifier's output remains a strict
subset of what the database will now accept.

Remaining steps if/when the classifier enhancement and/or LLM path are turned on:
1. Deploy the updated `supabase/functions/ingest-gmail-replies` (now refactored: pure
   classification logic lives in `supabase/functions/_shared/gmail-classification.ts`,
   covered by `supabase/tests/gmail-classification-injection-test.ts`).
2. If enabling the LLM path, confirm `ANTHROPIC_API_KEY` is set in the function's environment.
3. Flip `gmail_llm_classification_enabled = true` only after confirming (2).
4. Smoke-test with one real reply and confirm `mailbox_sync_state.status` stays `healthy` and
   the resulting `messages` row uses the new taxonomy correctly.

Verify against the JS contract: `src/lib/server/office/hot-lead.js` (`isHotIntent`, `ageBucketForDate`,
`INTENT_NEXT_ACTIONS`) and its tests hold the canonical definitions the SQL and the classifier mirror.
