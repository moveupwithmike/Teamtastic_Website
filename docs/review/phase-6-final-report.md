# Teamtastic_Website — Code Review Final Report

Synthesis of [Phase 0](phase-0-architecture-map.md) through [Phase 5](phase-5-static-analysis.md),
produced per the structure required by [CODE_REVIEW_PROMPT.md](../CODE_REVIEW_PROMPT.md) and
[the review plan](../CODE_REVIEW_PLAN.md). This document adds no new analysis — every claim below
traces to a specific finding in one of the five phase documents, linked inline. No code was
modified during this review; all six phases were read-only investigation and documentation.

---

## 1. Executive Summary

| Area | Rating (1-10) |
|---|---|
| Architecture | 7 |
| Maintainability | 6 |
| Testability | 8 |
| Test Coverage | 5 |
| Code Complexity | 7 |
| Real-Time / Async Reliability | 8 |
| Static Analysis / Quality Gates | 4 |

**No Critical findings were identified anywhere in this review.** The worst issues found are High
priority, and most of those are small, mechanical fixes rather than structural problems — that's
the headline result, not a formality.

- **Architecture (7/10)**: the parts of the system that handle money and state transitions —
  bookings and Stripe — are genuinely well-designed: thin route handlers, atomic RPCs owning
  business rules, and a real compensating-transaction pattern for multi-system orchestration
  ([Phase 1](phase-1-architecture-layers.md), [Phase 4](phase-4-complexity-and-async.md)). The
  score isn't higher because that discipline doesn't extend evenly to the office/growth domain,
  which is architecturally looser ([Phase 1 Finding 6](phase-1-architecture-layers.md)).
- **Maintainability (6/10)**: real, evidenced duplication (an email-sending pattern copy-pasted 11
  times with detectable drift, a validation helper duplicated 5 times with a silent behavioral
  difference) plus a half-adopted error-message dictionary and some dead weight at the repo root
  ([Phase 2](phase-2-refactoring-maintainability.md)). All addressable at Small-Medium effort.
- **Testability (8/10)**: scored separately from coverage on purpose — the testing *infrastructure*
  is excellent. A well-designed Supabase-client mock, tests that assert on behavior rather than
  implementation, and no problematic hidden dependencies or global state to work around
  ([Phase 3](phase-3-testing.md)).
- **Test Coverage (5/10)**: good breadth where it exists (booking, Stripe, leads), but three
  specific high-value gaps — the actual price-calculation function, the office authorization gate,
  and the canonical timezone utility — are untested despite costing almost nothing to cover given
  the testability score above ([Phase 3](phase-3-testing.md)).
- **Code Complexity (7/10)**: one real, quantitatively confirmed hotspot
  (`src/app/office/actions.js`); everything else that looked complex by size turned out to be
  either legitimate content (marketing pages) or legitimate, well-decomposed domain complexity
  (the largest Edge Function) ([Phase 2](phase-2-refactoring-maintainability.md),
  [Phase 4](phase-4-complexity-and-async.md)).
- **Real-Time / Async Reliability (8/10)**: the standout area. Webhook idempotency, a genuine
  saga pattern for booking confirmation, and a correct claim-before-process guard against
  concurrent Edge Function invocations are all present and correct
  ([Phase 4](phase-4-complexity-and-async.md)). Only small edge-case gaps found.
- **Static Analysis / Quality Gates (4/10)**: the lowest score, and the cheapest to fix. Existing
  gates (lint, typecheck, tests) all pass cleanly, but nothing enforces them — there is no CI at
  all — and running `npm audit` during this review surfaced 5 real, currently-active
  vulnerabilities that nothing had caught ([Phase 5](phase-5-static-analysis.md)).

---

## 2. Architecture Map

