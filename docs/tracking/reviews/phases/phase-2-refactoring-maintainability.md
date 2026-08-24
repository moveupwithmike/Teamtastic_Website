# Phase 2 — Refactoring Opportunities & Maintainability

Part of the [Code Review Plan](../CODE_REVIEW_PLAN.md), covering CODE_REVIEW_PROMPT.md §4
(Refactoring Opportunities) and §5 (Maintainability). Builds on
[Phase 0](phase-0-architecture-map.md) and [Phase 1](phase-1-architecture-layers.md) — this phase
does not re-litigate Phase 1's Findings 2 (email duplication), 3 (cross-runtime recommendation
duplication), or 6 (`office/actions.js` size); it adds findings Phase 1 didn't cover. No code was
modified.

## Findings

### Finding 1 — `clean()` input sanitizer duplicated 5 times, with one silent behavioral divergence
**Evidence**: an identical-looking helper is redefined locally in five route files instead of
living in one shared module:
- `src/app/api/bookings/cancel/route.js:13`
- `src/app/api/bookings/confirm/route.js:12`
- `src/app/api/bookings/reschedule/route.js:14`
- `src/app/api/leads/route.js:24`
- `src/app/api/stripe/checkout/route.js:11`

Four of the five share the body `typeof value === "string" ? value.trim().slice(0, max) : ""`.
`stripe/checkout/route.js:11-13` instead uses `String(value || "").trim().slice(0, max)` — a
different function that coerces non-string input (numbers, objects) into a string rather than
discarding it. This is exactly the kind of drift copy-pasted helpers accumulate silently.

**Impact**: low severity today (both variants reject empty/falsy input), but it means the five
routes don't actually share validation behavior despite looking like they do, and a future bugfix
applied to one copy won't propagate to the other four.

**Recommendation**: move `clean()` to `src/lib/server/validation.js`, pick one behavior (the
`typeof === "string"` variant is stricter and used by 4/5 sites), and import it everywhere.

**Priority**: Medium. **Effort**: Small.

### Finding 2 — Rate-limit key hashing is copy-pasted inline at every call site
**Evidence**: `createHash("sha256").update(...).digest("hex")` appears 13 times across
`src/app/api/**/route.js` to build rate-limit keys and token hashes (e.g.
`src/app/api/bookings/cancel/route.js:92,98`, `reschedule/route.js:123,129,147`,
`confirm/route.js:139,152`, `availability/route.js:23`, `availability-access/route.js:10`,
`funnel-events/route.js:17`, `leads/route.js:59`, `stripe/checkout/route.js:77`,
`stripe/proposal-checkout/route.js:15`). `src/lib/server/rate-limit.js` itself is a clean,
well-commented 12-line module — but nothing wraps "build a namespaced key and hash it," so every
caller reimplements that half of the pattern by hand.

