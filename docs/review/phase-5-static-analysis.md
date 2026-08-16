# Phase 5 — Static Analysis & Quality Gates

Part of the [Code Review Plan](../CODE_REVIEW_PLAN.md), covering CODE_REVIEW_PROMPT.md §10 (Static
Analysis and Linting). Builds on [Phase 0](phase-0-architecture-map.md)'s tooling inventory. This
phase actually ran the existing gates (`npm run lint`, `npm run typecheck`, `npm audit`) rather than
just reading their configuration, so the findings below are measured, not inferred. No code was
modified.

## Current gate inventory (verified by running it)

| Gate | Configured? | Currently passing? | Wired into CI? |
|---|---|---|---|
| ESLint (`npm run lint`, `eslint-config-next/core-web-vitals`) | Yes | **Yes** — 0 errors across 172 files (confirmed: 149 under `src/`, 15 under `supabase/functions/`) | No |
| TypeScript (`npm run typecheck`, `tsc --noEmit`) | Yes | **Yes** — 0 errors | No |
| Vitest (`npm test`) | Yes | Yes (per [Phase 3](phase-3-testing.md)) | No |
| Composite (`npm run check` = lint + typecheck + test) | Yes | Yes | **No — no `.github/workflows` or any CI config exists at all** |
| Coverage reporting | No tool installed | — | — |
| Dependency vulnerability scanning | No (`npm audit` isn't wired anywhere) | 5 active vulnerabilities present, see Finding 2 | No |
| Formatter (Prettier or equivalent) | Not present | — | — |
| Pre-commit hook (Husky or equivalent) | Not present | — | — |

The good news first: the three gates that do exist are honored, not just configured-and-ignored —
running all of them fresh produced a clean result. The gap isn't hygiene, it's enforcement: nothing
requires these to pass before code merges, because nothing runs them except a developer's own
discretion.

## Findings

### Finding 1 — No CI pipeline exists; every gate is opt-in
**Evidence**: confirmed via `find` in [Phase 0](phase-0-architecture-map.md#8-tooling--ci-surface-ground-truth-for-phase-5) —
no `.github/workflows` directory, and no other CI config (no `.gitlab-ci.yml`, no `Jenkinsfile`,
etc.) exists anywhere in the repo. `npm run check` bundles lint + typecheck + test correctly, but
nothing invokes it automatically on push or PR.

**Impact**: every other finding in this phase (and the dependency vulnerabilities below) is only
discoverable today by a developer choosing to run the right command. The repo currently passes all
its own gates, which is good, but there's no mechanism keeping it that way.

**Recommendation**: add a single GitHub Actions workflow that runs `npm run check` on push and pull
request. This is the highest-leverage single change available in this review — it doesn't require
new tooling, just wiring up what already exists and already passes.

**Priority**: High. **Effort**: Small (one workflow file, no new dependencies).

### Finding 2 — No dependency vulnerability scanning; 5 active vulnerabilities currently present
**Evidence**: `npm audit --omit=dev` was run as part of this phase and reports **5 vulnerabilities
(4 high, 1 moderate)** in the current dependency tree: two PostCSS advisories
(GHSA-6g55-p6wh-862q, GHSA-r28c-9q8g-f849 — source-map path traversal allowing arbitrary `.map`
file disclosure) and a high-severity `sharp`/libvips chain (CVE-2026-33327, CVE-2026-33328,
CVE-2026-35590, CVE-2026-35591). No Dependabot config, Renovate config, or CI step currently checks
for any of this.

**Impact**: this is not hypothetical — these are real, currently-present vulnerabilities that
nothing in the project's tooling would surface short of a developer manually running `npm audit`,
which this review just had to do to find them.

**Recommendation**: enable Dependabot security updates (GitHub-native, zero config beyond a
`.github/dependabot.yml`) or add `npm audit --audit-level=high` as a CI step per Finding 1. Note
`npm audit fix` alone did not offer a non-breaking resolution for these two advisories in the run
above (only `--force`, which would move Next.js outside its currently stated version range) — the
actual fix needs a deliberate, evaluated version bump, not a blind `--force`.

**Priority**: High (active, verified vulnerabilities). **Effort**: Small to enable scanning; Medium
to actually resolve the two flagged advisories once surfaced.

### Finding 3 — Edge Function TypeScript is linted but never type-checked
**Evidence**: ESLint does cover `supabase/functions/*.ts` (confirmed: 15 of the 172 linted files
are under `supabase/functions/`), but `tsconfig.json`'s `include` array only lists
`src/**/*.{js,jsx,ts,tsx}` plus a few Next.js-generated paths — `supabase/functions/**` is absent.
`npm run typecheck` (`tsc --noEmit`) therefore never type-checks any of the ~2,600 lines of Deno
TypeScript across the 14 Edge Functions, even though that code (per
[Phase 4](phase-4-complexity-and-async.md)) carries real logic: Apollo enrichment, outreach
sending, Gmail reply classification.

**Impact**: type errors in the Edge Functions — the automation layer that emails real prospects and
spends Apollo API credits — are caught only at Deno runtime execution, not by any local or CI gate,
unlike everything under `src/`.

**Recommendation**: add a second typecheck pass scoped to `supabase/functions` — either a
Deno-native `deno check supabase/functions/**/*.ts` step (each function already has its own
`deno.json`) or a separate `tsconfig` covering that directory, run alongside `npm run typecheck` in
the same CI step from Finding 1.

**Priority**: Medium. **Effort**: Small.

### Finding 4 — `tsconfig.json` has `strict: false` despite `checkJs`/`allowJs` already being on
**Evidence**: `tsconfig.json:9` sets `"strict": false`, while `"allowJs": true` and `"checkJs": true`
are already enabled — the project has already invested in JSDoc-based type-checking for its
JavaScript (visible throughout, e.g. the `/** @param {...} */` annotations in
`src/app/office/office-ui.js`), but without `strict`, that checking skips null/undefined safety,
implicit `any`, and related classes of bugs.

**Impact**: the infrastructure for meaningfully stronger type safety is already present and paid
for; it's just dialed down. This is a lower-severity finding than 1-3 because nothing here is
broken today — it's unrealized value, not a gap causing active risk.

**Recommendation**: not a flip-a-switch change (turning on full `strict` in one PR against ~150
existing JS files would likely surface a large one-time backlog of errors). If pursued, do it
incrementally: enable one flag at a time (`strictNullChecks` first, typically the highest-value/
lowest-noise flag), or scope strictness to new/touched files via a lint rule rather than the global
compiler flag.

**Priority**: Low. **Effort**: Medium (incremental by nature).

### Finding 5 — No formatter or pre-commit hook
**Evidence**: no Prettier config (`.prettierrc*`, `prettier.config.*`) and no Husky or other
pre-commit hook setup exist anywhere in the repo (confirmed via direct search).

**Impact**: style consistency depends entirely on developer discipline and code review, with no
automated backstop — matches the observation in [Phase 2](phase-2-refactoring-maintainability.md)
that some files (e.g. the office dashboard pages) are formatted very differently (dense,
largely-unwrapped single-line JSX) from the rest of the codebase. This isn't a functional problem,
but a formatter would have prevented the divergence rather than requiring a human to notice it.

**Recommendation**: add Prettier with the project's existing style as the baseline (or accept
ESLint's formatting-adjacent rules as sufficient, if the team is fine with the current variance) and,
once Finding 1's CI exists, consider a lightweight pre-commit hook — but this is the lowest-priority
item in this phase; don't let it compete with Findings 1-3.

**Priority**: Low. **Effort**: Small.

## Coverage reporting (cross-reference)

No coverage tool (`@vitest/coverage-v8` or equivalent) is installed — already noted in
[Phase 3](phase-3-testing.md#summary-for-phase-6). Recorded here as the static-analysis-tooling
side of that same gap: add `@vitest/coverage-v8` and a `test:coverage` script, wired into the CI
step from Finding 1 as **informational** output (a report, not a blocking threshold) until the
[Phase 3](phase-3-testing.md) priority list has actually been worked through — gating on a coverage
percentage before the highest-risk gaps (pricing calculation, office auth, timezone conversion) are
covered would just pressure low-value tests into existence to hit a number.

## Is SonarQube/SonarCloud warranted here?

**No, not at this repo's current size and team shape.** SonarQube's core value — cross-repo
dashboards, review-load reduction across many contributors, security-hotspot triage at scale —
doesn't clearly apply to what looks like a small, single-operator-adjacent codebase (recall from
[Phase 0](phase-0-architecture-map.md) that the entire "office" tool is gated to one hardcoded
email). The concrete risks this review actually found — the 5 dependency vulnerabilities, the
untested pricing/auth/timezone functions, the `office/actions.js` complexity hotspot — are all
already caught by the specific, cheap steps above (Findings 1-3, plus Phase 3's coverage list) at a
fraction of SonarQube's setup and ongoing-maintenance cost. Revisit this if the team or the number
of actively-developed repos grows enough that a cross-project view becomes genuinely useful, not
before.

If a metrics dashboard is wanted sooner than that, GitHub's own code-scanning (CodeQL, free for
public/most private repos on GitHub) plus the Dependabot alerts from Finding 2 cover the security
angle without adopting a whole second platform.

## Summary for Phase 6

- **Single highest-leverage action**: Finding 1 (CI wiring for the existing, already-passing
  `npm run check`) — everything else in this phase is either an addition to that same workflow or
  moot without it.
- **Real, active risk found during this phase itself**: Finding 2's 5 dependency vulnerabilities —
  this should be treated as more urgent than its "static analysis tooling" framing suggests, since
  it's not a process gap but a present condition.
- **Correct current baseline**: lint, typecheck, and tests all pass cleanly today — this phase's
  recommendations are about keeping that true automatically, not about fixing a currently-broken
  gate.
- **Explicitly not recommended**: SonarQube/SonarCloud, for now.
