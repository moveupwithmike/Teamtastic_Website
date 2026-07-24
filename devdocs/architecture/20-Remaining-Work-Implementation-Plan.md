# 20 — Implementation Plan: Remaining Work

Scopes exactly the items confirmed still open in the verification pass against [19-Gaps-Unfinished-Wiring-and-Coding-Standards.md](19-Gaps-Unfinished-Wiring-and-Coding-Standards.md) — everything Codex's pass fixed is excluded here. See the verification conversation for the full evidence trail; this doc is the "what to do about what's left" follow-up.

## Summary

| # | Item | Priority | Effort | Needs a product/business decision first? |
|---|---|---|---|---|
| 1 | Office magic-link rate-limiter race | Low-severity, quick win | S | No |
| 2 | `sequence_steps` missing-step → stranded enrollment | Defensive hardening | S | No |
| 3 | `/api/leads` duplicated rate-limit/Turnstile | Maintenance risk | S | No |
| 4 | `lead_captured` double-fires, unlinked distinct-IDs | Data-quality (inflated conversion counts) | M | No |
| 5 | PostHog inits before explicit consent in opt-in regions | Compliance-adjacent | M | Yes — confirm target regions/legal posture |
| 6 | No `posthog.identify()` anywhere | Analytics capability gap | M | Yes — pick an identifier (email hash vs. internal id) |
| 7 | `deal_stage_history` / `proposals.metadata` unused | Feature completeness | M | Yes — build a UI for it, or deprecate it |
| 8 | `teamtastic.games` handoff is an unvalidated implicit contract | Cross-repo risk | M–L | Yes — needs coordination with that codebase |
| 9 | Confirm Resend webhook is actually registered | Operational, not code | — | N/A (ops action) |

