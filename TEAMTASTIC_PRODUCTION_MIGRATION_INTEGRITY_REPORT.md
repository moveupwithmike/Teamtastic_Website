# Teamtastic Production Migration Integrity Report

**Date:** 2026-08-29
**Scope:** Verify whether production actually contains the objects `20260825120000_launch_certification_policy_v62.sql` (~71 KB, the migration `register_migration_once.mjs` was created to register) was intended to create — given the registration script itself never executes SQL.
**Method:** Independent, read-only production introspection via the Supabase Management API (`/database/query` as postgres) executed fresh for this report; full reads of the migration file and registration script; repo-wide reference search; stored-ledger-vs-file digest comparison; and an actual fresh-environment harness run against a live production schema dump. **No schema was altered, no migration replayed, and no repair was run to produce this report.**

---

## Executive Summary

**Production contains every object this migration was intended to create, and every one matches character-for-character and can be executed live.** This report is based on a direct, object-by-object comparison against the live database (project `cutcpkegxwhnafrvfbcd`), not on the ledger or on trust in the registration script:

- All **15 functions** exist with exact signatures in the correct schemas, with exactly the intended ACLs (postgres + `service_role` only; `public`/`anon`/`authenticated` revoked).
- Both **views** exist, are real views (`relkind='v'`), expose the intended column lists, and **execute correctly** (23 certification gates; 3 launch-phase milestones).
- The **table** exists with the intended 11 columns, RLS enabled, and the exact grant asymmetry (service_role `SELECT` only, no `INSERT`).
- Both **triggers** exist with exact definitions; both **constraint** definitions are byte-identical to the migration source.
- The **cron job** exists with the exact schedule and command.
- All **data-migration side effects** match: 4 drafts retired with the v6.2 marker, 9 classification rows (4 Apollo → `research_seed`, 5 QA artifacts → `test_qa`) carrying `actor = 'migration:20260825120000_launch_certification_policy'`, and 3 `agent_log` audit rows.
- Live behavioral proof: `transition_b2b_launch('enable_scale', …)` against the currently `inbound_pilot` phase **failed closed** (`changed=false`, `launch_readiness_blocked`), i.e., the v6.2 phase-authority logic is genuinely enforced in production; `sales_lifecycle_reference()` and `post_launch_milestone_summary()` both return real v6.2 data.

`register_migration_once.mjs` registers a ledger row only and never executes SQL. It is dangerous **by construction**, but there is no evidence it was misused: the ledger's stored SQL for this migration is **byte-identical** (SHA-256 match) to the migration file, and the schema it describes is fully present and live. The residual risk is entirely procedural (see Guardrails).

---

## Migration Identified

| Field | Value |
|---|---|
| Filename | `supabase/migrations/20260825120000_launch_certification_policy_v62.sql` |
| Version | `20260825120000` |
| Size | 71,661 bytes / 1,382 lines |
| In-prod ledger | Version `20260825120000`, name `launch_certification_policy_v62`, registered exactly once |
| Purpose | Corrects a circular launch-certification policy: a real post-launch customer journey previously blocked the start of controlled outbound; a brand-new sales motion could never satisfy it. Decouples that requirement so it gates progression from controlled *pilot* → controlled *scale* instead of the pilot's start. Introduces `research_seed` classification, sales-lifecycle derivation, the append-only post-launch milestone subsystem, and the 7-phase (incl. `controlled_scale`) launch lifecycle. |
| Depends on earlier migrations | Yes — `launch_readiness_watchlist`, `b2b_phase1_certification`, `controlled_launch_workflow`, `final_production_certification`, `complete_final_certification_evidence`, `final_certification_indexes`, `final_certification_attestations`, `enforce_complete_launch_readiness`, `manual_certification_operator_controls`, `classification_aware_launch_readiness` (all confirmed present in the live ledger/schema and confirmed executing via fresh-environment harness). |
| Later migrations depending on it | **None.** 19 migrations registered after `20260825120000` (`20260826031617` … `20260829140525`) are game-platform/host-lifecycle work. A stored-SQL scan of every one of them found **zero references** to any object this migration creates. The single after-this in-repo migration (`hosted_event_cancellation_and_refund_reconciliation`) also references zero v6.2 objects. |

### What the migration does, by group

