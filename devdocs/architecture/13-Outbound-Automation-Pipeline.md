# 13 — Outbound Automation Pipeline

An autonomous cold-outreach engine: find prospects (Apollo.io) → enrich → collect public signals (GDELT news) → score → draft (deterministic templates, no LLM) → human approval in `/office` → send → ingest Gmail replies → classify → sequence follow-ups. Implemented entirely as 8 self-contained Deno Edge Functions (no shared helper modules — each `index.ts` duplicates its own auth/client/error-handling boilerplate) plus Postgres triggers and `pg_cron`. **None use Supabase JWT verification** (`verify_jwt = false` for all); each checks a static `x-webhook-secret` header against its own env var instead — that header is the entire auth layer for these 8 public HTTP endpoints.

## Pipeline stages

### 1. `discover-apollo-candidates`
Queries Apollo's `mixed_people/api_search` against hardcoded title/seniority lists, US orgs 25–2000 employees, verified email only. Upserts into `apollo_candidates`, dedup entirely via a DB unique constraint on `apollo_person_id` (no app-level dedup logic). Cap is **per-run only** (`min(config, 25)`, default 10) — no separate daily cap, though the once-a-weekday cron schedule makes this incidental.

### 2. `process-apollo-enrichment`
Queue consumer over `enrichment_requests` (status `pending`, up to 10/run). Has a **real daily cap** (counts `completed` today vs. `phase3_apollo_enrichment_daily_cap`). Calls Apollo `people/bulk_match`; on no-match/unverified marks the candidate `status='selected'` (a confusing but harmless reuse of that enum value as a dead-end marker — see schema notes below); on suppression-list hit, marks `rejected`; otherwise creates/looks up `companies` (by domain only — a null-domain company gets re-inserted every run with no name-based dedup) and `prospects` (by `email_normalized`). On any thrown error, **every currently-`processing` row for the whole `apollo` provider resets to `pending`** (not scoped to the failing run) — a blanket rollback, not a targeted retry.

### 3. `test-apollo-connection`
Pure health-check (Apollo `auth/health` + `usage_stats`), no DB writes, no `system_config` gate, no cron trigger anywhere, no app-code caller. Confirmed as an intentional manual-invoke diagnostic, not orphaned code.

### 4. `collect-phase3-signals`
"Signals" are public **GDELT** news mentions (a free news-indexing API) — not LinkedIn/job-boards, despite the schema's `signal_sources.source_kind` enum supporting `jobs`/`awards`/`expansion`. Gated by `system_config` **and** an independent `signal_sources.enabled` row-level flag that is inserted `false` and never flipped true in any migration — a second, DB-only kill switch invisible from `system_config`. Selects up to `min(config.phase3_signal_company_limit, 3)` companies — note the **hardcoded ceiling of 3** even though the config column's own CHECK constraint permits 1–25; raising the config value above 3 silently has no effect. Classifies mentions into `hiring_surge`/`office_expansion`/`culture_award`/`company_growth_news` via title regex with fixed strength scores, dedups via a SHA-256 fingerprint of `provider|company|normalized_title` (catches syndicated stories across outlets), rate-limit-aware (backs off and stops the whole run on GDELT 429s).

### 5. `process-phase3-pipeline`
Two stages, one function:
- **Scoring**: computes a 0–100 score (company-fit/role-fit/signal-fit/intent-fit weighted sum) for up to 100 prospects, writes `prospects.score`/`score_reasons` + history, flips status to `qualified` at ≥65. **This scoring formula is reimplemented in TypeScript** even though an equivalent SQL function, `automation.score_prospect(uuid)`, already exists in the schema (`phase3_outbound_foundation` migration) — that SQL function is never called by anything; two independent copies of the same business rule exist, with silent-drift risk between them.
- **Drafting**: re-queries prospects at/above the minimum score, generates outreach copy via deterministic templates (`outreachCopy()` when a signal exists, `genericOutreachCopy()` otherwise — explicitly documented as staying honest rather than fabricating personalization) — **no LLM call anywhere in this pipeline**, `model: "deterministic-template"`. Writes `outreach_drafts` with `status: 'review'`, fingerprint-deduped by `prospect|signal|prompt_version`. No check against a prospect's *existing* pending draft beyond that fingerprint, so a prospect can accumulate multiple pending drafts across runs if their strongest signal changes between runs.

