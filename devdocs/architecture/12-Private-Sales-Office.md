# 12 — Private Sales Office (`/office`)

An internal, single-operator CRM bolted onto the storefront. Not customer-facing. Everything here reads/writes the same Postgres project as the storefront, always via the service-role client — RLS on these tables exists but only to block anon/browser access outright, not to scope rows per user (see [15](15-Database-Schema-Map.md)).

## Authorization model

`src/lib/server/office-auth.js` implements the entire authorization model: `officeAllowedEmail()` returns one hardcoded email (`OFFICE_ALLOWED_EMAIL`, falling back to `INTERNAL_NOTIFICATION_EMAIL`); `getOfficeUser()` validates the session server-side via `supabase.auth.getUser()` and string-compares the returned email; `requireOfficeUser()` redirects to `/office/login` otherwise. **There is no roles/permissions table — authorization is "is this the one allowed email," full stop.** This is enforced exactly once, in `(private)/layout.js` (`force-dynamic`, calls `requireOfficeUser()`), which every page under the `(private)` route group inherits by directory placement — not by any per-page or middleware check (no `middleware.js` exists anywhere in the repo). This works today because every private page genuinely lives under that directory, but it's a structural convention, not a framework-enforced boundary — a future page added outside `(private)/` would have zero authorization by default.

Login is a magic-link flow (`requestMagicLink` server action): compares the submitted email against the allow-list (constant-behavior redirect either way, avoiding user-enumeration), soft-rate-limits via an `agent_log` lookback (a race window exists — no advisory lock, so two concurrent requests within the same second could both pass), generates a Supabase magic link, and emails it via Resend directly (not through `reserve_email_send`, since this predates any recipient/session existing). The `next` redirect param is validated in `src/app/auth/callback/route.js` to only accept paths starting with `/office`, blocking open-redirect via `//evil.com`.

## Dashboard (`(private)/page.js`) — "Needs Michael now"

Eight parallel Supabase queries surface: interested replies, overdue deal actions, today's calls, automation warnings (failed/blocked/escalated `agent_log` rows), post-call outcomes needing entry, outreach drafts pending review, deals needing proposals, and proposals pending approval/failed. A single batched `prospects` query avoids N+1 lookups. Every card's form action maps to a real, working server action — no stub data or TODOs found here. Uses a hand-rolled Eastern-time day-window calculation (parsing `Intl.DateTimeFormat` offset strings) rather than a timezone library — works, but fragile relative to a proper tz lib.

## Server actions (`src/app/office/actions.js`)

- **`reviewOutreachDraft`** — approve/reject a cold-outreach draft. Only *marks* it approved/rejected; sending happens later, asynchronously, via the separate `send-approved-outreach` Edge Function ([13](13-Outbound-Automation-Pipeline.md)). Silently no-ops with no user-visible error if `decision` isn't exactly `"approve"`/`"reject"`.
- **`updateSystemConfig`** — the Settings page save. No format validation on `prospecting_from_email` (only length-capped); a malformed sender address only surfaces as a failure later, at send time. **Does not expose `proposal_email_enabled`/`daily_proposal_cap` as editable fields** even though the proposal-send flow is gated by both — those can currently only be changed via direct SQL, with no UI indication of why proposal-sending might be silently blocked.
- **`recordCallOutcome`** — thin wrapper around the RPC `apply_post_call_outcome`, which does all validation/state-transition logic in SQL (booking status, deal stage/outcome, task completion) and writes its own `agent_log` row — the one action in this file that doesn't call the local `audit()` helper, an inconsistency (not a bug, since the RPC logs itself).
- **`createProposal`** — drafts (does not send) a priced proposal. Requires the prospect to have an email and `NEXT_PUBLIC_STRIPE_DEPOSIT_URL` to be configured, else no-ops with a slightly misleading generic error code. **The quoted `price` is display-only text in the email body; the actual `deposit_url` embedded is always the single global flat Stripe Payment Link** — there is no per-proposal, per-price Checkout Session. A custom $8,500 proposal still sends the client to the same fixed-amount deposit link used everywhere else in the repo (see [16](16-Payments-and-Stripe.md) for the full scope of this pattern). A unique index allows only one active proposal per deal; a second attempt surfaces a raw Postgres constraint-violation string to the UI rather than a friendly message.
- **`approveAndSendProposal`** — the "approve and send" combined action (unlike outreach drafts, proposals send in one step). Uses an atomic conditional UPDATE to claim the proposal before sending, correctly preventing a double-send race (contrast with the softer race in the magic-link rate limiter above). Gated by the same `reserve_email_send` RPC as every other sender in the repo; sends from the transactional identity (`INTERNAL_NOTIFICATION_EMAIL`), not the cold-outreach sender, since proposal recipients already had a call. **A genuine correctness gap**: if the Resend send succeeds and a subsequent `deals` update throws (e.g. a transient DB error), the `catch` block marks the proposal `"failed"` even though the customer already received the email and the `messages` table already recorded it as `sent` — the two records can end up disagreeing about whether the send actually happened.

All actions redirect raw Postgres/Resend error text into the URL query string rather than mapping to user-safe messages — consistent throughout the file, acceptable for a single-admin tool but worth noting as a pattern.

## Prospects pages

List page sanitizes free-text search input (strips `,()%`) before interpolating into a Supabase `.or(...ilike...)` filter string — a hand-rolled escape adequate for this specific filter syntax, not parameterized binding. Detail page fires ~9 parallel queries (company, leads, messages, bookings, tasks, deals, agent_log, outreach_drafts, proposals, deal_payments) and merges them into one chronological timeline — fully wired to real data, read-only (no forms live here; all mutations happen from the dashboard).

## Schema notes worth flagging

- `deal_stage_history` and its populating trigger exist and run, but **no office page ever displays it** — pure unused audit trail today, likely reserved for a future "time in stage" report.
- `proposals.metadata` (jsonb) is defined and never read or written by any office code.
- Deals are only ever *created* by DB triggers reacting to bookings/Stripe events, never by an office action — the office layer exclusively *advances* existing deals.
- The office's schema dependencies span five migrations, not just the three primarily about "the office" (`milestone1_deal_pipeline`, `milestone2_office_foundation`, `milestone2_proposal_index`) — `outreach_drafts.sequence_step` and both `system_config` outbound flags the Settings page reads come from later `milestone3`/`sequence_followups` migrations.

## Gaps (ranked)

1. **No UI to control `proposal_email_enabled`/`daily_proposal_cap`** — the dashboard's proposal-send flow depends on both, but they're DB-only toggles with no Settings-page exposure.
2. **Partial-failure inconsistency in `approveAndSendProposal`**: a `deals`-update failure after a successful Resend send can leave `proposals.status='failed'` while `messages` shows `sent` for the same event.
3. **Custom-priced proposals still use a flat, unrelated deposit link** — the quoted price is cosmetic text, not a real charge amount (repo-wide pattern, see [16](16-Payments-and-Stripe.md)).
4. **`reviewOutreachDraft` silently no-ops on an invalid `decision` value** with no user-visible error.
5. **Single hardcoded-email authorization model, enforced once by directory placement** — not designed for more than one operator, and a future page outside `(private)/` would need to remember to add its own check.
6. **Soft race condition in the magic-link rate limiter** — no advisory lock, so concurrent requests within the same second could both pass the "1/minute" guard.