- **Tables:** `public.launch_phase_milestones` (append-only, RLS-enabled, service_role SELECT-only) — records each launch milestone exactly once with a frozen lineage snapshot.
- **Views:** `public.final_certification_gate_status` (per-gate satisfaction for the 23 pre-launch gates), `public.launch_phase_milestone_state` (live-revalidated milestone read model).
- **Constraints:** widens `production_record_classifications.classification` to add `research_seed`; widens `b2b_launch_state.phase` to the 7-phase set incl. `controlled_scale`; adds the 3-value `milestone_key` check.
- **RPC/functions (15):** sales-lifecycle reference/derivation (`sales_lifecycle_reference`, `derive_sales_lifecycle_stage`), trusted promotion (`promote_research_seed_to_production`), post-launch journey detector + observers (`first_production_customer_journey`, `observe_post_launch_milestones`, `post_launch_milestone_summary`), certification machinery (`final_certification_gate_requirements`, `enforce_final_certification_completion`, `sign_off_final_production_certification`, `observe_final_production_certifications`), phase transition (`transition_b2b_launch`), and guards (`enforce_manual_gate_lineage`, `enforce_outreach_draft_lifecycle`, `protect_launch_milestones`, `record_affects_production_readiness`).
- **Triggers:** `launch_phase_milestones_immutable` (blocks UPDATE/DELETE), `outreach_drafts_lifecycle_guard` (blocks retired-draft reactivation; blocks approving drafts for non-production prospects).
- **Grants:** every new function `revoke all from public, anon, authenticated` + `grant execute to service_role`; the table `revoke all` (incl. service_role) then `grant select` to service_role only — writes only via `SECURITY DEFINER` functions.
- **Cron:** `launch-phase-milestone-monitor`, `*/15 * * * *`, calls `automation.observe_post_launch_milestones()`.
- **Data migrations:** retire 4 pre-architecture July drafts; classify 4 Apollo discoveries → `research_seed` and 5 legacy QA artifacts → `test_qa` (both idempotent via `not exists` guards); refresh launch readiness.
- **Certification/launch-readiness metadata:** the whole migration is this subsystem; seventh in the self-certifying readiness chain.

---

## How `register_migration_once.mjs` Works

Full file read (`supabase/tests/register_migration_once.mjs`, 41 lines):

1. Reads `SUPABASE_ACCESS_TOKEN` from `.env.local` (account-wide Supabase Management API token).
2. Queries `supabase_migrations.schema_migrations` for `version = '20260825120000'`. If present, prints and exits — written to run at most once.
3. If absent, reads the migration file's raw text and **INSERTs a row directly** into `schema_migrations(version, name, statements)` with the entire file as a single-element text array.
4. **It never executes that SQL.** `INSERT INTO schema_migrations` is pure CLI-ledger bookkeeping; it does not create/alter schema objects.
5. Prints the 3 newest ledger rows and exits.

**Answers:**
- Executes migration SQL? **No.**
- Only inserts migration history? **Yes**, exactly and only that.
- Safeguards? One — won't double-register the same version. No rollback, dry-run, confirmation, or post-write verification.
- Could it claim a migration ran when it didn't? **Yes, unconditionally** — nothing checks reality before writing.
- Why created? Its header comment: "Registers migration 20260825120000 exactly once in the production ledger." One specific bookkeeping problem for one migration.
- Referenced elsewhere? **No.** `grep` across `package.json`, workflows, docs, and full repo (excluding node_modules/.git) finds it only in itself and in these audits. It is a standalone, manually-invoked, one-off tool with zero automated exposure.

**Classification: DANGEROUS (by design).** Capable of exactly the failure mode under investigation. It was not misused in this instance (evidence below), but that is a property of how it was used, not of the script.

### Evidence it was not misused for THIS migration

1. **Ledger content is the real migration.** The `statements[1]` stored in production is **byte-identical** to the local file: both SHA-256 `b6a1168ad7254a66b7db17937dcab576624823577693d1d2ab1b012ed8cb75a8`, both 71,659 chars. The ledger thus holds exactly this migration's full SQL text.
2. **The schema it describes exists and executes.** Every object verified present below, plus live RPC calls (`enable_scale` fail-closed, lifecycle reference, milestone summary) prove the functions run and enforce v6.2 semantics.
3. **Fresh-environment harness passes against a real pre-v6.2 production dump.** Restored the Aug-24 production schema, applied the 4-migration chain ending in v6.2 twice (idempotency), ran 3 regression suites (19+64+20 assertions) and 3 concurrency races — all PASSED, zero errors touching CRM/certification objects. The migration is a real, runnable, idempotent SQL file.
4. **The logical explanation:** prior session applied this migration directly to production (the CLI can't push a migration whose version isn't a sequential successor), then used the script to repair the ledger bookkeeping afterward. The ledger row is the last, administrative step — not a substitute for execution.

