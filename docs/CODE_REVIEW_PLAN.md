# Code Review Plan — Teamtastic_Website

Execution plan for the review specified in [CODE_REVIEW_PROMPT.md](CODE_REVIEW_PROMPT.md). The
prompt's 12-section final report is produced by working through 7 phases instead of one pass —
each phase is independently scoped, has a clear input/output, and **produces its own document**.
Phase 6 assembles those documents into the Final Report the prompt specifies. No code is modified
during Phases 0–6; this is read-only analysis.

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
acted on independently:

| Phase | Document |
|---|---|
| 0 | `docs/review/phase-0-architecture-map.md` |
| 1 | `docs/review/phase-1-architecture-layers.md` |
| 2 | `docs/review/phase-2-refactoring-maintainability.md` |
| 3 | `docs/review/phase-3-testing.md` |
| 4 | `docs/review/phase-4-complexity-and-async.md` |
| 5 | `docs/review/phase-5-static-analysis.md` |
| 6 | `docs/review/phase-6-final-report.md` |

Every finding in every phase document uses the prompt's required evidence structure: **Finding /
Evidence / Impact / Recommendation / Priority (Critical–Low) / Effort (Small–Medium–Large)**, with
file paths and line references. No severity inflation, no generic "best practices" advice untied to
this repo.

---

## Phase 0 — System Discovery & Architecture Map
**Covers prompt §1 (Understand the System First).**

Inventory the actual system before judging it:
- Major apps/packages: Next.js site (`src/app`), Supabase project (`supabase/migrations`,
  `supabase/functions`), one-off data-prep scripts at repo root (already flagged in prior notes as
  non-production tooling — confirm still true).
- Architectural style in use (App Router conventions, server vs. client components, API route
  handlers under `src/app/api/*`).
- Entry points: page routes, API routes (`bookings`, `funnel-events`, `leads`, `resend`, `stripe`),
  Supabase Edge Functions (14 functions under `supabase/functions`), `middleware`/`proxy.js`.
- External dependencies: Supabase (Postgres + Edge Functions), Stripe, Resend, Apollo (per function
  names), analytics/consent tooling in `src/lib/analytics.js` / `consent.js`.
- Where business logic actually lives: `src/lib/*` vs. route handlers vs. Supabase functions vs.
  SQL (migrations under `supabase/migrations`, including the 5 untracked security/perf migrations
  currently sitting in git status).

**Output:** architecture map (text diagram + component inventory) that Phases 1–5 all reference —
this phase doesn't render its own verdicts, it establishes ground truth.

## Phase 1 — Architecture & Layer Assessment
**Covers prompt §2 (Architecture Standards) and §3 (Layers and Components).**

Using the Phase 0 map: evaluate separation of concerns, dependency direction, coupling/cohesion
between `src/app/api/*` handlers, `src/lib/server/*`, `src/lib/supabase/*`, and Supabase Edge
Functions. Identify nominal-only layers (pass-through handlers), missing abstractions (duplicated
logic across API routes and Edge Functions doing similar outreach/lead work), and unnecessary ones.
Check auth/authorization boundaries given the pending RLS/RPC-hardening migrations in git status —
those migrations are strong evidence of where boundaries were previously weak.

**Output:** per-layer responsibility table + circular-dependency / boundary-violation findings.

## Phase 2 — Refactoring Opportunities & Maintainability
**Covers prompt §4 (Refactoring Opportunities) and §5 (Maintainability).**

Scan for duplicated business rules (e.g., pricing/eligibility logic possibly repeated between
`src/lib/pricing.js`, API routes, and Stripe webhook handling), large files/functions, mixed
responsibilities in route handlers, magic values, and naming/discoverability issues across the
`src/app`, `src/lib`, and `supabase/functions` split. Note the root-level scraping scripts
(`extract_activities*.js`, `process_games.js`, etc.) as a maintainability/discoverability liability
if still present and unused.

