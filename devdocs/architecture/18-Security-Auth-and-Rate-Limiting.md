# 18 — Security, Auth & Rate Limiting

Consolidates the security-relevant findings scattered across docs 10–14 into one cross-cutting picture: who can do what, what stops abuse, and where those controls have gaps.

## Three distinct auth models, by surface

| Surface | Model | Notes |
|---|---|---|
| Storefront (public pages, lead forms) | None — anonymous by design | Browser never holds a Supabase key; all writes go through validated, rate-limited API routes using the service-role key server-side |
| Booking manage (`cancel`/`reschedule`) | Bearer capability token | 256-bit random token, SHA-256-hashed at rest, emailed to the customer. Possession of the link *is* the authorization — no account, no session. Same trust model as Calendly. Not a defect; the entropy makes brute-force impractical, and no endpoint leaks tokens by id. Means a forwarded/shared/compromised inbox can cancel or move someone else's booking — an inherent property of the design, worth knowing explicitly rather than assuming account-level protection exists |
| `/office` (private CRM) | Single hardcoded allow-listed email + Supabase magic-link session | No roles table, not designed for a second operator. Enforced exactly once, in the `(private)` route group's layout — a directory-placement convention, not a middleware-level or per-page check. No `middleware.js` exists anywhere in the repo |
| Edge Functions (12 of them) | Static `x-webhook-secret` header per function | None use Supabase JWT verification (`verify_jwt = false` across the board in `config.toml`). The secret header is the entire auth layer for every one of these publicly-reachable HTTP endpoints |

RLS is enabled on nearly every business table but paired with `revoke all from anon, authenticated` rather than row-scoped policies — see [15](15-Database-Schema-Map.md). Practically, RLS here blocks a hypothetical browser-side Supabase call using the anon key; it is not what's actually deciding who can see which rows. That decision is made entirely by which server-side code path (with the service-role key) chooses to query what — i.e., the real authorization boundary is code-level (`requireOfficeUser()`, a route's own validation), not database-level.

## Rate limiting

`src/lib/server/rate-limit.js` — a plain in-memory `Map`, per-process, resets on deploy (an explicit, accepted tradeoff per its own comment — not shared across serverless instances/regions). Sliding window, default 10min/5 requests, keyed by whatever string the caller hashes in.

**Usage is inconsistent across otherwise-similar routes:**
- `bookings/confirm`, `bookings/cancel`, `bookings/reschedule` — all import and use the shared lib, each with a distinct key prefix, sharing one bucket store.
- `bookings/availability` (**GET**, live Google Calendar freeBusy call per request) — **no rate limiting, no Turnstile at all.** Every other booking route is guarded; this one triggers a real upstream API cost (Google Calendar quota) on every request with zero abuse protection. This reads as an oversight given the pattern established by its three siblings.
- `/api/leads` — has its **own separate, structurally duplicated** copy of both `rateLimited()` and `verifyTurnstile()`, diffed line-for-line as behaviorally identical to the shared lib today (same defaults, same dev-bypass string) but living in its own unshared `Map`. No drift yet; a maintenance risk if the shared lib is ever tuned without remembering this second copy.
- Office magic-link request — a *soft* rate limit implemented as an `agent_log` lookback query rather than the shared in-memory limiter, with no advisory lock: two concurrent requests within the same second could both pass the "1/minute" check before either's log row lands.

## Turnstile (bot defense)

`src/lib/server/turnstile.js` — calls Cloudflare `siteverify`; fails closed in production if the secret is unconfigured (only accepts a literal `"development-bypass"` token, and only outside `NODE_ENV=production`). Used by all three booking mutation routes and `/api/leads` (its own duplicated copy, behaviorally identical). **Not used by `bookings/availability`** — same gap as the rate-limiting gap above, same route.

## Edge Function auth (the 12 webhook-secret-gated functions)

Every Supabase Edge Function in both the outbound pipeline ([13](13-Outbound-Automation-Pipeline.md)) and the lifecycle layer ([14](14-Lifecycle-Emails-and-Deliverability.md)) is reached via a public HTTPS URL, guarded solely by a static shared-secret header checked against an environment variable. There's no JWT, no per-caller identity, no rotation mechanism visible in the repo. This is a reasonable pattern for server-to-server (pg_net/pg_cron) invocation where the secret is generated once and stored in Supabase Vault, but it means the *entire* security of these 12 endpoints rests on that one secret per function never leaking (e.g. via logs, error messages, or a misconfigured CORS/proxy).

## Open-redirect and injection spot-checks (things that were checked and are fine)

- `next` redirect param on the office magic-link callback is validated to only accept paths starting with `/office` — blocks `//evil.com`-style protocol-relative redirects. Confirmed correct.
- Prospects search input is sanitized (`,()%` stripped) before interpolation into a Supabase `.or(...ilike...)` filter string — a hand-rolled escape, not parameterized binding, but adequate for this specific filter syntax. Worth another look only if the search feature grows more complex filter composition later.
- Booking cancel/reschedule return a single non-distinguishing `409` regardless of *why* the token lookup failed (invalid, already used, expired, never existed) — deliberately avoids giving an attacker an oracle to narrow down valid tokens.

## Gaps (ranked)

1. **`GET /api/bookings/availability` has neither rate limiting nor Turnstile**, unlike every other booking route — a real-cost (Google Calendar API), no-side-effect-visible endpoint that's easy to hammer unnoticed.
2. **`/office` has no roles table and no middleware-level enforcement** — authorization is a single hardcoded email plus a directory-placement convention. Fine for a single operator today; would need real work before a second team member could be added safely.
3. **`/api/leads` duplicates rather than shares the booking routes' rate-limit/Turnstile implementations** — no drift today, but two copies to keep in sync going forward.
4. **Soft race condition in the office magic-link rate limiter** (no advisory lock) — low severity given it only gates email-sending, not data access.
5. Booking's capability-token trust model (anyone with the emailed link can cancel/reschedule) is sound *given* the entropy and hashing in place, but should be stated as an explicit, understood tradeoff in any customer-facing security review — not silently assumed to be account-protected.