Full detail, component inventory, and external-dependency table in
[Phase 0](phase-0-architecture-map.md). Summary: this is not one application but three sharing one
Supabase project — a public marketing/booking site, a single-operator internal growth-ops
dashboard, and a shared Postgres + Edge Function backend that also carries schema for a **live
buzzer-game product hosted entirely outside this repo** (`teamtastic.games`), reached only via a
handoff redirect (`src/lib/game-handoff.js`). That last point is why "Real-Time Application
Concerns" in this report means webhook/automation reliability rather than WebSocket/connection
handling — see [Phase 0 §5](phase-0-architecture-map.md#5-correction-to-the-plans-real-time-framing)
for the full justification.

```
                         ┌─────────────────────────┐
                         │   teamtastic.games       │  (separate app, not in this repo)
                         │   live buzzer game UI    │
                         └────────────┬─────────────┘
                                      │ redirected to by game-handoff.js
┌──────────────────────────────────────────────────────────────────────┐
│  Next.js app (this repo)                                             │
│  Marketing/SEO pages, GameQuiz (lead funnel), Booking UI,            │
│  Office dashboard (single-operator, magic-link auth)                 │
│       │                                                               │
│  API routes (bookings, leads, funnel-events, stripe, resend) ────────►│  Supabase Postgres
│  "use server" actions (office/actions.js) ────────────────────────────►  (40 migrations:
└──────────────────────────────────────────────┬────────────────────────┘  growth-engine + game RPCs)
                                                 │
                     ┌───────────────────────────┘
                     ▼
        Supabase Edge Functions (Deno, 14 fns)
        Apollo discovery/enrichment, outreach send,
        Gmail reply ingest, nurture/reminder emails
                     │
                     ▼
        External: Apollo.io, Resend, Google Calendar, Zoom,
        Stripe, Cloudflare Turnstile, PostHog
```

Business logic placement is mostly disciplined: booking domain logic lives in `src/lib/server/*`,
money-critical operations are atomic Postgres RPCs, and API routes are thin orchestrators — see the
[Phase 1 layer responsibility table](phase-1-architecture-layers.md#layer-responsibility-table) for
the full per-layer breakdown, including the one place (the office domain) where this discipline
breaks down.

---

## 3. What Is Working Well

Listed explicitly so none of it gets refactored away by mistake while acting on the findings below:

- **The booking-confirmation saga** (`src/app/api/bookings/confirm/route.js`): a real
  compensating-transaction pattern across Postgres, Zoom, and Google Calendar, with an atomic
  slot-hold RPC resolving the availability race *before* any external call, and rollback +
  urgent-task creation on failure. [Phase 4](phase-4-complexity-and-async.md#a-booking-confirmation-implements-a-real-compensating-transaction-saga-pattern).
- **`process-apollo-enrichment`'s claim-before-process guard**: correctly prevents double-processing
  under concurrent Edge Function invocations, with retry-with-backoff and an audit trail on failure.
  [Phase 4](phase-4-complexity-and-async.md#b-process-apollo-enrichment-correctly-guards-against-concurrent-edge-function-invocations).
- **Stripe and Resend webhook idempotency**: duplicate-event detection before any write, and a
  database unique constraint as the idempotency mechanism for Resend events.
  [Phase 1 Finding 5](phase-1-architecture-layers.md#finding-5--money--and-state-critical-logic-correctly-lives-in-transactional-postgres-rpcs).
- **The pricing client/server split**: `lib/pricing.js` (shared constants, client-safe) vs.
  `lib/server/pricing.js` (authoritative calculation, server-only) — the correct boundary to
  prevent price tampering, and a single source of truth, not duplication.
  [Phase 1 Finding 4](phase-1-architecture-layers.md#finding-4--pricing-layering-is-a-good-pattern-preserve-it).
- **Existing test quality**: `stripe/webhook/route.test.js` and its siblings assert on behavior
  through a well-built Supabase-client mock, not implementation details, and cover real scenarios
  (duplicate replay, amount mismatch, alert-channel failure).
  [Phase 3](phase-3-testing.md#whats-working-well-read-this-before-the-gaps-below).
- **`send-approved-outreach`'s defensive design**: layered kill switches, a sending-window gate,
  and per-item error isolation so one bad record can't halt or corrupt a whole outreach batch.
  [Phase 4](phase-4-complexity-and-async.md#c-send-approved-outreach-has-per-item-error-isolation-and-layered-kill-switches).
- **`ingest-gmail-replies`**: the largest single Edge Function, but a positive counterexample —
  genuinely complex MIME-parsing and reply-classification logic, decomposed into small,
  single-purpose functions rather than left as one block.
  [Phase 4](phase-4-complexity-and-async.md#ingest-gmail-repliesindexts--largest-edge-function-but-a-positive-counterexample).
- **Large SEO/marketing page files are not a problem**: sampled and confirmed to be long because
  the content is long, not from accidental complexity — don't split them for the sake of it.
  [Phase 2](phase-2-refactoring-maintainability.md#explicitly-not-findings-preserve-as-is).
- **The gates that exist are honored**: lint, typecheck, and tests all pass cleanly when actually
  run — verified, not assumed, in [Phase 5](phase-5-static-analysis.md#current-gate-inventory-verified-by-running-it).

---

## 4. Critical and High-Priority Findings

No Critical findings. High-priority findings, evidence-backed in their source phase:

1. **5 active dependency vulnerabilities (4 high severity)** currently sit in the dependency tree —
   PostCSS source-map path traversal (×2 advisories) and a `sharp`/libvips CVE chain — undetected
   because no dependency scanning exists anywhere in the project.
   [Phase 5 Finding 2](phase-5-static-analysis.md#finding-2--no-dependency-vulnerability-scanning-5-active-vulnerabilities-currently-present).
   **Priority: High. Effort: Small to detect, Medium to resolve.**
2. **No CI pipeline exists at all.** Every quality gate in this repo — lint, typecheck, test — is
   opt-in, run only if a developer chooses to. This is the precondition for the vulnerabilities
   above going unnoticed, and for every other finding in this report staying fixed once addressed.
   [Phase 5 Finding 1](phase-5-static-analysis.md#finding-1--no-ci-pipeline-exists-every-gate-is-opt-in).
   **Priority: High. Effort: Small.**
3. **No shared email-sending abstraction, and behavior has already drifted.** The
   reserve→send→record pattern is reimplemented 11 times across booking routes, the Stripe
   webhook, office actions, and Edge Functions; only one of the eleven sends an idempotency-key
   header. [Phase 1 Finding 2](phase-1-architecture-layers.md#finding-2--no-shared-email-sending-abstraction-behavior-has-already-drifted).
   **Priority: High. Effort: Medium.**
4. **Three high-value, low-effort test gaps**: `lib/server/pricing.js`'s actual price-calculation
   function, the office authorization gate (`office-auth.js`), and the canonical timezone utility
   (`booking-time.js`) are all untested — each a pure or near-pure function, each cheap to cover
   given the testing infrastructure already in place.
   [Phase 3](phase-3-testing.md#prioritized-list-highest-value-tests-to-add-first).
   **Priority: High. Effort: Small (all three).**

---

## 5. Refactoring Opportunities

Ranked by expected value (full evidence in the linked findings):

1. **Extract `src/lib/server/email.js`** (and a Deno equivalent for Edge Functions) to collapse the
   11-site duplication described in §4 above. Highest-value refactor in the repo — duplication has
   already caused observable drift, not just theoretical risk.
   [Phase 1 Finding 2](phase-1-architecture-layers.md#finding-2--no-shared-email-sending-abstraction-behavior-has-already-drifted).
2. **Decompose `src/app/office/actions.js`** into `src/lib/server/office/*` domain modules, mirroring
   the booking domain's already-proven pattern. This is both the architecture fix
   ([Phase 1 Finding 6](phase-1-architecture-layers.md#finding-6--srcappofficeactionsjs-is-an-814-line-file-acting-as-the-whole-office-service-layer))
   and the complexity fix (quantitatively the densest file in the repo,
   [Phase 4](phase-4-complexity-and-async.md#officeactionsjs--the-one-real-hotspot)) — largest
   single effort in this report, but it also unlocks testability for the office domain as a
   side effect.
3. **Close the office error-code gap**: `office-errors.js` covers ~15 of 70+ codes `actions.js`
   actually emits. Directly improves the daily-use tool's usability.
   [Phase 2 Finding 4](phase-2-refactoring-maintainability.md#finding-4--office-error-code-dictionary-covers-a-small-fraction-of-the-codes-actually-produced).
4. **Deduplicate small helpers**: the `clean()` sanitizer (5 copies, one behaviorally divergent) and
   inline rate-limit key hashing (13 sites). Small, independent, low-risk.
   [Phase 2 Findings 1-2](phase-2-refactoring-maintainability.md#finding-1--clean-input-sanitizer-duplicated-5-times-with-one-silent-behavioral-divergence).
5. **Fix the cross-runtime recommendation-data duplication** (`send-nurture-emails`'s hand-mirrored
   copy of `src/lib/recommendations.js`, synced only by a code comment). Constrained by the
   documented JS/Deno runtime split, so genuinely Medium effort, not trivial.
   [Phase 1 Finding 3](phase-1-architecture-layers.md#finding-3--cross-runtime-business-rule-duplication-enforced-only-by-a-code-comment).
6. **Repo hygiene**: delete the confirmed-orphaned root-level scraping scripts and unreferenced
   1MB `bundle.js`. [Phase 2 Finding 5](phase-2-refactoring-maintainability.md#finding-5--orphaned-root-level-scripts-and-a-1mb-unreferenced-bundle).
7. **Add a `getOfficeDb()` helper** combining `requireOfficeUser()` with the admin client, so office
   pages' authorization travels with their data-access capability instead of depending on route-group
   placement. [Phase 1 Finding 1](phase-1-architecture-layers.md#finding-1--office-data-access-has-no-defense-in-depth-beyond-route-group-nesting).

**Explicitly not recommended**: refactoring the large SEO page files, replacing the in-memory rate
limiter with a distributed store, or "fixing" the pricing.js/server-pricing.js split — see
[§3](#3-what-is-working-well) and [Phase 2's "explicitly not findings"](phase-2-refactoring-maintainability.md#explicitly-not-findings-preserve-as-is).

---

## 6. Testing Assessment

Full detail in [Phase 3](phase-3-testing.md). Summary:

- **Current coverage**: strong on booking mutation routes, Stripe checkout/webhook, and lead/funnel
  ingestion — all with tests that assert on behavior via a well-designed Supabase-client mock, not
  implementation detail.
- **Major gaps, risk-ranked**: (1) the actual price-calculation function, (2) the office
  authorization gate, (3) the canonical timezone utility — all High priority, all Small effort;
  then the Resend webhook, bot/abuse protection (Turnstile/rate-limit), lead-scoring logic,
  `office/actions.js`, all 14 Edge Functions, and the Aug 15 game-RPC security-hardening
  migrations — all currently at zero test coverage.
- **No coverage-measurement tool** is installed, so this assessment is a direct source-vs-test-file
  diff, not a report. [Phase 5](phase-5-static-analysis.md#coverage-reporting-cross-reference)
  recommends adding one as informational output once the risk-ranked list above is actually worked
  through, not as an immediate blocking gate.
- **Recommended test types for the gaps above**: a unit test for the pricing calculation (a pure
  function, no mocking needed) plus unit tests for the office authorization gate and the timezone
  utility (both need a small seam of their own — mocking `createSupabaseServerClient` for the
  former, establishing a time-mocking convention for the latter, since neither is currently
  exercised anywhere in the suite); an API/integration test for the Resend webhook in the same
  shape as the existing Stripe webhook test; one pgTAP-style SQL test proving the game-RPC
  authorization checks actually reject unauthorized callers; and a Deno-native test for at least one
  Edge Function to establish that runtime's testing convention before extending further.
- `@testing-library/react` is installed and completely unused — decide to either use it or remove it.

---

## 7. Complexity Hotspots

Full detail and the measured branch-density table in
[Phase 4](phase-4-complexity-and-async.md#complexity-hotspots). Summary:

- **`src/app/office/actions.js` is the one real hotspot** — largest file in the repo (814 lines) and
  highest measured branch density (0.46), combining legitimate domain complexity (≈15 real
  workflows) with accidental complexity (all flattened into one file with no per-workflow
  extraction). Addressed by the Refactoring Opportunity #2 above.
- **Everything else that looked complex by size was legitimate**: the booking-availability route's
  high branch density is inherent scheduling-algorithm complexity correctly contained to 83 lines;
  the booking confirm/reschedule routes' complexity is a hand-rolled distributed-transaction saga,
  appropriate given three external systems and no workflow engine; the largest Edge Function
  (`ingest-gmail-replies`, MIME parsing + reply classification) is genuinely complex and well
  decomposed. None of these need refactoring for complexity's sake.

---

## 8. Real-Time / Async Architecture Assessment

This section is retitled from the prompt's "Real-Time Application Concerns" for the reason
established in [Phase 0 §5](phase-0-architecture-map.md#5-correction-to-the-plans-real-time-framing):
this repo contains no persistent-connection or stateful-server component — the actual live game
product lives in a separate, out-of-repo application reached only via a redirect. What this repo
does have is a substantial async/webhook/automation surface, assessed in
[Phase 4](phase-4-complexity-and-async.md#async--webhook--automation-reliability):

- **Booking-availability race conditions**: resolved correctly via an atomic Postgres RPC claiming
  the slot before any external call — not a JS check-then-act race.
- **Webhook idempotency** (Stripe, Resend): correct, verified in Phase 1.
- **Edge Function concurrency**: `process-apollo-enrichment` correctly guards against overlapping
  invocations via a claim-then-process pattern with retry-with-backoff on failure.
- **Batch/partial-failure handling**: `send-approved-outreach` isolates per-item failures so a bad
  record can't halt or corrupt a whole automated send.
- **Gaps found, all small**: booking confirmation's compensation/rollback failures (as opposed to
  primary failures) are silently swallowed with no logging
  ([Finding 1](phase-4-complexity-and-async.md#finding-1--compensation-rollback-failures-are-silently-swallowed-in-booking-confirmation),
  Medium priority); the Edge Function webhook shared-secret comparison isn't constant-time
  ([Finding 2](phase-4-complexity-and-async.md#finding-2--webhook-shared-secret-comparison-is-not-constant-time),
  Low); the Apollo enrichment failure-recovery reset isn't scoped to its own run
  ([Finding 3](phase-4-complexity-and-async.md#finding-3--apollo-enrichments-failure-recovery-reset-isnt-scoped-to-the-failing-run),
  Low).

This is, on balance, the strongest area of the codebase — the team has clearly already reasoned
carefully about concurrency and partial failure in the systems that need it most.

---

## 9. Linting / Static Analysis / Quality Gates

Full detail in [Phase 5](phase-5-static-analysis.md). Summary:

- **Existing gates (ESLint via `eslint-config-next/core-web-vitals`, `tsc --noEmit`, Vitest) all
  pass cleanly** — verified by actually running them, not assumed from config.
- **The entire gap is enforcement, not configuration**: no CI pipeline exists, so nothing requires
  these to keep passing. This is the single highest-leverage fix available in this whole review —
  wiring the existing, already-passing `npm run check` into a GitHub Actions workflow.
- **No dependency vulnerability scanning** — and running `npm audit` during this review found 5
  real, active vulnerabilities that had gone undetected.
- **Edge Function TypeScript is linted but never type-checked** — `tsconfig.json`'s `include` only
  covers `src/**`, silently excluding the ~2,600 lines of Deno automation code.
- **`strict: false`** in `tsconfig.json` despite `checkJs`/`allowJs` already being on — unrealized
  value, not a current problem; recommend incremental adoption (`strictNullChecks` first), not a
  single global flip.
- **No formatter or pre-commit hook** — lowest priority of this phase's findings.
- **SonarQube/SonarCloud is explicitly not recommended** at this repo's current size and
  single-operator-adjacent shape. The concrete risks this review found are all addressable by the
  cheap, specific steps above; GitHub's native CodeQL + Dependabot cover the security-scanning angle
  without adopting a second platform. Revisit only if the team or number of actively-developed
  repos grows meaningfully.

---

## 10. Recommended Target Architecture

**No large-scale architectural change is justified**, and none is recommended. The architecture is
fundamentally sound where it matters most: thin route handlers, atomic Postgres RPCs owning
business rules for money/state transitions, and a correctly-designed saga pattern for multi-system
orchestration. The one real structural gap — the office/growth domain's lack of a `lib/server`
layer — has a clear, incremental target: **make the office domain look like the booking domain
already does.** Concretely:

- `src/app/office/actions.js` → decomposed into `src/lib/server/office/{growth-experiments,
  sales-response, prospect-audit, ...}.js`, each independently testable the same way
  `booking-manage.js` and `booking-cleanup.js` already are, with `actions.js` reduced to thin
  `"use server"` wrappers.
- A shared `src/lib/server/email.js` (and Deno equivalent) absorbing the 11 duplicated call sites.
- A CI pipeline as the backbone everything else (coverage reporting, dependency scanning, Edge
  Function type-checking) plugs into — not a new platform. [Phase 5](phase-5-static-analysis.md#is-sonarqubesonarcloud-warranted-here)
  already weighed and rejected adopting SonarQube/SonarCloud for this repo's current size; the
  target here is wiring up the tooling that already exists, not adding a new one.

Nothing here requires introducing new architectural patterns (no new abstraction layers, no
framework changes, no rewrite) — it's applying the pattern that already works in one domain to the
domain that doesn't have it yet, plus closing tooling gaps.

---

## 11. Prioritized Improvement Plan

### Immediate
- Wire `npm run check` into CI ([Phase 5 F1](phase-5-static-analysis.md#finding-1--no-ci-pipeline-exists-every-gate-is-opt-in)).
- Triage and resolve the 5 active dependency vulnerabilities ([Phase 5 F2](phase-5-static-analysis.md#finding-2--no-dependency-vulnerability-scanning-5-active-vulnerabilities-currently-present)).
- Add tests for `calculateHostedPrice()`, `requireOfficeUser()`, and `booking-time.js` ([Phase 3](phase-3-testing.md#prioritized-list-highest-value-tests-to-add-first)).
- Fix the silently-swallowed compensation-rollback errors in booking confirmation ([Phase 4 F1](phase-4-complexity-and-async.md#finding-1--compensation-rollback-failures-are-silently-swallowed-in-booking-confirmation)).

### Near Term
- Extract the shared email-sending helper ([Phase 1 F2](phase-1-architecture-layers.md#finding-2--no-shared-email-sending-abstraction-behavior-has-already-drifted)).
- Begin decomposing `office/actions.js` ([Phase 1 F6](phase-1-architecture-layers.md#finding-6--srcappofficeactionsjs-is-an-814-line-file-acting-as-the-whole-office-service-layer)).
- Close the office error-code coverage gap ([Phase 2 F4](phase-2-refactoring-maintainability.md#finding-4--office-error-code-dictionary-covers-a-small-fraction-of-the-codes-actually-produced)).
- Add Edge Function type-checking to CI ([Phase 5 F3](phase-5-static-analysis.md#finding-3--edge-function-typescript-is-linted-but-never-type-checked)).
- Add a coverage-reporting tool (informational, not gating) ([Phase 5](phase-5-static-analysis.md#coverage-reporting-cross-reference)).
- Add the SQL regression test for the Aug 15 game-RPC hardening migrations ([Phase 3](phase-3-testing.md#prioritized-list-highest-value-tests-to-add-first)).
- Dedupe `clean()` and rate-limit-key hashing; add named timeout/rate-limit constants ([Phase 2 F1-3](phase-2-refactoring-maintainability.md#finding-1--clean-input-sanitizer-duplicated-5-times-with-one-silent-behavioral-divergence)).
- Add the `getOfficeDb()` defense-in-depth helper ([Phase 1 F1](phase-1-architecture-layers.md#finding-1--office-data-access-has-no-defense-in-depth-beyond-route-group-nesting)).
- Constant-time webhook secret comparison; run-scope the Apollo retry reset ([Phase 4 F2-3](phase-4-complexity-and-async.md#finding-2--webhook-shared-secret-comparison-is-not-constant-time)).
- Delete the orphaned root scripts and `bundle.js` ([Phase 2 F5](phase-2-refactoring-maintainability.md#finding-5--orphaned-root-level-scripts-and-a-1mb-unreferenced-bundle)).
- Add a `proxy.js` comment clarifying it isn't the auth boundary ([Phase 1 F7](phase-1-architecture-layers.md#finding-7--proxyjs-is-easy-to-mistake-for-the-authorization-boundary-but-isnt-one)).

### Long Term
- Resolve the cross-runtime recommendation-data duplication properly (shared data source instead of
  a code-comment sync convention) ([Phase 1 F3](phase-1-architecture-layers.md#finding-3--cross-runtime-business-rule-duplication-enforced-only-by-a-code-comment)).
- Incrementally enable `tsconfig.json` `strict` flags, starting with `strictNullChecks` ([Phase 5 F4](phase-5-static-analysis.md#finding-4--tsconfigjson-has-strict-false-despite-checkjsallowjs-already-being-on)).
- Decide on and establish a Deno testing convention, then extend test coverage across the
  remaining Edge Functions ([Phase 3](phase-3-testing.md#testability-observations-6)).
- Decide whether `@testing-library/react` gets used (component tests) or removed ([Phase 3](phase-3-testing.md#summary-for-phase-6)).
- Revisit SonarQube/cross-repo tooling only if team size or repo count grows meaningfully
  ([Phase 5](phase-5-static-analysis.md#is-sonarqubesonarcloud-warranted-here)).

---

## 12. Top 10 Actions

| # | Action | Priority | Effort | Affected | Expected Benefit |
|---|---|---|---|---|---|
| 1 | Wire `npm run check` into CI | High | Small | Whole repo | Turns every other fix in this report into an enforced guarantee instead of a one-time cleanup |
| 2 | Resolve the 5 active dependency vulnerabilities | High | Small–Medium | `package.json` deps (Next/PostCSS, sharp) | Closes real, currently-present security exposure |
| 3 | Test `calculateHostedPrice()`, `requireOfficeUser()`, `booking-time.js` | High | Small | `lib/server/{pricing,office-auth,booking-time}.js` | Covers the three highest-consequence untested functions (money, auth, repo-wide timezone correctness) for minimal cost |
| 4 | Extract shared `src/lib/server/email.js` | High | Medium | 11 call sites across bookings/Stripe/office/Edge Functions | Eliminates duplication that has already caused a behavioral drift (missing idempotency key) |
| 5 | Decompose `office/actions.js` into `lib/server/office/*` | Medium-High | Large | Office domain (814-line file, 19 dashboard pages indirectly) | Fixes the one real complexity hotspot and the one real layering gap in a single effort |
| 6 | Close office error-code coverage (`office-errors.js`) | Medium | Medium | `office/actions.js`, `office-errors.js` | Operator can actually diagnose failures in the tool the business runs on daily |
| 7 | Add Edge Function type-checking to CI | Medium | Small | `supabase/functions/*` (14 functions, ~2,600 LOC) | Closes the one blind spot in an otherwise fully-checked codebase |
| 8 | Fix swallowed compensation-rollback errors in booking confirm | Medium | Small | `src/app/api/bookings/confirm/route.js` | Prevents silently orphaned Zoom meetings/Calendar events with zero record for manual cleanup |
| 9 | Add SQL regression test for Aug 15 game-RPC hardening | Medium | Small–Medium | `supabase/tests/`, recent migrations | Protects the newest, most security-sensitive authorization logic in the repo from silent regression |
| 10 | Repo hygiene sweep (dead scripts, `clean()`/hash dedup, magic-value constants) | Low-Medium | Small | Repo root + ~15 files | Cheap, low-risk, removes drift-prone duplication and first-impression clutter |