### 6. `draft-sequence-followups`
Has the **most complete gate chain** of any function in this pipeline (master switch, prospecting switch, sequence-specific switch, and the deliverability auto-pause flag). Finds `sequence_enrollments` due for their next step, hardcodes `MAX_STEPS = 3` and a 4-day inter-step delay **in TypeScript**, not read from the `sequence_steps` table at all — see schema notes below, that table is fully empty despite existing. Two hardcoded follow-up templates (step-2 bump, step-3 breakup); step 1 is never drafted here (it's created by `send-approved-outreach` on first successful send).

### 7. `send-approved-outreach`
The actual sender. Adds two guards not present elsewhere: a **9am–5pm ET, weekdays-only sending window**, and a **14-day same-company cooldown** (checks whether any other prospect at the same company, or same email domain if no `company_id`, got a prospecting email in the last 14 days). The real gate is `reserve_email_send(p_message_type: "prospecting", ...)` — identical pattern to booking/office/nurture sends. Notably, when the reservation is denied (cap hit, or prospecting disabled mid-batch), the loop **breaks entirely** rather than skipping just that item — the rest of the batch is abandoned for the run, not retried per-item. Bootstraps a prospect into the `cold-outreach-followups-v1` sequence on first successful send, with a **3-day** delay to step 2 — a different hardcoded constant than `draft-sequence-followups`' 4-day inter-step delay, defined in a separate file with no shared source of truth. No advisory lock/`SELECT ... FOR UPDATE`, so concurrent overlapping invocations could theoretically both select the same `approved` draft before either flips its status (the daily-cap counter itself is race-safe via an atomic conditional UPDATE; the draft-selection step is not).

### 8. `ingest-gmail-replies`
Classic OAuth2 refresh-token flow against a single mailbox — **polling**, not Gmail push/watch. Fetches `newer_than:14d`, so if this function's cron sits inactive longer than 14 days (which it does by default, see cron table below) and is later turned on, any reply older than 14 days at that point is permanently unreachable through this path. Dedups per-message via `(provider, provider_message_id)` before even fetching the full body. Matches sender to `prospects.email_normalized`, creating one inline if none exists. Filters out automated/bulk mail (no-reply addresses, `Auto-Submitted`/`List-Id` headers, bounce patterns) before classifying. **"Reply intelligence" is a pure regex/keyword cascade** (unsubscribe → legal → complaint → out-of-office → not-interested → referral → interested → question → unknown) — no LLM/sentiment model despite the branding. Writes the classified `messages` row only; it does **not** itself update prospect status, stop sequences, or create tasks — all of that is downstream in the `automation.handle_inbound_message` DB trigger, which does the actual status transition, sequence-stopping, suppression-list writes, and escalation-task creation.

## Cron inventory (the key finding)

| Job | Schedule | Calls | Active? |
|---|---|---|---|
| `phase3-apollo-discovery` | `0 12 * * 1-5` | `discover-apollo-candidates` | **Inactive** |
| `phase3-apollo-enrichment` | `15 12 * * 1-5` | queues discovered candidates + `process-apollo-enrichment` | **Active** — the only job in this entire pipeline ever flipped on |
| `phase3-signal-collector` | `30 12 * * 1-5` | `collect-phase3-signals` | **Inactive** |
| `phase3-score-and-draft` | `0 13 * * 1-5` | `process-phase3-pipeline` | **Inactive** |
| `draft-sequence-followups` | `10 13 * * 1-5` | `draft-sequence-followups` | **Inactive** |
| `send-approved-outreach` | `*/30 13-21 * * 1-5` | `send-approved-outreach` | **Inactive** — comment explicitly says keep off "until the send worker has been verified against a real send and the Resend webhook/auto-suppression is already live" |
| `gmail-reply-ingestion` | `*/5 * * * *` | `ingest-gmail-replies` | **Inactive** |

**Structural consequence**: as shipped, only Apollo enrichment runs on a schedule, and its own upstream (discovery) is inactive — so the one active job has nothing new to draw on unless discovery is triggered by hand. Every other stage — scoring, drafting, sending, reply ingestion, sequence follow-ups — requires manual invocation. This looks like intentional, staged rollout discipline (the send-worker cron's own comment confirms this pattern explicitly) rather than an oversight, but it means "the pipeline runs autonomously" is not yet true end-to-end.

## Schema cross-checks (drift found)

- **`automation.score_prospect(uuid)` is dead SQL** — duplicated instead in the edge function's TypeScript (see stage 5).
- **`sequence_steps` table is fully orphaned** — created with RLS/grants, and a later migration's own comment claims to populate "the sequences/sequence_steps/sequence_enrollments scaffolding... which existed but was never written to," yet that migration only ever inserts into `sequences`, never `sequence_steps`. The comment is inaccurate; the table remains empty, and cadence/copy live as hardcoded constants in TypeScript instead.
- **`apollo_candidates.status = 'selected'`** is a stale value being reused with new meaning (harmless today, since the queue function was fixed in a later migration to only look at `'discovered'`, but a naming/history mismatch).
- **Two different follow-up cadence constants** (3-day first-step delay in `send-approved-outreach`, 4-day subsequent-step delay in `draft-sequence-followups`) with no shared config source.
- **`enrichment_requests.request_kind`** schema supports 3 kinds and 3 targeting-key shapes; only 1 of each is ever actually used in practice — the other two are dead schema paths, not bugs.
- Suppression-list checks are present and consistent everywhere they matter in this pipeline (enrichment, scoring, drafting, sequence-stopping) — the one omission (`discover-apollo-candidates`) is fine since that stage only ever writes to `apollo_candidates`, never to `prospects`/`messages`.
- A real (now-fixed) production issue is documented in-migration: `service_role` initially had `EXECUTE` on individual `automation.*` functions but not `USAGE` on the `automation` schema itself, which broke every `outreach_drafts` insert/update via service-role until a follow-up migration granted schema usage — caught, per the migration's own comment, only while activating the drafting cron for real.

## Gaps (ranked)

1. **Only 1 of 7 pipeline cron jobs is active, and it depends on an inactive upstream stage** — "autonomous" is aspirational as shipped; every stage past enrichment needs manual triggering.
2. **`automation.score_prospect` SQL function is dead code**, duplicating live TypeScript logic with no mechanism to keep the two in sync if either changes.
3. **`sequence_steps` table exists, is granted, and is claimed-populated by a migration comment, but is empty and unused** — cadence/copy are hardcoded in two separate files instead, with inconsistent constants between them (3-day vs. 4-day).
4. **`collect-phase3-signals` silently ignores configured values above 3** for `phase3_signal_company_limit`, despite the schema advertising a 1–25 range.
5. **`signal_sources.enabled` is an independent, easy-to-forget kill switch** not visible from `system_config` — flipping the system-wide research flag on is insufficient by itself.
6. **Blanket rollback on enrichment failure** resets every in-flight `apollo` row to `pending`, not just the failing run's rows.
7. **No advisory lock on `send-approved-outreach`'s draft selection** — a real (if narrow) double-send race under concurrent invocation, distinct from the daily-cap counter, which is race-safe.