---

## Expected Production State (Checklist)

| # | Expected object | Type |
|---|---|---|
| 1 | `automation.record_affects_production_readiness(text, uuid)` | RPC |
| 2 | `automation.sales_lifecycle_reference()` | RPC |
| 3 | `automation.derive_sales_lifecycle_stage(uuid)` | RPC |
| 4 | `automation.promote_research_seed_to_production(uuid, text, text, jsonb)` | RPC |
| 5 | `public.final_certification_gate_requirements()` | RPC |
| 6 | `automation.enforce_manual_gate_lineage()` | RPC (trigger fn) |
| 7 | `automation.enforce_final_certification_completion()` | RPC (trigger fn) |
| 8 | `public.sign_off_final_production_certification(uuid, text)` | RPC |
| 9 | `automation.observe_final_production_certifications()` | RPC |
| 10 | `automation.protect_launch_milestones()` | RPC (trigger fn) |
| 11 | `automation.first_production_customer_journey()` | RPC |
| 12 | `automation.observe_post_launch_milestones()` | RPC |
| 13 | `automation.post_launch_milestone_summary()` | RPC |
| 14 | `public.transition_b2b_launch(text, text, text default null, integer default 5)` | RPC |
| 15 | `automation.enforce_outreach_draft_lifecycle()` | RPC (trigger fn) |
| 16 | `public.final_certification_gate_status` | View (23 cols) |
| 17 | `public.launch_phase_milestone_state` | View (17 cols) |
| 18 | `public.launch_phase_milestones` (11 cols, RLS on, service_role SELECT-only) | Table |
| 19 | Trigger `launch_phase_milestones_immutable` (BEFORE UPDATE OR DELETE) | Trigger |
| 20 | Trigger `outreach_drafts_lifecycle_guard` (BEFORE INSERT OR UPDATE) | Trigger |
| 21 | Constraint `production_record_classifications_classification_check` incl. `research_seed` | Constraint |
| 22 | Constraint `b2b_launch_state_phase_check` incl. all 7 phases | Constraint |
| 23 | Constraint `launch_phase_milestones_milestone_key_check` (3 values) | Constraint |
| 24 | Cron `launch-phase-milestone-monitor` `*/15 * * * *` | Cron |
| 25 | 4 `outreach_drafts` retired with v6.2 marker in `approval_notes` | Data |
| 26 | 9 `production_record_classifications` rows, `actor='migration:20260825120000…'` (4 research_seed + 5 test_qa) | Data |
| 27–29 | `agent_log` rows for `retire_pre_architecture_drafts`, `classify_apollo_research_seeds`, `classify_legacy_qa_artifacts` | Data (audit) |

Function ACLs (all 15): postgres + service_role EXECUTE only, anon/authenticated/public revoked.

---

## Actual Production State

Live read-only comparison (Management API `/database/query`, project `cutcpkegxwhnafrvfbcd`):

| Check | Result |
|---|---|
| 15 RPCs in correct schema w/ exact signatures | **PRESENT AND MATCHES** (all 15) |
| Views exist (`relkind='v'`), column sets | **PRESENT AND MATCHES** (23 / 17 cols, correct names) |
| Table exists, 11 cols, `relrowsecurity=true`, ACL `{postgres=arwdDxtm, service_role=r}` | **PRESENT AND MATCHES** |
| Table grants: only postgres + service_role(SELECT) | **PRESENT AND MATCHES** |
| `launch_phase_milestones_immutable` | **PRESENT AND MATCHES** `BEFORE DELETE OR UPDATE … protect_launch_milestones()` |
| `outreach_drafts_lifecycle_guard` | **PRESENT AND MATCHES** `BEFORE INSERT OR UPDATE … enforce_outreach_draft_lifecycle()` |
| `classification_check` definition | **PRESENT AND MATCHES** (byte-identical, incl. `research_seed`) |
| `b2b_launch_state_phase_check` definition | **PRESENT AND MATCHES** (byte-identical, all 7 phases) |
| `launch_phase_milestones_milestone_key_check` | **PRESENT AND MATCHES** (byte-identical, 3 keys) |
| Cron job + schedule + command | **PRESENT AND MATCHES** |
| 15 function ACLs | **PRESENT AND MATCHES** (postgres + service_role only) |
| 4 retired drafts w/ v6.2 marker note | **PRESENT AND MATCHES** (`id`s `88bb444f…`, `02a0afa1…`, `d1c278af…`, `34db13f7…`) |
| 9 classification rows, migration actor | **PRESENT AND MATCHES** (4 prospect→research_seed; 5→test_qa: 2 client, 1 deal, 1 lead, 1 prospect) |
| 3 `agent_log` v6.2 rows | **PRESENT AND MATCHES** |
| Behavioral: `transition_b2b_launch('enable_scale',…)` fails closed | **PRESENT AND MATCHES** (`changed=false`, `launch_readiness_blocked`) |
| Behavioral: `sales_lifecycle_reference()` | **PRESENT AND MATCHES** (returns 7 rows) |
| Behavioral: `post_launch_milestone_summary()` | **PRESENT AND MATCHES** (returns 3 keys) |