**Output:** ranked refactor list, each tied to specific files, with rationale for why the change
improves the system (not generic SOLID advice).

## Phase 3 — Testability & Test Coverage
**Covers prompt §6 (Testability) and §7 (Test Coverage).**

Current known test surface: `vitest` configured (`vitest.config.mjs`), three test files
(`src/lib/pricing.test.js`, `game-handoff.test.js`, `recommendations.test.js`) plus
`supabase/tests`. Assess what's covered vs. what's high-risk and untested — booking
cancel/reschedule flow, Stripe/Resend webhook handlers, the Edge Function automation pipeline,
lead-scoring/outreach logic. Determine whether existing tests validate behavior or implementation
detail, and whether hidden dependencies (Supabase client, Stripe SDK, time) make key logic hard to
test. Do not recommend DI/interfaces everywhere — only where it unlocks real test value.

**Output:** coverage map by risk (not by line %), prioritized list of the highest-value tests to
add first, classified by type (unit/integration/API/DB/e2e).

## Phase 4 — Code Complexity & Async/Webhook Reliability
**Covers prompt §8 (Code Complexity) and §9 (Real-Time Application Concerns, reframed per the scope
note above).**

Identify complexity hotspots (large files, deep nesting, big branching) with a measurable signal
where possible (line counts, cyclomatic complexity via a quick script if useful) rather than
subjective impression. Separately assess the async/webhook/automation surface for real
reliability concerns: Stripe/Resend webhook idempotency and signature verification, retry behavior
in the Supabase Edge Function pipeline (`process-apollo-enrichment`, `send-approved-outreach`,
etc.), race conditions in booking availability, and any assumptions that break under multiple
concurrent invocations (Edge Functions can run concurrently even without a "server").

**Output:** complexity hotspot list (legitimate domain complexity vs. accidental), async-reliability
findings.

## Phase 5 — Static Analysis & Quality Gates
**Covers prompt §10 (Static Analysis and Linting).**

Inspect current tooling: `eslint.config.mjs` (extends `eslint-config-next/core-web-vitals` only),
`tsconfig.json` + `npm run typecheck`, no visible coverage reporting or CI config found yet (verify
in this phase — check for `.github/workflows` etc.), `npm run check` as the composite gate.
Recommend specific additional rules/categories (not a large noisy rule set), and evaluate whether
SonarQube/SonarCloud is actually warranted for a repo this size vs. cheaper ecosystem-native options
(stricter ESLint rules, `vitest --coverage`, dependency audit in CI).

**Output:** current-state gate inventory + specific, minimal recommended additions with what each
would catch.

## Phase 6 — Synthesis: Final Report
**Assembles Phases 0–5 into the exact structure required by CODE_REVIEW_PROMPT.md** (Executive
Summary with 1–10 ratings across 7 areas, Architecture Map, What's Working Well, Critical/High
Findings, Refactoring Opportunities, Testing Assessment, Complexity Hotspots, Real-Time/Async
Assessment, Linting/Static Analysis, Recommended Target Architecture, Prioritized Improvement Plan
[Immediate/Near Term/Long Term], Top 10 Actions ranked with priority/effort/affected
components/benefit).

This phase adds no new analysis — it consolidates and cross-checks Phases 0–5 for consistency
(e.g., a "Critical" finding in Phase 1 must appear in the Top 10 Actions), and is the single
document meant for stakeholders who won't read all 7.

---

## Execution notes

- Phases 0–5 can be researched in parallel once Phase 0's architecture map exists (they read
  different parts of the same codebase), but Phase 6 must run last.
- Each phase document stands alone: file paths, line numbers, and the Finding/Evidence/Impact/
  Recommendation/Priority/Effort structure throughout, so a reader can act on e.g. Phase 3 without
  reading Phase 1.
- No source files are modified while producing Phases 0–6. Any fixes come after the user reviews
  the Final Report and chooses what to act on.
