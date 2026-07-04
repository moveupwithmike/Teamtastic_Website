# 03 — Lead Funnel (Interactive Flows & `/api/leads`)

Four interactive experiences feed one intake endpoint. Each sends a distinct `source` (allow-listed server-side):

| Source | Component | Where it appears |
|---|---|---|
| `event_quiz` | [GameQuiz.js](../../src/components/GameQuiz.js) | Home `#quiz` (linked from Pricing, Hero, banners) |
| `playable_demo` | [SoloDemo.js](../../src/components/SoloDemo.js) | Home |
| `michael_event_concierge` | [TalkToMichaelModal.js](../../src/components/TalkToMichaelModal.js) | CTA banners on team-experiences (+ FAQ chat button) |
| `michael_family_concierge` | same modal, `isFamily` | virtual-family-game-night |

Shared client plumbing: [lead-client.js](../../src/lib/lead-client.js) (`createSubmissionId()` UUID for idempotency; `getAttribution()` grabs landing page, referrer, UTM params; `captureLead()` POSTs and normalizes errors with `code`/`retryable`) and [TurnstileWidget.js](../../src/components/TurnstileWidget.js) (lazy-loads Cloudflare script, dark theme, expiry/error states, dev-mode `development-bypass` token when no site key).

## Flow 1 — Event Quiz (`event_quiz`)

```
Step 0 teamSize → Step 1 vibe → Step 2 occasion → Step 3 name/email/company + Turnstile
  → POST /api/leads (server computes recommendation from vibe)
  → Result screen: package + 3 CTAs
       1º Reserve Your Event — $200 Deposit  → Calendly (deposit_cta_clicked)
       2º Unlock Pro Self-Service $99/mo     → Stripe link (NO tracking event)
       3º Launch a Free Game                 → teamtastic.games (free_game_clicked)
```

Selections auto-advance after 300 ms; Back/Next nav with progress dots; on submit failure the Turnstile token is cleared and the widget re-rendered via `resetKey`.

**Issues:**
- **`quiz_started` over-fires.** It's emitted inside `handleSelect` whenever `step === 0` (GameQuiz.js:61), so going Back to step 0 and re-selecting, or retaking the quiz, fires it again — inflating the funnel's entry count. Guard with a `hasStarted` ref. Same design in SoloDemo is correct (fires in `startQuiz`).
- **Step-gating hack.** Next-button disable uses `!formData[Object.keys(formData)[step]]` (GameQuiz.js:289) — it depends on the *insertion order of object keys* matching step order. Works today; breaks silently if anyone reorders/adds a field to `formData`. Map step → field explicitly.
- **Secondary CTA untracked.** The $99/mo link is the only result-screen CTA without a `track()` call, so quiz→SaaS conversion is invisible (doc 05 taxonomy).
- **Recommendation duplication drift already happened.** The quiz previously computed recommendations client-side; the API now computes them server-side from `vibe` via [recommendations.js](../../src/lib/recommendations.js). Good. But the fallback (`getRecommendation()` defaults to `competitive`) means a lead with a missing/typo'd vibe silently gets a competitive package rather than an error — acceptable, but worth knowing.

## Flow 2 — Playable Demo (`playable_demo`)

```
start → 3 trivia questions (instant right/wrong + explanation)
  → results (score) → lead form + Turnstile → lead_captured
  → success screen: "Starter Code Queued! Check your inbox for login credentials"
```

**Issues:**
- **The promised email doesn't exist.** The success screen (SoloDemo.js:325–328) and toast promise "login credentials to host your starter event" "sent instantly." The only customer email in the system is the generic `notify-new-lead` confirmation ("Michael's team will follow up") — **no credentials, no lobby link, nothing starter-specific**. This is the single biggest broken promise in the funnel; either wire a real starter-lobby email (needs cooperation from teamtastic.games) or soften the copy.
- **Hard-coded lead attributes pollute the dataset.** Every demo lead is stored as `teamSize: "15-50", vibe: "social", occasion: "team-building"` (SoloDemo.js:115–117). `team-building` isn't even in the quiz's occasion enum (`social-hour|holiday|onboarding|private-milestone`), so occasion-based segmentation now has a fifth, fabricated value. Prefer nulls over fabricated values; the real signal is in `context.demoScore`.
- **Results screen view is untracked** — the funnel jumps from third `demo_question_answered` to `lead_submit_attempted`, so "finished demo but bounced at the form" isn't measurable as a distinct step.

## Flow 3/4 — Concierge Modal (`michael_event_concierge` / `michael_family_concierge`)

```
Step 1 eventType → 2 groupSize → 3 vibe → 4 preferences
  → Step 5 contact form (name/email/company|family, date, phone) + Turnstile
  → Step 6 success + 3 recommended experiences (client-side string matching)
```

**Issues:**
- **Vibe/occasion vocabularies diverge from the quiz.** The modal stores display strings ("High-energy competition", "Family reunion", "5 – 20 players") where the quiz stores enums (`competitive`, `holiday`, `15-50`). The `leads` table columns `vibe`/`occasion`/`team_size` therefore contain two incompatible vocabularies, and any PostHog breakdown or SQL `group by vibe` fragments. Normalize at the API boundary or share one options module.
- **Second recommendation engine** duplicated in-component, including a family variant, recommending titles that mostly don't exist in the catalog (details in doc 02, gap #4/#5).
- **Stale state on close.** `X`/backdrop call `onClose` without reset; only the step-6 "Done" button resets. Reopening mid-flow resumes — arguably a feature — but reopening *after* step 6 shows the old success screen with the previous lead's data. `handleReset` should also run when closing from step 6.
- Submitted `context.recommendations` stores the recommendation titles — fine, but they're the fictional titles from the previous point.

## The intake endpoint — [/api/leads](../../src/app/api/leads/route.js)

Pipeline: size caps (25 KB body) → shape/format validation (UUID `submissionId`, allow-listed `source`, email regex ≤254) → rate limit (>5 submissions per `sha256(ip:email)` per 10 min) → Turnstile siteverify (5 s timeout; fail-closed in prod, `development-bypass` token accepted outside prod) → duplicate check on `submission_id` (returns `duplicate: true` success) → insert → fire-and-forget PostHog `lead_captured`.

Solid overall. Known limitations:

- **In-memory rate limiter is per-instance.** `buckets` is a module-level `Map`; on Vercel each lambda instance has its own, so the effective limit multiplies by instance count, and entries for distinct keys are never pruned (only per-key timestamps are filtered), so the Map grows unboundedly within an instance's lifetime. Acceptable at current traffic — Turnstile is the real gate — but don't mistake it for a real limiter; move to Upstash/Vercel KV if abuse appears.
- **Unawaited `captureServerEvent`** (route.js:131): if PostHog rejects (it awaits `flush()`), that's an unhandled rejection in a serverless context. Wrap in `.catch()` — it must never affect the lead response, which is presumably why it's un-awaited, but un-awaited ≠ error-safe.
- **`context` is stored unvalidated** (any object ≤25 KB total body). Bounded risk, but it's a JSONB column of arbitrary client input — keep it out of anything that renders HTML without escaping (the Edge Function currently escapes; keep it that way).
- `phone` is accepted from the modal only; quiz/demo never send it — fine, column is nullable.