**Impact**: minor — the risk here is transcription errors in the namespace prefix (e.g.
`cancel:${ip}:${token}` vs. a typo'd `cancle:`) silently creating a key collision or a
non-collision, neither of which would be caught by a type system since the whole thing is
string concatenation.

**Recommendation**: add a `hashKey(...parts)` helper next to `rateLimited()` in
`src/lib/server/rate-limit.js` (e.g. `hashKey("cancel", ip, token)` →
`createHash("sha256").update(parts.join(":")).digest("hex")`), and use it at all 13 sites.

**Priority**: Low. **Effort**: Small.

### Finding 3 — Magic timeout and rate-limit-tier values with no named constants
**Evidence**: `AbortSignal.timeout(...)` is called with hardcoded milliseconds at 12 sites:
8000ms in booking routes and `google-calendar.js`/`zoom.js` (8 occurrences), 5000ms in
`turnstile.js:11`, 10000ms in `office/actions.js:376,730`. Separately, `rateLimited()` call sites
pass ad hoc inline tier objects — `{ windowMs: 10 * 60 * 1000, max: 30 }` in
`bookings/availability/route.js:24`, `{ windowMs: 10 * 60 * 1000, max: 5 }` in
`availability-access/route.js:11`, `{ windowMs: 60_000, max: 60 }` in `funnel-events/route.js:18`
— each written out fresh rather than referencing a named tier.

**Impact**: low — values aren't wrong, but there's no way to see at a glance which routes share a
rate-limit policy versus which were tuned independently, and changing "the standard external-API
timeout" means hunting down each literal.

**Recommendation**: not urgent enough to warrant a large abstraction. If touching this area anyway,
a `HTTP_TIMEOUT_MS = { default: 8000, fast: 5000, slow: 10000 }`-style constant and 2-3 named
rate-limit tiers in `rate-limit.js` would make the policy differences intentional-looking rather
than incidental.

**Priority**: Low. **Effort**: Small.

### Finding 4 — Office error-code dictionary covers a small fraction of the codes actually produced
**Evidence**: `src/lib/server/office-errors.js` maps 15 error codes to human-readable messages,
and is imported by only 2 files (`src/app/office/(private)/settings/page.js`,
`src/app/office/(private)/page.js`). `src/app/office/actions.js` — the file that generates almost
all office-domain errors — never imports it (confirmed: no `office-errors` reference in
`actions.js`). A scan of that file's `redirect(...?error=...)` calls turns up **over 70 distinct
error codes** (`attestation_failed`, `capacity_hold_required`, `crm_sync_pending`,
`experiment_prepare_failed`, `hold_release_failed`, `threshold_still_exceeded`, etc.), of which
only the `proposal_*` and `call_outcome_failed`/`settings_save_failed` codes (≈15) have a mapped
message.

**Impact**: for the ~55 unmapped codes, whatever page renders the `?error=` query param either
shows the raw slug (`transition_invalid`) to the operator or falls back to a generic message,
losing the specific diagnostic the action already determined. This is also a discoverability
problem the prompt specifically asks about: "where a business rule belongs" is unclear when an
error's user-facing text and its originating condition live in two files that don't reference each
other, and the mapping file's existence gives a false impression of completeness.

**Recommendation**: either extend `OFFICE_ERROR_MESSAGES` to cover the full set of codes
`actions.js` actually emits (mechanical but valuable — grep the codes, write copy for each), or
decide explicitly that only proposal/settings flows warrant friendly messages and document that
scope in a comment at the top of `office-errors.js` so the gap is a decision, not an oversight.

**Priority**: Medium (single-operator tool, so user-impact is contained, but it directly degrades
the person using this dashboard's ability to self-diagnose failures). **Effort**: Medium.

### Finding 5 — Orphaned root-level scripts and a 1MB unreferenced bundle
**Evidence**: confirmed via grep that none of `extract_activities.js`, `extract_activities_detailed.js`,
`combine_games.js`, `process_games.js`, `fetch_bundle.js`, `fetch_original.js`, `find_bundles.js`,
`parse_html.js`, `refine_emcee.js`, `refine_logo.js` are referenced by `package.json` scripts or
imported anywhere in `src`. Their JSON outputs (`all_game_types.json`, `categorized_games.json`,
`combined_games.json`, `original_activities*.json`) are similarly unreferenced. `bundle.js` (1.03MB)
at the repo root is also unreferenced and not `.gitignore`d, so it's committed dead weight.

**Impact**: low functional risk (nothing depends on them), but they clutter the repo root — a
developer's first `ls` — with what looks like active tooling. This is the same observation
[Phase 0](phase-0-architecture-map.md) flagged from a discoverability angle; confirmed here as
genuinely unused rather than just apparently so.

**Recommendation**: delete them (git history preserves them if ever needed), or if they document a
one-time data-migration process worth keeping for reference, move them under a clearly-labeled
`scripts/archive/` with a one-line note on what they were for — but not left loose at the root
looking like live code.

**Priority**: Low. **Effort**: Small.

## Explicitly not findings (preserve as-is)

- **Large SEO/marketing page files** (`team-experiences/page.js` 800 lines,
  `virtual-family-game-night/page.js` 775 lines, `components/Pricing.js` 675 lines): sampled and
  confirmed low logic density (6-13 conditionals/`.map()` calls in 700-800 lines) — these are long
  because the marketing content is long, not because of accidental complexity. Splitting them
  further would fragment content that's edited as a unit, not reduce real complexity. This is
  legitimate domain size, not a hotspot — Phase 4's complexity analysis should not flag these on
  line-count alone.
- **In-memory rate limiter** (`src/lib/server/rate-limit.js`): a plain module-level `Map`, which
  means limits are per-process and reset on deploy — but the file says so directly in a comment
  and calls it an accepted tradeoff "for this scale." That's the correct amount of abstraction for
  the current traffic level; do not "fix" this into a distributed store without a concrete reason
  to (Phase 4 should still confirm the multi-instance implication is actually harmless, but the
  code itself isn't a maintainability problem).
- **`devdocs/architecture/`**: a pre-existing, well-organized 21-document architecture reference
  already covers the marketing site, lead funnel, backend services, and booking system in detail.
  Phase 6 should point readers there for narrative context rather than duplicating it, and any
  recommendation from this review that touches a documented area should be cross-checked against
  it first.

## Summary for Phase 6

- **Fix soon**: Finding 4 (office error-code coverage) — directly affects the usability of the
  tool the business runs on daily.
- **Cheap, low-risk cleanup**: Findings 1, 2, 3, 5 are all Small-effort and independent of each
  other — good candidates for a single "hygiene" PR.
- **Don't touch**: the three items under "Explicitly not findings" — flagging them here so later
  phases and the final report don't recommend changing things that are already appropriately sized
  or already documented.