Suggested order: 1 → 2 → 3 (all same-day, no dependencies) → 4 → 6 → 5 (analytics cluster, do together since 6 informs 5's identify-timing) → 7 → 8 → 9 (whenever convenient, no code dependency).

---

## 1. Office magic-link rate-limiter race

**Problem**: `requestMagicLink` in `src/app/office/actions.js` guards re-sends with `SELECT count(*) FROM agent_log WHERE ... created_at >= oneMinuteAgo`, then sends if `count === 0`. Two concurrent requests inside the same second can both read `count === 0` before either's `agent_log` row lands, both send.

**Fix**: Replace the count-then-send check with a Postgres advisory lock (the repo already uses `pg_advisory_lock`/`pg_advisory_xact_lock` elsewhere — `supabase/migrations/20260719233045_milestone1_deal_pipeline.sql:152,181,292,294` — so this is a consistent pattern, not a new one).

- Add a small RPC, e.g. `automation.try_claim_magic_link_send(p_email text) returns boolean`, that does `select pg_try_advisory_xact_lock(hashtext('magic_link:' || p_email))` and, only if it acquires the lock, re-checks the 60-second window inside the same transaction before returning `true`/`false`.
- `requestMagicLink` calls this RPC instead of the raw `agent_log` count query; only proceeds to generate/send the link if it returns `true`.

**Files**: new migration (e.g. `supabase/migrations/<next>_office_magic_link_lock.sql`), `src/app/office/actions.js` (`requestMagicLink`).

**Acceptance criteria**: fire two concurrent `requestMagicLink` calls for the same email (e.g. via a small script hitting the server action twice with `Promise.all`); confirm exactly one `agent_log` "sent" row and one Resend send, not two.

---

## 2. `sequence_steps` missing-step defensive guard

**Problem**: `send-approved-outreach` sets a new enrollment's `next_action_at` to `null` if the `sequence_steps` row for step 2 is missing/not `approved`. `draft-sequence-followups` queries `.lte("next_action_at", now())`, which never matches `null` — such an enrollment is silently stranded forever with no error, no log, no task.

**Fix** (defense in depth, since the steps table is populated today but could drift):
- In `send-approved-outreach/index.ts`, if the step-2 lookup returns no row, log an `agent_log` entry (`outcome: "escalated"`, reason `sequence_step_missing`) instead of silently writing `null`, and consider defaulting `next_action_at` to a safe fallback (e.g. `now() + 4 days`) so the enrollment doesn't stall — or explicitly set `sequence_enrollments.status = 'stopped_missing_step'` so it's visibly terminal rather than invisibly stuck.
- Add a cheap periodic check (could piggyback on the existing daily sales report) that flags any `sequence_enrollments` row with `status='active' AND next_action_at IS NULL` — this makes a future schema drift visible instead of silent.

**Files**: `supabase/functions/send-approved-outreach/index.ts`, `supabase/functions/send-daily-sales-report/index.ts` (add the stuck-enrollment check to the existing "what the system chose not to do" section).

**Acceptance criteria**: temporarily delete/disable a `sequence_steps` row in a test environment, confirm the enrollment either self-heals with a fallback delay or is visibly flagged (task/log/report line), not silently frozen.

---

## 3. `/api/leads` duplicated rate-limit/Turnstile

**Problem**: `src/app/api/leads/route.js` defines its own local `rateLimited()`/`verifyTurnstile()`, byte-identical today to `src/lib/server/rate-limit.js`/`turnstile.js` but structurally separate — a future tuning change to the shared lib silently won't apply here.

**Fix**: straightforward refactor — delete the local copies in `route.js`, import from `@/lib/server/rate-limit` and `@/lib/server/turnstile` instead, same as the three booking routes. No behavior change intended (confirmed identical defaults), so this is a pure de-duplication, not a functional fix.

**Files**: `src/app/api/leads/route.js`.

**Acceptance criteria**: existing lead-capture flow (quiz/demo/concierge forms) still works end-to-end in manual testing; rate-limit/Turnstile-failure paths still return the same error shapes as before (diff the response codes/bodies pre- and post-refactor).

---

## 4. `lead_captured` double-fires with unlinked distinct-IDs

**Problem**: `track("lead_captured", ...)` fires client-side (PostHog's own anonymous/identified distinct-ID) in all four lead-capture components, *and* `captureServerEvent("lead_captured", submissionId, ...)` fires server-side in `/api/leads` keyed by `submissionId` — two separate PostHog identities for one real-world event, no alias between them.

**Fix options** (pick one; recommend (a)):
- **(a) Drop the server-side duplicate**, since the client-side `track()` call already reports the same event and is the one exposed to consent gating — the server-side call was originally a "reliability backstop" in case the client-side call never fired (e.g., tab closed mid-request), which is a real but narrow case. Instead, make the *client* call authoritative and only have the server emit a *different*, clearly-named event (e.g. `lead_persisted`) for internal reliability monitoring, not reusing the same event name.
- **(b) Keep both, but alias them**: have the client include its own PostHog `distinct_id` (via `posthog.get_distinct_id()`) in the payload sent to `/api/leads`, and have the server call `posthog.alias(serverDistinctId, clientDistinctId)` (or better, use the client ID directly as the server capture's distinct ID) so both events collapse into one person in PostHog.

**Files**: `src/lib/analytics.js`, `src/app/api/leads/route.js`, `src/lib/lead-client.js` (to thread the client distinct-ID through if going with (b)).

**Acceptance criteria**: submit a lead through each of the 4 flows in a PostHog test project; confirm exactly one `lead_captured` event per submission (or, under option (b), one merged person with both events visible under a single profile).

---

## 5 & 6. PostHog consent timing + missing `identify()`

Grouping these since they touch the same init code and the fix for one affects the other.

**Problem (5)**: `instrumentation-client.js` initializes PostHog for anyone who hasn't explicitly clicked "decline" — including opt-in-region (GDPR) visitors who haven't yet answered the consent banner. In-memory-only persistence softens this, but the SDK still boots and can capture pageview/autocapture pre-consent in regions the code's own geo-heuristic is trying to treat as opt-in.

**Problem (6)**: `posthog.identify()` is never called anywhere — every event is anonymous-device-scoped; no cross-device/lead-level identity resolution at the analytics layer.

**Decision needed before coding**: confirm with whoever owns compliance posture (a) whether opt-in regions should genuinely block SDK init until explicit accept (stricter, some loss of pre-consent analytics in those regions), and (b) what identifier is safe to call `identify()` with — email is PII; a hashed email or the `submissionId`/`prospect_id` are safer choices given `analytics.js` already strips PII from event properties.

**Fix, once decided**:
- In `instrumentation-client.js`, for opt-in regions specifically (reuse `requiresOptIn()` from `consent.js`), gate `posthog.init()` itself behind `effectiveConsent() === "granted"` rather than `!== "denied"` — opt-out regions keep current behavior, opt-in regions now truly wait for explicit accept.
- Call `posthog.identify(id)` once a lead is captured (client-side, right after `captureLead()` succeeds) using the agreed-upon identifier — this is also the natural point to solve item 4's aliasing if going with option (b) there.

**Files**: `src/instrumentation-client.js`, `src/lib/consent.js` (may need a client-readable region flag), `src/lib/analytics.js` or wherever `captureLead()`'s success handler lives per component.

**Acceptance criteria**: simulate an opt-in-region browser (spoof timezone) with no consent decision made — confirm zero PostHog network requests until the banner is answered. After a lead capture, confirm the PostHog person is identified (not anonymous) in a test project.

---

## 7. `deal_stage_history` / `proposals.metadata` unused

**Problem**: both are populated (the former by a DB trigger on every stage change, the latter available to `createProposal` but never written) and never read by any office page — dead weight in the schema, or a half-built feature depending on intent.

**Decision needed**: is a "time in stage" / deal-history view something the business actually wants in `/office`? If not, the cheaper move is to explicitly document these as intentionally-unused/reserved-for-future-reporting (a one-line comment in the migration + this doc) rather than build UI nobody asked for. Recommend confirming with the office's actual user before spending effort here.

**Fix, if building the UI**:
- Add a small "Stage history" section to `src/app/office/(private)/prospects/[id]/page.js`, querying `deal_stage_history` for the deal(s) linked to that prospect, rendering `from_stage → to_stage` transitions with timestamps (and computed duration-in-stage, which is the actual reporting value this table exists for).
- `proposals.metadata` is lower priority since nothing currently writes anything meaningful into it — either start populating it with something worth displaying (e.g., which template/version generated the proposal) or drop the idea until there's a concrete use.

**Files**: `src/app/office/(private)/prospects/[id]/page.js`.

**Acceptance criteria**: prospect detail page shows a stage-history timeline for prospects with at least one recorded transition; a prospect with no deal/no transitions shows the existing empty state, not an error.

---

## 8. `teamtastic.games` handoff is an unvalidated implicit contract

**Problem**: the Event Quiz and SoloDemo each link out to `teamtastic.games` with different, hand-typed query-param sets (`?vibe=&size=&occasion=&recommendation=&submission_id=` vs. a bare URL with nothing) and no shared contract — a silent break on either side would be invisible from this repo.

**This one is cross-repo** — it can't be fully "finished" from `Teamtastic_Website` alone. Two tiers of fix:

- **Tier A (do unilaterally, no coordination needed)**: at minimum, make the two flows *consistent with each other* — decide on one canonical query-param shape (recommend keeping the Event Quiz's richer set: `vibe`, `size`, `occasion`, `recommendation`, `submission_id`) and have SoloDemo's "Launch Free Lobby" link build the same params instead of a bare URL, so at least this repo's two producers of the handoff agree with each other.
- **Tier B (needs the other repo's cooperation)**: formalize the contract — e.g. a shared markdown spec (could live in this repo's `devdocs/` and be linked from the other repo, or vice versa) documenting exactly what params `teamtastic.games` reads and what it does with each, plus a lightweight smoke test (even just a scheduled job that opens the URL and checks for a non-error response) so a future change on either side surfaces as a visible failure instead of a silent no-op.

**Files**: `src/components/SoloDemo.js` (Tier A), a new shared spec doc (Tier B, location depends on where the other repo lives).

**Acceptance criteria (Tier A only, since Tier B depends on external coordination)**: both Quiz and SoloDemo produce the same param shape for equivalent inputs; manually confirm both land correctly on `teamtastic.games`.

---

## 9. Confirm the Resend webhook is actually registered

**Not a code task.** `LEAD_FUNNEL_OPERATIONS.md` now documents the step (register `https://www.teamtastic.events/api/resend/webhook` in Resend's dashboard for delivered/bounced/complained events), but nothing in the repo can prove it's been done.

**Action**: whoever has Resend dashboard access should register the webhook, fire Resend's built-in test event, and confirm a new row lands in `resend_webhook_events` (a simple `select count(*) from resend_webhook_events` before/after is enough to verify). Until this is done, the suppression/auto-pause improvements from item G3 in the prior verification are built but not receiving real signal.

**Acceptance criteria**: a test event from Resend's dashboard produces a row in `resend_webhook_events` within a minute.