**Every checklist item is PRESENT AND MATCHES. Zero MISSING, zero PRESENT BUT DIFFERS, zero UNKNOWN.**

---

## Differences Found

**None** for the target migration. The ledger's stored SQL and the schema it describes are both present and correct.

Two adjacent, out-of-scope observations (pre-existing, not caused by this migration, and **not** part of its object set):

1. **Whole-directory version drift:** essentially every local migration file is registered in the prod ledger under a *different* version (e.g., local `20260823192406_enforce_complete_launch_readiness.sql` is registered as `20260824172836`; local `20260809155600_launch_readiness_watchlist.sql` is registered as `20260809154937`). For the two spot-checked cases the stored SQL is **byte-identical** to the local file (renames, not divergences). This was previously flagged.
2. **Newest migration content drift:** `hosted_event_cancellation_and_refund_reconciliation` is registered as `20260829140525` and its stored SQL diverges from the local file (`20260829120000_…`, 20,119 vs 20,809 chars — they share a 9,048-char prefix then differ). This one is a *content* mismatch, not just a rename, and should be investigated on its own before any `db push`.

---

## Application Dependencies

Grepped `src/` and `supabase/functions/` for every object this migration creates:

| File | Usage | Classification |
|---|---|---|
| `src/lib/server/office/launch.js:17` | RPC `transition_b2b_launch` (exact signature match) | **IMPORTANT** |
| `src/lib/server/office/launch.test.js` | Unit-test stub of the same RPC | **IMPORTANT** (test) |
| `src/lib/server/office/certification.js:67,69` | RPCs `observe_final_production_certifications`, `sign_off_final_production_certification` | **IMPORTANT** |
| `src/app/office/(private)/final-certification/page.js:15-16` | Reads `final_certification_gate_status`, `launch_phase_milestone_state` | **IMPORTANT** |
| `src/app/office/(private)/launch/page.js:31` | Reads `launch_phase_milestone_state` | **IMPORTANT** |
| `src/app/office/(private)/activation/page.js:8` | Reads `b2b_launch_state`, `launch_phase_milestone_state`, gates preflight | **IMPORTANT** |
| `supabase/functions/process-apollo-enrichment/index.ts:125-131` | Writes `research_seed` classification (v6.2 semantic dependency) | **IMPORTANT** |
| `supabase/functions/send-approved-outreach/index.ts:38` | Comment-level reference; relies on retired-draft terminal trigger | **NON-CRITICAL** |
| `supabase/tests/lead-notifications-test.ts:55` | Test relating to `record_affects_production_readiness` | **NON-CRITICAL** (test) |

**No customer-facing path — booking, payments, lead capture, Stripe webhook, CRM sync, analytics, or email automation — calls into this migration's objects.** Every consumer is either authenticated `/office` admin tooling (requires `requireOfficeUser()`) or the internal certification/launch subsystem itself. By design, this system governs *when* outbound sales automation may be enabled — not how a booking or payment is processed.

---

## Risk Classification

**P2 — internal/operational process risk; no schema discrepancy and no customer-facing exposure.**

- Not P0/P1: every object exists, is definition-correct, and is exercised live; nothing is missing or divergent; no transaction, security, payment, or lead-capture path depends on these objects.
- P2 precisely because `register_migration_once.mjs` is a ledger-writer with no execution guarantee and no verification — a real hazard for a *future* mishandled migration, even though harmless today. It sits in `supabase/tests/`, implying test-safety, and reads an account-wide token. That is a genuine operational liability awaiting the next carelessness.

---

