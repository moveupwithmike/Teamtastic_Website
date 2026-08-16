# Phase 1 — Architecture & Layer Assessment (Pass 2)

Covers prompt §2 (Architecture Standards) and §3 (Layers and Components). Builds on
[phase-0-architecture-map-v2.md](phase-0-architecture-map-v2.md).

## 1. Layer responsibility table

| Layer | Responsibility | Depends on | Depended on by |
|---|---|---|---|
| `src/app/api/*` route handlers | HTTP boundary: parse/validate request, orchestrate a multi-step flow, map outcomes to responses | `src/lib/server/*` | External clients only |
| `src/app/office/actions.js` | Server-Action boundary: pure re-export, zero logic | `src/lib/server/office/*` | 22 private page components (via form `action=`) |
| `src/lib/server/office/*` (19 files) | Office business logic: auth, one thin wrapper pair (growth/growth-experiments, sales-response-actions/sales-response), and 16 other domain modules | `src/lib/server/{office-auth,supabase-admin,email,http}.js`, `office/shared.js` | `office/actions.js` only |
| `src/lib/server/*.js` (17 files, excl. office/) | Cross-cutting server concerns: email, rate-limit, pricing, validation, external API clients (Zoom/Calendar/Turnstile), Supabase admin client construction, office auth | `@supabase/supabase-js`, external SDKs | API routes, office/*, auth callback |
| `src/lib/supabase/server.js` | User-session Supabase client (cookie-bound, RLS-respecting) | `@supabase/ssr` | office-auth.js, authentication.js, auth/callback |
| `src/lib/*.js` (top-level, 12 files) | Client-safe presentation/domain logic (pricing copy, recommendations, quiz scoring) | Nothing server-only | Client components, some server code (read-only) |
| `src/components/*.js` | React UI | `src/lib/*.js` (client-safe only) | Pages |
| `supabase/functions/*/index.ts` | Edge Function entry points: cron/webhook-triggered automation | `_shared/{runtime,email,outreach,booking-reminders,nurture}.ts` | Supabase cron/webhooks only |
| `supabase/functions/_shared/*.ts` | Deno-side cross-cutting: webhook auth, Resend send primitive, deterministic copy/window helpers | Nothing internal | 5 of 14 Edge Functions (the other 9 use only `runtime.ts`) |
| `supabase/migrations/*.sql` | Schema, RPCs, RLS | Postgres | Both JS and Deno layers via `supabase-js`/`admin.rpc()` |

## 2. Dependency direction — clean

Checked both directions that would signal a real problem:
- **`src/lib/server/*` importing from `src/app/*`** (would mean business logic reaching back into
  the framework layer): zero hits.
- **Client-safe `src/lib/*.js` importing from `src/lib/server/*`** (would break client bundling by
  pulling server-only code into browser bundles): zero hits.

No circular imports found among the 18 `office/*` domain modules — the only internal cross-imports
are the two known thin-wrapper pairs (`growth.js` → `growth-experiments.js`,
`sales-response-actions.js` → `sales-response.js`), each a one-way, one-hop dependency.
`proposals.js` (the largest domain module at 256 lines) has exactly one internal importer
(`actions.js`) — it's a leaf, not a hub anything else depends on.

## 3. Two Supabase client constructors — correctly separated, not duplicated

`src/lib/supabase/server.js` (`createSupabaseServerClient()`, cookie-bound, RLS-respecting) and
`src/lib/server/supabase-admin.js` (`getSupabaseAdmin()`, service-role, RLS-bypassing) look
superficially similar but have genuinely distinct responsibilities — one authenticates *as* the
signed-in user, the other acts *as the system*. `getSupabaseAdmin()` is called from three places
outside `office/*`/API routes: `auth/callback/route.js` (audit-log insert on sign-in),
`book/manage/[token]/page.js` (public token-based booking management — not office-gated, so it
needs its own privileged access), and `office-auth.js` itself (inside `getOfficeDb()`). All three
are legitimate; no evidence of the admin client being reached for casually where the session client
would do.

## 4. Auth boundary — defense-in-depth confirmed, no regressions

Since Aug 15, office auth moved from a single hardcoded `OFFICE_ALLOWED_EMAIL` to a list-based
`officeAllowedEmails()`/`isOfficeAllowedEmail()` (`src/lib/server/office-auth.js`). Checked for the
two failure modes this kind of change typically introduces:

- **Reimplementation drift** — a second, independent copy of the allow-list check that could fall
  out of sync. None found: `grep` for `officeAllowedEmail` across `src/` turns up only the one
  definition and its three legitimate call sites (`office-auth.js`, `office/authentication.js`,
  `auth/callback/route.js`).
- **Inconsistent enforcement across the 22 private pages** — checked every `page.js` under
  `src/app/office/(private)/` for how it obtains its DB client: **all 22** use `getOfficeDb()`
  (the auth-check-bundled-with-admin-client helper), **zero** call `getSupabaseAdmin()` directly.
  This means the "page lives under `(private)`" convention isn't the only thing standing between
  an unauthenticated request and privileged data access — every single page's own data-fetching
  call independently re-asserts the auth check, exactly as `getOfficeDb()`'s own code comment
  states it's designed to do.

The layout-level gate (`requireOfficeUser()` in `(private)/layout.js:8`) and the per-page gate
(`getOfficeDb()`) are redundant with each other by design, not accidentally duplicated — removing
either one would still leave the other enforcing the boundary. That's the intended defense-in-depth
shape, not two competing implementations.

## 5. Nominal-only / pass-through layers

- **`src/app/office/actions.js`** is intentionally nominal — a pure Server-Action boundary with no
  logic, confirmed by direct inspection (41 one-line delegations, zero conditionals). This is the
  correct shape for this layer: Next.js requires Server Actions to be exported from a `"use server"`
  file, and keeping that file logic-free is what makes the 19 files underneath it independently
  testable without a Next.js runtime. Not a finding — this is the pattern working as intended.
- **`growth.js`** and **`sales-response-actions.js`** are the same pattern at smaller scale: thin
  auth+redirect+revalidate wrappers around `growth-experiments.js`/`sales-response.js`. Also
  correct — it's what makes the wrapped modules testable with plain Vitest mocks instead of
  Next.js's Server Action/redirect machinery (confirmed: `growth-experiments.test.js` and
  `sales-response.test.js` both exist and test the un-wrapped logic directly).
- **API route handlers are not pass-through** — `bookings/confirm/route.js` (281 lines) and
  `bookings/reschedule/route.js` (280 lines), the two largest, correctly delegate every external
  integration (Zoom, Google Calendar, Turnstile, rate-limiting, email) to `src/lib/server/*`; their
  size comes from orchestrating a multi-step compensating-transaction workflow (hold → create Zoom
  meeting → create Calendar event → confirm → email, with rollback on failure at each step) inline,
  plus a handful of request-flow-local helpers (`validEmail`, `fail`, `logCleanupFailure`,
  `sendConfirmationEmail`). That's legitimate orchestration living at the boundary layer where the
  saga actually happens, not business logic misplaced in a controller. Whether 280 lines is *too
  much* for one file is a Phase 4 complexity question, not a layering violation — flagged there,
  not here.

## 6. Missing / unnecessary abstractions

- **No missing abstraction found for the Resend send primitive** — this was the Aug 15 review's
  headline finding (duplicated reserve→send→record logic, one of ~13 copies missing an
  idempotency key) and it's now centralized on both sides: `src/lib/server/email.js` (JS,
  `sendViaResend()`) and `supabase/functions/_shared/email.ts` (Deno, also `sendViaResend()`, now
  *requiring* an idempotency key as a parameter rather than treating it as optional — a stricter
  contract than the JS side, worth aligning in a later pass but not a regression).
- **No unnecessary abstraction found** — no repository/interface/factory layer sitting over
  Supabase calls; `office/*` modules call `db.from(...)`/`db.rpc(...)` directly, which matches the
  plan's stated bias against ceremony for ceremony's sake and is consistent with the small,
  single-team scale of this codebase.
- **One naming inconsistency, not a missing abstraction**: `growth.js`/`growth-experiments.js` and
  `sales-response-actions.js`/`sales-response.js` implement the identical wrapper pattern but name
  the wrapper differently (`growth.js` vs. `*-actions.js`). Low-value, low-cost fix — noted for
  Phase 2, not worth its own architectural finding here.

## 7. Office error-code contract — still fully covered

`src/lib/server/office-errors.js` acts as the contract between the action layer and the UI layer
(every `errorCode` a Server Action can return must be registered there so the UI can render a real
message instead of a raw code). Cross-checked every `errorCode:` literal across all 19 `office/*`
files against the registered set: **zero unregistered codes** — the Aug 15 fix here hasn't
regressed as the module count grew from ~14 to 19.

---

**Summary**: no boundary violations, no wrong-direction dependencies, no circular imports, no auth
regressions. The one concrete artifact worth carrying into Phase 2 is the `growth.js` vs.
`sales-response-actions.js` naming inconsistency; everything else in this phase is confirmation
that the Aug 15 fixes hold, not new findings.
