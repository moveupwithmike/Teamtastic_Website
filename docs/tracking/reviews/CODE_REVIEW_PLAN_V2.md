# Code Review Plan — Teamtastic_Website (Pass 2)

Execution plan for the review specified in [CODE_REVIEW_PROMPT.md](CODE_REVIEW_PROMPT.md). The
prompt's 12-section final report is produced by working through 7 phases instead of one pass —
each phase is independently scoped, has a clear input/output, and **produces its own document**.
Phase 6 assembles those documents into the Final Report the prompt specifies. No code is modified
during Phases 0–6; this is read-only analysis.

## Why a second pass

The first pass (Aug 15) produced `docs/review/phase-0..6-*.md` and a Top 10 Actions list. Since
then, nearly all of that list has been acted on:

- `src/lib/server/email.js` (JS) and `supabase/functions/_shared/email.ts` (Deno) now centralize
  the reserve→send→record Resend pattern, closing the idempotency-key drift the first review
  flagged.
- `src/app/office/actions.js` (previously an 814-line, 41-export hotspot) is now a thin re-export
  shim; the real logic lives in 17 focused modules under `src/lib/server/office/`.
- CI (`.github/workflows/ci.yml`) now runs `npm run check`, `typecheck:strict`, a Deno
  `typecheck:edge`/`test:edge` pass over all 14 Edge Functions, and a `database-regression` job
  that runs the game-RPC hardening pgTAP test against an ephemeral Supabase instance.
- Multi-admin office auth (`officeAllowedEmails()`/`isOfficeAllowedEmail()`), constant-time webhook
  secret comparison, `getOfficeDb()` defense-in-depth, and the dead-script/root-hygiene cleanup are
  all in.

That's enough churn — new modules, a new shared Deno helper, new CI jobs, a changed auth model —
that the old phase documents are stale as a map of the current system, even though most of their
*findings* are resolved. This pass re-derives everything from the current code rather than diffing
against the old report, so it also has a chance to catch anything the intervening changes introduced
(e.g. the office decomposition's own copy-pasted boilerplate, found and fixed in a follow-up
mini-review, is exactly the kind of new issue a stale diff-based check would miss).

Where a Pass 2 finding matches something the Aug 15 report already flagged and fixed, say so
explicitly and move on — don't re-litigate closed items at length.

## Scope note on "real-time"