## Recommended Remediation

**A. NO ACTION NEEDED on the schema.** Production matches expected state in full. Rerunning the migration is unnecessary (and not advised live). Every DDL statement in it is idempotent, but harmless ≠ needed.

**Process remediation (guardrails)** is the actual fix — recommended below, none applied this session (verification-only).

---

## Fresh Database Verification

**Performed and PASSED this session**, directly answering the "prior reviews uncovered migrations that pass on existing DBs but fail fresh" concern:

```
docker postgres:17-alpine
  restore real production schema dump (20260824, post-`enforce_complete_launch_readiness`, pre-v6.2)
    481 restore errors → all extension/auth-schema/game-platform (unavailable in vanilla container); ZERO CRM/cert objects
  apply 4-migration chain incl. this migration     → OK
  re-apply same chain (idempotency check)         → OK
  regression: launch_phase_policy                 → ALL ASSERTIONS PASSED (19)
  regression: manual_certification_operator_controls → ALL ASSERTIONS PASSED (64)
  regression: classification_aware_launch_readiness  → ALL ASSERTIONS PASSED (20)
  race 1: evidence-write vs in-flight sign-off     → serialized correctly, queued write rejected
  race 2: duplicate sign-off                       → rejected cleanly
  race 3: lineage invalidation                     → milestone stopped reporting validated immediately
  HARNESS RESULT: ALL DATABASE REGRESSIONS PASSED
```

Harness ref: `supabase/tests/run_manual_certification_tests.sh`; fresh run log `supabase/tests/.dump_load.log`.

Current-schema re-dump not possible here (no DB password in `.env*`; Management API token lacks pg_dump). An owner can reproduce the current-state equivalent with:
```bash
supabase db dump --db-url "$YOUR_PRODUCTION_CONNECTION_STRING" --schema public,automation -f /tmp/prod_schema_now.sql
supabase/tests/run_manual_certification_tests.sh /tmp/prod_schema_now.sql
```

---

## Guardrails Added or Recommended

Nothing was changed this session (verification-only, per instructions). Recommended, in priority order:

1. **Retire `register_migration_once.mjs`.** Its single job (registering `20260825120000`) is done; the version is in the ledger. For any future migration, use `supabase db push`/the normal flow, which applies *and* registers atomically — closing this class of gap by construction. Until retirement, add a mandatory pre-write signature-verification step and an irreversible confirmation prompt.
2. **Move `register_migration_once.mjs` and `prod_query.sh` out of `supabase/tests/`** into `scripts/ops/` (or similar) with a clear production-driver name. Their current location invites accidental broad-test/CI execution via a test glob.
3. **CI ledger-drift gate:** compare `supabase migration list --linked` against the local `supabase/migrations/` on every PR; fail on any version present in one but not the other *unless explicitly reconciled*. This would have surfaced the directory-wide version drift automatically.
4. **Targeted, separate review of `hosted_event_cancellation_and_refund_reconciliation`:** its local file (`20260829120000`) differs in content from its registered ledger version (`20260829140525`). This is a rename-plus-content mismatch distinct from the rest of the directory drift and must be resolved deliberately (decide the canonical file, re-register or add a new migration) before relying on a plain `db push`.
5. **Credentials hygiene:** `.env.local` should hold only scoped service tokens; the account-wide Management API token used by these scripts should be rotated and replaced with a project-restricted/least-privilege token for ops.

---

## Launch Impact

None. The v6.2 object set exists, is correct, and is already in active daily use by the internal `/office` launch-certification tooling (gates grid, milestone monitor, launch-phase transitions, research-seed promotion). Nothing about the launch is gated on a schema state that is missing — it is not missing.

---

## Final Verdict

**PRODUCTION STATE VERIFIED — NO REMEDIATION REQUIRED**

Every object `20260825120000_launch_certification_policy_v62.sql` was intended to create — 15 functions (exact signatures + ACLs), 2 views (real, correct columns, executing), 1 table (11 columns, RLS on, SELECT-only service_role grant), 2 triggers, 3 constraint definitions matched byte-for-byte, the cron job, and the exact data-migration side effects — is present and correct in live production, proven by direct read-only comparison, behavioral execution of the migration's RPCs, a byte-identical ledger-vs-file digest, and a passing fresh-environment harness run. `register_migration_once.mjs` remains a genuine process hazard for *future* migrations and should be retired (or at minimum moved and gated) per the Guardrails above, but it did not cause a discrepancy in this instance.