# Phase 4 — Code Complexity & Async/Webhook Reliability

Part of the [Code Review Plan](../CODE_REVIEW_PLAN.md), covering CODE_REVIEW_PROMPT.md §8 (Code
Complexity) and §9 (Real-Time Application Concerns), reframed per
[Phase 0's scope note](phase-0-architecture-map.md#5-correction-to-the-plans-real-time-framing):
this repo has no persistent-connection/stateful-server layer to review, so §9 is assessed here as
webhook idempotency, Edge Function concurrency/retry behavior, and booking-availability race
conditions instead. No code was modified.

## Complexity hotspots

Measured via a branch-density proxy (count of `if(`, `else`, `for(`, `while(`, `switch(`, `catch(`,
`&&`, `||`, `?.` per line of code) across the largest/most logic-heavy files, cross-checked against
file size — a rough but concrete stand-in for cyclomatic complexity given no complexity linter is
configured (see [Phase 5](phase-5-static-analysis.md)).

| File | LOC | Branch tokens | Ratio | Verdict |
|---|---|---|---|---|
| `src/app/office/actions.js` | 814 | 379 | **0.46** | Accidental complexity — see below |
| `src/app/api/bookings/availability/route.js` | 83 | 40 | 0.48 | Legitimate — see below |
| `src/app/api/stripe/webhook/route.js` | 251 | 85 | 0.33 | Legitimate (idempotency/reconciliation branching, already assessed in [Phase 1 Finding 5](phase-1-architecture-layers.md)) |
| `supabase/functions/ingest-gmail-replies/index.ts` | 416 | 107 | 0.25 | Legitimate and well-managed — see below |
| `src/app/api/bookings/confirm/route.js` | 280 | 51 | 0.18 | Legitimate — see below |
| `src/app/api/bookings/reschedule/route.js` | 296 | 49 | 0.16 | Legitimate, same shape as confirm |

### `office/actions.js` — the one real hotspot
Highest branch density of any file measured, combined with the largest size in the repo. This is
the same file flagged in [Phase 1 Finding 6](phase-1-architecture-layers.md) for layering reasons;
this measurement confirms it quantitatively. The complexity here is a mix of legitimate (the office
tool genuinely manages ~15 distinct workflows, each with real validation and state-transition
logic) and accidental (all 15 are flattened into one file/one scope with no per-workflow
extraction, so the branching from unrelated workflows is intermixed rather than isolated). The
fix is the decomposition already recommended in Phase 1 — this phase adds the quantitative case for
prioritizing it.

### `bookings/availability/route.js` — legitimate complexity, correctly contained
0.48 is the highest ratio measured, but the file is only 83 lines, and the branching is inherent to
the problem: available slots have to satisfy business hours, existing holds/confirmed bookings,
external Google Calendar busy-ranges, per-slot buffers, minimum notice, and booking horizon
simultaneously (`:36-77`, nested nested loop generating and filtering candidate slots at
`:67-77`). This is a scheduling algorithm; the density is explained by real domain rules, not
disorganization, and it's appropriately isolated to one small file rather than spread around. Not a
refactor priority. Minor note: this specific slot-generation loop has no dedicated test (it wasn't
in [Phase 3](phase-3-testing.md)'s priority list) — worth adding if this file is touched again, but
not urgent enough to add to that list retroactively.

### `bookings/confirm.js` / `reschedule.js` — legitimate complexity (manual saga orchestration)
Moderate branch density; the real complexity driver is that these routes hand-implement a
distributed-transaction/compensation pattern across three systems that can't share one atomic
transaction — a Postgres slot hold, a Zoom API call, and a Google Calendar API call, each of which
can fail independently and needs the prior steps unwound. That's inherent to integrating three
external systems without a workflow engine, not accidental complexity. See Async Reliability
Finding 1 below for a real gap inside this pattern.

### `ingest-gmail-replies/index.ts` — largest Edge Function, but a positive counterexample
416 lines, the largest single file among the Edge Functions, but decomposed into 9+ small,
single-purpose named functions (`decodeBase64Url`, `stripHtml`, `messageBody` — recursive MIME
part traversal, `headerMap`, `emailAddress`, `classifyHardStop`, `classifyFuzzyRegex`,
`classifyWithLLM`, `classifyReply` — a three-tier hard-stop-regex → fuzzy-regex → LLM-fallback
classification pipeline for inbound reply intent). The underlying problem (parsing arbitrary email
MIME structures and reliably classifying unsubscribe/complaint/OOO replies) is genuinely complex;
the code manages that complexity well. Worth citing in the final report as the model for how
`office/actions.js` should look after decomposition — same "is there a lot going on here" starting
point, opposite answer on whether it's manageable.

## Async / webhook / automation reliability

### What's working well

**A. Booking confirmation implements a real compensating-transaction (saga) pattern.**
`src/app/api/bookings/confirm/route.js:154-165` calls an atomic `hold_booking_slot` RPC *before*
any external call, so the slot-reservation race is resolved inside a single Postgres transaction
rather than a JS check-then-act race — this is the correct answer to the exact concern the
[Phase 0 scope note](phase-0-architecture-map.md#5-correction-to-the-plans-real-time-framing)
raised about booking availability. If the subsequent Zoom call fails (`:214-222`), the hold is
released via `fail_booking_hold` and an urgent `tasks` row is created so a human follows up. If the
Calendar call fails after Zoom already succeeded (`:239-248`), the Zoom meeting is cancelled *and*
the hold released *and* a task created. If the final status-flip write fails (`:261-266`), both
Zoom and Calendar are unwound. This is disciplined, deliberate saga design for an environment
without distributed transactions — worth preserving and highlighting, not refactoring.

**B. `process-apollo-enrichment` correctly guards against concurrent Edge Function invocations.**
`supabase/functions/process-apollo-enrichment/index.ts:61` claims queue items with
`.update({ status: "processing", ... }).eq("id", item.id).eq("status", "pending")` *before* calling
the external Apollo API — a proper claim-then-process pattern that prevents two overlapping
invocations from double-processing (and double-billing) the same items. On failure, the `catch`
block (`:122-124`) resets claimed items back to `pending` with a `next_attempt_at` one-hour backoff
and records the error, and a `source_runs` row provides an audit trail for every invocation
(`:26-29`). This directly and correctly answers the prompt's "assumptions that work on a single
server but may fail when multiple instances are running" question — see Finding 3 for one edge case
in this otherwise-solid mechanism.

**C. `send-approved-outreach` has per-item error isolation and layered kill switches.**
`supabase/functions/send-approved-outreach/index.ts:38-40` gates the entire run behind
`master_enabled`, `outbound_mode`, `outbound_auto_paused`, and a sending-window check
(`withinSendingWindow()`, `:18-20`) before touching anything, and its per-draft loop (`:56` on)
skips and logs a bad item (`:58-63`) rather than aborting the whole batch. This is defensively
designed for exactly the failure mode that matters most here — a bug or bad record shouldn't be
able to either send nothing or spam everyone.

**D. Stripe/Resend webhook idempotency** was already assessed in
[Phase 1 Finding 5](phase-1-architecture-layers.md) — not repeated here, but it belongs in the same
"working well" bucket as A-C above.

### Findings (gaps)

#### Finding 1 — Compensation-rollback failures are silently swallowed in booking confirmation
**Evidence**: in the saga described above, when a *primary* step fails (Zoom or Calendar creation),
the route creates an urgent `tasks` row and logs the error (`confirm/route.js:216-220`,
`:242-246`). But when a *rollback/cleanup* call fails — `cancelZoomMeeting(zoomMeetingId).catch(()
=> {})` (`:240`, `:262`) and `deleteCalendarEvent(calendarId, googleEventId).catch(() => {})`
(`:263`) — the error is caught and discarded with no logging and no task creation.

**Impact**: this is the worse failure mode of the two, handled worse. If a Calendar-creation
failure triggers a Zoom-cancel rollback and that cancel itself fails (expired token, transient
network error), the result is an orphaned, still-active Zoom meeting with literally no record
anywhere — no log line, no task — that it needs manual cleanup. The primary-failure path already
proves the team knows how to surface this kind of problem (the `tasks` insert pattern); it just
isn't applied to the rollback path.

**Recommendation**: on catch of the compensating call, at minimum `console.error` with enough
context to find it, and ideally insert the same kind of urgent `tasks` row already used for primary
failures a few lines above each site.

**Priority**: Medium. **Effort**: Small — the pattern to copy already exists in the same file.

#### Finding 2 — Webhook shared-secret comparison is not constant-time
**Evidence**: `supabase/functions/_shared/runtime.ts:15` authorizes every Edge Function webhook
call with `request.headers.get("x-webhook-secret") !== expected`, a plain JavaScript string
comparison, which short-circuits on the first differing byte.

**Impact**: low in practice — these are internal, cron-triggered endpoints, not public
authentication surfaces, and the secret space is large — but it's a textbook timing side-channel
and a one-line fix.

**Recommendation**: use a constant-time comparison (Deno's `std/crypto`'s `timingSafeEqual` or an
equivalent manual byte-by-byte constant-time compare) in `authorizeWebhook`.

**Priority**: Low. **Effort**: Small.

#### Finding 3 — Apollo enrichment's failure-recovery reset isn't scoped to the failing run
**Evidence**: `process-apollo-enrichment/index.ts:124` resets *every* `enrichment_requests` row
with `provider = "apollo"` and `status = "processing"` back to `pending` when the current
invocation's `try` block throws — scoped only by provider, not by which run claimed which rows
(the function already has `run.id` available from the `source_runs` insert at `:26-29`).

**Impact**: very low given the current single-scheduled-trigger assumption, but if two invocations
ever do overlap (manual re-trigger during a scheduled run, a retried cron dispatch), one run's
failure would reset items a different, still-succeeding run is actively processing — not data
corruption, just a wasted duplicate Apollo API call for those items later.

**Recommendation**: tag claimed rows with the current `run.id` when marking them `processing`, and
scope the failure-reset `update` to that same run id, so one run's failure can't touch another
run's in-flight claims.

**Priority**: Low. **Effort**: Small — opportunistic, not urgent.

## Summary for Phase 6

- **The standout finding of this phase is positive**: the booking-hold saga (A) and the Apollo
  claim-before-process guard (B) are exactly the right patterns for the concurrency and
  partial-failure risks this kind of system actually faces, and should be named explicitly in the
  final report's "what's working well" section, not just implied by the absence of findings against
  them.
- **`office/actions.js`** is confirmed, quantitatively, as the one real complexity hotspot in the
  repo — reinforces Phase 1 Finding 6 rather than adding a new recommendation.
- **Three small, mechanical fixes**: silently swallowed rollback errors in booking confirmation
  (Finding 1, Medium), a non-constant-time secret comparison (Finding 2, Low), and a
  non-run-scoped retry reset in Apollo enrichment (Finding 3, Low) — all Small effort, all safe to
  batch into one pass.
- No findings related to horizontal scaling of a stateful server, because — per Phase 0 — there
  isn't one in this repo; the closest analogue (Edge Function concurrency) was assessed above and
  found to be handled correctly apart from Finding 3.