The prompt template assumes a classic real-time app (live connections, event streams, horizontal
scaling of stateful servers). This repo is a Next.js marketing site with: interactive game/quiz
components (`GameQuiz.js`, `SoloDemo.js`), a booking system, Stripe/Resend webhooks, and a set of
Supabase Edge Functions doing async lead-gen/outreach automation (`supabase/functions/*`). Phase 4
will verify this framing against the actual code and reinterpret prompt §9 ("Real-Time Application
Concerns") in those terms — webhook idempotency, async pipeline retry/failure handling, client-side
game/session state — rather than forcing a WebSocket-server lens onto code that doesn't have one. If
Phase 4 turns up an actual persistent-connection/realtime-subscription layer, it'll be assessed
against the prompt's literal criteria instead.

## Output convention

All phase documents are written to `docs/review/`, one file per phase, so each can be reviewed and
acted on independently. This pass does **not** touch the Aug 15 originals — it writes alongside
them with a `-v2` suffix, so both passes stay readable side by side:

| Phase | Document |
|---|---|
| 0 | `docs/review/phase-0-architecture-map-v2.md` |
| 1 | `docs/review/phase-1-architecture-layers-v2.md` |
| 2 | `docs/review/phase-2-refactoring-maintainability-v2.md` |
| 3 | `docs/review/phase-3-testing-v2.md` |
| 4 | `docs/review/phase-4-complexity-and-async-v2.md` |
| 5 | `docs/review/phase-5-static-analysis-v2.md` |
| 6 | `docs/review/phase-6-final-report-v2.md` |

Every finding in every phase document uses the prompt's required evidence structure: **Finding /
Evidence / Impact / Recommendation / Priority (Critical–Low) / Effort (Small–Medium–Large)**, with
file paths and line references. No severity inflation, no generic "best practices" advice untied to
this repo.

---

## Phase 0 — System Discovery & Architecture Map
**Covers prompt §1 (Understand the System First).**

Inventory the actual system before judging it, from scratch:
- Major apps/packages: Next.js site (`src/app`), Supabase project (`supabase/migrations`,
  `supabase/functions`) — confirm the current Edge Function count and list (14 as of the last
  deploy, but verify).
- Architectural style in use (App Router conventions, server vs. client components, API route
  handlers under `src/app/api/*`, Server Actions under `src/lib/server/office/*`).
- Entry points: page routes, API routes (`bookings`, `funnel-events`, `leads`, `resend`, `stripe`),
  Supabase Edge Functions, `proxy.js` middleware.
- External dependencies: Supabase (Postgres + Auth + Edge Functions), Stripe, Resend, Apollo,
  analytics/consent tooling.
- Where business logic actually lives now: `src/lib/server/*`, `src/lib/server/office/*` (17
  modules — map what each one owns), Supabase Edge Functions, `supabase/functions/_shared/*`, and
  SQL (migrations, RPCs like `try_claim_magic_link_send`, `reserve_email_send`).
- Confirm current repo hygiene: are the root-level scraping scripts still gone; is there anything
  new and unused sitting at the repo root or in `src/lib/server/office/` that doesn't belong.

**Output:** architecture map (text diagram + component inventory) that Phases 1–5 all reference —
this phase doesn't render its own verdicts, it establishes ground truth.

## Phase 1 — Architecture & Layer Assessment
**Covers prompt §2 (Architecture Standards) and §3 (Layers and Components).**

Using the Phase 0 map: evaluate separation of concerns, dependency direction, coupling/cohesion
between `src/app/api/*` handlers, `src/lib/server/*`, `src/lib/server/office/*`, `src/lib/supabase/*`,
and Supabase Edge Functions (including the `_shared/*` helpers introduced since Aug 15). Identify
nominal-only layers (pass-through handlers — check whether `src/app/office/actions.js` is now a
clean re-export or has grown logic back into it), missing abstractions, and unnecessary ones. Check
auth/authorization boundaries specifically around the new multi-admin `officeAllowedEmails()` model
and `getOfficeDb()`.

**Output:** per-layer responsibility table + circular-dependency / boundary-violation findings.

## Phase 2 — Refactoring Opportunities & Maintainability
**Covers prompt §4 (Refactoring Opportunities) and §5 (Maintainability).**

Scan for duplicated business rules, large files/functions, mixed responsibilities in route
handlers, magic values, and naming/discoverability issues. Specifically re-examine the 17-module
`src/lib/server/office/` split for cohesion (is `office/shared.js` actually used everywhere it
should be; does any module still mix unrelated domains) and the Deno `_shared/*` helpers for the
same. Note any dead code introduced since Aug 15 (e.g. unused exports left behind by the
decomposition).

**Output:** ranked refactor list, each tied to specific files, with rationale for why the change
improves the system (not generic SOLID advice).

## Phase 3 — Testability & Test Coverage
**Covers prompt §6 (Testability) and §7 (Test Coverage).**

Re-inventory the current test suite from scratch (file count and location have both grown since
Aug 15 — don't assume the old numbers). Assess what's covered vs. high-risk and untested: booking
cancel/reschedule, Stripe/Resend webhooks, the Edge Function automation pipeline, and — new since
last time — the 17 `office/*` modules (several shipped without tests; check which still lack them
and whether the highest-risk ones, e.g. anything touching payments or auth, are covered). Check
whether `vitest.config.mjs`'s coverage scope still matches where the code actually lives. Do not
recommend DI/interfaces everywhere — only where it unlocks real test value.

**Output:** coverage map by risk (not by line %), prioritized list of the highest-value tests to
add first, classified by type (unit/integration/API/DB/e2e).

## Phase 4 — Code Complexity & Async/Webhook Reliability
**Covers prompt §8 (Code Complexity) and §9 (Real-Time Application Concerns, reframed per the scope
note above).**

Identify complexity hotspots with a measurable signal where possible (line counts, cyclomatic
complexity). Separately assess the async/webhook/automation surface for real reliability concerns:
Stripe/Resend webhook idempotency and signature verification, retry behavior in the Supabase Edge
Function pipeline, race conditions in booking availability, and concurrent-invocation assumptions.
Specifically verify the Deno `sendViaResend()` helper's idempotency-key handling is actually used
correctly by every caller (this was a real bug found and fixed once already — confirm it hasn't
regressed) and that the `try_claim_magic_link_send` advisory-lock pattern is sound.

**Output:** complexity hotspot list (legitimate domain complexity vs. accidental), async-reliability
findings.

## Phase 5 — Static Analysis & Quality Gates
**Covers prompt §10 (Static Analysis and Linting).**

Inspect current tooling from scratch: `eslint.config.mjs`, `tsconfig.json` + `tsconfig.strict.json`,
`.github/workflows/ci.yml` (now has more jobs than the first review saw — `check`,
`edge-functions-typecheck`, `database-regression` — verify each actually runs and gates correctly),
`npm run check` as the composite gate. Recommend specific additional rules/categories (not a large
noisy rule set), and evaluate whether SonarQube/SonarCloud is warranted vs. cheaper ecosystem-native
options.

**Output:** current-state gate inventory + specific, minimal recommended additions with what each
would catch.

## Phase 6 — Synthesis: Final Report
**Assembles Phases 0–5 into the exact structure required by CODE_REVIEW_PROMPT.md** (Executive
Summary with 1–10 ratings across 7 areas, Architecture Map, What's Working Well, Critical/High
Findings, Refactoring Opportunities, Testing Assessment, Complexity Hotspots, Real-Time/Async
Assessment, Linting/Static Analysis, Recommended Target Architecture, Prioritized Improvement Plan
[Immediate/Near Term/Long Term], Top 10 Actions ranked with priority/effort/affected
components/benefit).

This phase adds no new analysis — it consolidates and cross-checks Phases 0–5 for consistency, and
is the single document meant for stakeholders who won't read all 7. It should also briefly note,
for continuity, which Aug 15 findings are now confirmed closed.

---

## Execution notes

- Phases 0–5 can be researched in parallel once Phase 0's architecture map exists (they read
  different parts of the same codebase), but Phase 6 must run last.
- Each phase document stands alone: file paths, line numbers, and the Finding/Evidence/Impact/
  Recommendation/Priority/Effort structure throughout, so a reader can act on e.g. Phase 3 without
  reading Phase 1.
- No source files are modified while producing Phases 0–6. Any fixes come after the user reviews
  the Final Report and chooses what to act on.
