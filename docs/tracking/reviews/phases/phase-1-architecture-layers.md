# Phase 1 — Architecture & Layer Assessment

Part of the [Code Review Plan](../CODE_REVIEW_PLAN.md), covering CODE_REVIEW_PROMPT.md §2
(Architecture Standards) and §3 (Layers and Components). Builds on
[Phase 0's architecture map](phase-0-architecture-map.md). No code was modified.

## Layer responsibility table

| Layer | Responsibility | Depends on | Depended on by | Verdict |
|---|---|---|---|---|
| `src/app/api/**/route.js` | Request validation, rate-limiting/bot-checks, orchestration | `src/lib/server/*`, Supabase RPCs | Nothing (entry point) | Mostly thin, some duplicated inline logic (Finding 2) |
| `src/lib/server/{booking-manage,booking-cleanup,booking-time,availability-access,google-calendar,zoom}.js` | Booking domain logic, third-party calendar/meeting integration | Supabase client passed in | Booking API routes | Clean, colocated tests exist — no issue found |
| `src/lib/server/{pricing,office-auth,supabase-admin,rate-limit,turnstile,posthog,organic-intent}.js` | Cross-cutting server concerns | `src/lib/pricing.js` (constants only) | API routes, office actions/pages | Clean; pricing split is a good pattern (Finding 4) |
| `src/lib/supabase/server.js` vs `src/lib/server/supabase-admin.js` | RLS-scoped (cookie) client vs. service-role (bypasses RLS) client | Supabase SDK | `src/app/office/**`, most API routes | Correctly separated, but see Finding 1 for how the boundary is enforced |
| Postgres RPCs (`supabase/migrations/*`) | Transactional business rules for money/state-critical operations (`process_paid_conversion`, `reserve_email_send`, booking status transitions) | — | API routes, office actions, Edge Functions | Working well — see Finding 5 |
| `src/app/office/actions.js` (814 lines) | Nominally the "service layer" for the office tool | Supabase admin client, `src/lib/server/*` | Office pages | Overloaded — see Finding 6 |
| `src/app/office/(private)/*/page.js` (19 files) | Data fetch + presentation for office dashboard | `getSupabaseAdmin()` directly | — | Auth correctly centralized in layout (Finding 1), but pages query the DB directly with no data-access layer of their own |
| Supabase Edge Functions (`supabase/functions/*`) | Async growth-automation, external API orchestration (Apollo, Resend, Gmail) | `_shared/runtime.ts`, Postgres RPCs | Supabase Cron (assumed) | Consistent internal shared-runtime pattern; cross-boundary duplication with `src/lib` (Findings 2, 3) |
| `src/proxy.js` | Refreshes Supabase auth cookie for `/office/*` | `@supabase/ssr` | Next.js middleware runtime | Not itself an authorization boundary — see Finding 7 |

No circular dependencies were found in the layers inspected; the dependency direction is
consistently `app → lib/server → lib` and `lib/server/pricing.js → lib/pricing.js`, one way.

---

## Findings

### Finding 1 — Office data-access has no defense-in-depth beyond route-group nesting
**Evidence**: `src/app/office/(private)/layout.js:8` calls `requireOfficeUser()` once, correctly
gating all 19 pages under the `(private)` route group (confirmed by grep — none of the 19
individual `page.js` files call `requireOfficeUser()` themselves; e.g.
`src/app/office/(private)/growth/page.js:1` and `src/app/office/(private)/prospects/[id]/page.js:3`
both call `getSupabaseAdmin()` — the RLS-bypassing service-role client — with no independent
authorization check of their own). Next.js renders a layout and its child page's data-fetching
concurrently rather than sequentially, so a page's service-role queries can execute before the
layout's `redirect()` resolves; the response is still never sent to an unauthenticated client, so
this is not a live data leak today, but authorization is enforced entirely by folder placement.

**Impact**: single point of failure. If any future office page is added outside the `(private)`
group, or a parallel/intercepting route is introduced, or the layout is refactored, that page would
have unauthenticated full-table access via the service-role key with nothing else stopping it. The
current structure is correct, but nothing makes it self-enforcing.

**Recommendation**: introduce a helper (e.g. `getOfficeDb()` in `src/lib/server/office-auth.js`)
that calls `requireOfficeUser()` and returns the admin client together, so the authorization check
travels with the data-access capability itself rather than depending on where the file happens to
live. Swap the 19 pages' `getSupabaseAdmin()` calls for it.

**Priority**: Medium. **Effort**: Small.

### Finding 2 — No shared email-sending abstraction; behavior has already drifted
**Evidence**: the sequence "reserve via `reserve_email_send` RPC → POST to
`https://api.resend.com/emails` → record via `record_email_send_result` RPC → log to `messages`"
is independently reimplemented at minimum 11 times:
- `src/app/api/bookings/cancel/route.js:22-77`
- `src/app/api/bookings/confirm/route.js:45,76,99`
- `src/app/api/bookings/reschedule/route.js:43,72,92`
- `src/app/api/stripe/webhook/route.js:24-58`
- `src/app/office/actions.js:49-99`, `:372-377`, `:698-733`
- `supabase/functions/{notify-new-lead,send-daily-sales-report,send-approved-outreach,send-nurture-emails,send-booking-reminders}/index.ts`

Drift has already happened: `src/app/office/actions.js:376` sends an `Idempotency-Key:
sales-response/${id}` header on its Resend call; none of the other 10 call sites do.

**Impact**: a fix or policy change (retry behavior, idempotency keys, header/timeout changes) has
to be found and applied in up to 11 places by hand, and — as the idempotency-key gap shows — that
already isn't happening consistently. This is exactly the "duplicated business rules" and
"inconsistent implementations of the same concept" pattern the review prompt asks to surface.

**Recommendation**: extract `src/lib/server/email.js` exporting a single
`sendTransactionalEmail({ messageType, recipient, subject, text, idempotencyKey })` that wraps the
reserve → send → record → log sequence, and use it from all 7 JS/route call sites. For the 5 Deno
Edge Function call sites, add an equivalent `supabase/functions/_shared/email.ts` (the JS/TS
runtime split documented in ARCHITECTURE.md means the two can't share one module, but each runtime
should still only implement the pattern once).

**Priority**: High. **Effort**: Medium.

### Finding 3 — Cross-runtime business-rule duplication enforced only by a code comment
**Evidence**: `supabase/functions/send-nurture-emails/index.ts:7-12` hardcodes a `RECS` lookup
table of game recommendations with the comment `// Mirrors src/lib/recommendations.js — keep
title/games in sync if that file changes.` The actual source of truth,
`src/lib/recommendations.js`, is a separate JS module in the Next.js app that the Deno Edge
Function cannot import.

**Impact**: nothing enforces the sync. If `src/lib/recommendations.js` changes, the nurture-email
copy silently diverges from what the site itself recommends, and no test or type check would catch
it — the comment is the entire mechanism.

**Recommendation**: move the recommendation data to a single source both runtimes can read at
runtime — either the Postgres database (a small `recommendations` table or RPC, matching the
pattern already used for other cross-cutting data) or a generated JSON artifact produced from
`src/lib/recommendations.js` at deploy time and bundled into the Edge Function. A code comment is
not a sync mechanism.

**Priority**: Medium. **Effort**: Medium — genuinely constrained by the JS/Deno runtime split, not
a trivial extraction.

### Finding 4 — Pricing layering is a good pattern; preserve it
**Evidence**: `src/lib/pricing.js` holds only shared constants (`HOSTED_PRICING`) and a
client-safe copy helper; `src/lib/server/pricing.js` imports those constants and owns the actual
`calculateHostedPrice()` logic server-side only, so the authoritative price a customer is charged
can never be computed or trusted from client input.

**Impact**: none — this is the correct client/server boundary for a value that must not be
tamperable, and it is a single source of truth (server file imports from the shared file rather
than redefining values).

**Recommendation**: none. Flagged explicitly so Phase 2 doesn't mistake the two-file split for
duplication and "simplify" it into something less safe.

### Finding 5 — Money- and state-critical logic correctly lives in transactional Postgres RPCs
**Evidence**: `src/app/api/stripe/webhook/route.js` delegates the actual client-conversion
decision to `process_paid_conversion` (called at `:72-74`) rather than reimplementing it in JS, and
guards against double-processing via a `stripe_events` uniqueness check on `event.id` before doing
any writes (`:136-159`). `src/app/api/bookings/cancel/route.js:110-117` updates the booking with
`.eq("status", "confirmed")` as part of the same query that flips it to `cancelled`, so a
concurrent cancel/reschedule can't race past the check. The Resend webhook
(`src/app/api/resend/webhook/route.js:35-47`) relies on a database unique constraint (Postgres
error `23505`) for idempotent event logging rather than an application-level check.

**Impact**: none — this is the review prompt's own stated preference ("clear code → simple
abstractions → measurable tests → automated enforcement") realized correctly: the routes are thin
orchestrators and Postgres owns the atomicity guarantees it's actually good at.

**Recommendation**: none. Preserve this pattern; Phase 6 should list it under "what's working well."

### Finding 6 — `src/app/office/actions.js` is an 814-line file acting as the whole office service layer
**Evidence**: `wc -l src/app/office/actions.js` → 814 lines. It handles growth-experiment
management, sales-response drafting/sending, lead magic-link auth, prospect audits, and more,
several with raw `fetch()` calls to Resend embedded directly (`:83`, `:376`, `:722`) rather than
delegating to a `src/lib/server/*` module — unlike the booking domain, which does have a clean
`src/lib/server/booking-*.js` layer with colocated tests. No test file exists for `actions.js`.

**Impact**: inconsistent layering discipline between domains makes "where does this business rule
live" (the prompt's own maintainability question) harder to answer for the office/growth domain
than for bookings, and the lack of any extracted, unit-testable functions is why this file has zero
test coverage despite being the main mutation path for the entire internal sales tool.

**Recommendation**: extract `actions.js` into domain modules under `src/lib/server/office/*`
(e.g. `growth-experiments.js`, `sales-response.js`, `prospect-audit.js`), mirroring the booking
domain's existing pattern, leaving `actions.js` as a thin `"use server"` wrapper layer. This is a
large, multi-step refactor — Phase 2 should own the detailed breakdown; this phase only establishes
that the layering inconsistency exists and why.

**Priority**: Medium. **Effort**: Large.

### Finding 7 — `proxy.js` is easy to mistake for the authorization boundary, but isn't one
**Evidence**: `src/proxy.js` matches `/office/:path*` and only calls `supabase.auth.getUser()` to
refresh the session cookie (`:31`) — it never checks the user's email or redirects. The actual
authorization check is `requireOfficeUser()` in `src/app/office/(private)/layout.js:8`, which is
correct, but a maintainer skimming `proxy.js`'s matcher and seeing it scoped to `/office/*` could
reasonably assume it's doing the gating.

**Impact**: low — purely a clarity/documentation risk, not a functional one.

**Recommendation**: add a one-line comment in `proxy.js` noting that authorization happens in
`(private)/layout.js`, not here.

**Priority**: Low. **Effort**: Small.

---

## Summary for Phase 6

- **Preserve**: booking domain's `lib/server` layering (clean, tested), the pricing client/server
  split (Finding 4), and the RPC-owns-atomicity pattern for money/state transitions (Finding 5).
- **Fix soon**: the missing email abstraction (Finding 2) — highest-value refactor in this phase
  because drift has already occurred, not just duplication risk.
- **Plan for**: the `office/actions.js` decomposition (Finding 6) and the cross-runtime
  recommendation-data duplication (Finding 3) — both real but larger efforts requiring their own
  scoping.
- **Cheap wins**: Finding 1 (`getOfficeDb()` helper) and Finding 7 (a comment) are both Small effort.
