# Phase 5 — Static Analysis & Quality Gates (Pass 2)

Covers prompt §10 (Static Analysis and Linting). Builds on
[phase-0-architecture-map-v2.md](phase-0-architecture-map-v2.md).

## 1. Current gate inventory

| Gate | Tool | Scope | Blocking? |
|---|---|---|---|
| Lint | ESLint (`eslint.config.mjs`, extends `eslint-config-next/core-web-vitals`) | React/Next/hooks/a11y rules only (62 active rules, verified via `--print-config`) | Yes, via `npm run check` |
| Typecheck | `tsc --noEmit` (`tsconfig.json`, `strict: false`, `checkJs: true`) | All of `src/**` | Yes, via `npm run check` |
| Strict typecheck | `tsc --project tsconfig.strict.json` (`strictNullChecks: true`) | 9 specific files (`recommendations`, `game-handoff`, `pricing`, `server/*.js`, `auth/callback`, `api/bookings/*`) — a migration gate, not repo-wide | Yes, separate CI step |
| Unit/integration tests | Vitest | `src/**/*.test.js` (34 files) | Yes, via `npm run check` |
| Dependency audit | `npm audit --audit-level=high` | npm deps | Yes, via `npm run check` |
| Coverage report | `vitest run --coverage` | `src/lib/**`, `src/app/api/**` | No — explicitly `continue-on-error: true`, informational only |
| Edge Function typecheck | `deno check` per function | All 14 `supabase/functions/*/index.ts` | Yes, separate CI job |
| Edge Function tests | `deno test` | `supabase/tests/*-test.ts` (5 files) | Yes, same CI job |
| DB regression | pgTAP via `supabase test db` | `game_rpc_hardening.sql` against ephemeral local Supabase | Yes, separate CI job |
| Dependency updates | Dependabot (`.github/dependabot.yml`) | npm, weekly, grouped by prod/dev | N/A — opens PRs, doesn't block |

`.github/workflows/ci.yml` triggers on both `push: branches: [main]` and `pull_request:` — confirmed
the workflow itself is wired to run on PRs (whether GitHub branch protection actually *requires*
these checks before merge is a repo-settings question outside what's visible from the workflow file
itself; noting the caveat rather than asserting it).

**All three CI jobs from Phase 0's inventory verified actually functional**, not just present:
`check`, `edge-functions-typecheck`, `database-regression` — each was already exercised
successfully during this session's own work (typecheck, full test suite, and audit all ran clean
in earlier phases of this pass).

## 2. Investigated a suspected critical gap — ruled out after empirical testing

`eslint.config.mjs`'s `globalIgnores` includes a bare `"*.js"` entry (commented as copied from
"Default ignores of eslint-config-next"). Read in isolation, gitignore-style glob semantics would
suggest this recursively ignores every `.js` file in the repo — which would mean `npm run lint`
lints almost nothing, since ~190 of `src/`'s files are `.js`.

**Tested empirically rather than trusting the pattern-reading**: created a probe file at
`src/__eslint_probe.js` containing a deliberate `react/jsx-key` violation (a rule confirmed active
via `--print-config`) and ran `npx eslint` against it directly. It **was** flagged (`exit code: 1`,
correct error reported) — the same violation in a parallel `.jsx` probe was also caught. The bare
`*.js` ignore entry does not exclude `src/` in practice (ESLint flat-config `ignores` patterns
don't follow gitignore's recursive-by-default semantics the way the comment's phrasing might
suggest). **No finding here** — flagging the investigation itself since this is exactly the kind
of static-analysis claim the prompt says not to make without tracing the actual behavior, and the
first read of the config was misleading.

## 3. Real gap found: no base JS-correctness rules anywhere in the toolchain

**Finding**: neither ESLint nor TypeScript currently catches unused variables, unused imports, or
similar basic dead-code/correctness issues in any of the ~190 `.js` files.

**Evidence**:
- `eslint-config-next/core-web-vitals`'s active rule set (`--print-config`, 62 rules) is
  React/Next/`react-hooks`/`jsx-a11y`-scoped plus one `import/no-anonymous-default-export` — it
  does not extend `eslint:recommended` or include `no-unused-vars`/`no-undef` in any form.
- `tsconfig.json` and `tsconfig.strict.json` both omit `noUnusedLocals`/`noUnusedParameters` (the
  specific opt-in flags `tsc` requires to report unused locals — confirmed absent via direct
  inspection of both files; without them, `checkJs: true` still won't flag an unused variable).

**Impact**: this is squarely the kind of low-severity, high-frequency issue static analysis exists
to catch cheaply — an unused import left behind after a refactor (exactly the pattern flagged and
fixed in the office decomposition's copy-pasted-boilerplate cleanup, in an earlier working session)
currently has to be caught by a human reviewer or an agent doing a manual grep, not by the gate that
runs on every PR.

**Recommendation**: add `no-unused-vars` (or the more precise `eslint-plugin-unused-imports` for
auto-fixable unused-import removal specifically) to `eslint.config.mjs`. Small, targeted addition —
not a large rule-set import — matching the plan's bias against noisy linting.

**Priority**: Medium. **Effort**: Small (one rule addition; may surface a handful of pre-existing
violations to clean up in the same PR, but nothing architectural).

## 4. SonarQube/SonarCloud — still not warranted, re-confirmed for this pass

Re-evaluated rather than assuming the Aug 15 conclusion still holds:

- **What SonarQube would add beyond current tooling**: automated duplication detection, a
  maintainability/complexity dashboard, security-hotspot scanning across languages (useful for the
  mixed JS/TypeScript/Deno/SQL surface this repo actually has).
- **What it would cost**: a new platform to configure, authenticate, and maintain; a new dashboard
  for a single-team project to check in addition to CI's pass/fail signal; for a repo this size
  (~190 JS files, 14 Edge Functions), the marginal signal is thin — this pass's own manual
  duplication/dead-code check (Phase 2) found exactly two small items (`email-test 2.ts`, the
  `growth.js` naming inconsistency) via plain `grep`, in minutes, without tooling.
- **Cheaper alternative already covers the one real gap found this pass**: §3's ESLint rule
  addition is a two-line config change vs. standing up a new scanning platform.

**Conclusion unchanged from Aug 15**: not warranted at this repo's current size and team scale.
Revisit if the team grows enough that manual duplication/dead-code spot-checks stop being
practical, or if the security-hotspot-scanning angle becomes more relevant (e.g., if the codebase
starts handling a wider variety of untrusted input types).

## 5. Positive notes

- Dependabot is configured and grouped sensibly (prod/dev dependency groups, weekly cadence) — a
  genuinely useful, low-maintenance gate not present in many repos this size.
- The three-job CI split (`check` / `edge-functions-typecheck` / `database-regression`) correctly
  isolates the Node, Deno, and Postgres toolchains rather than forcing them into one script — each
  job fails independently and clearly, which matters given this repo genuinely spans three runtimes.
