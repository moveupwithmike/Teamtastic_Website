# 10 — Marketing Site, Game Catalog & Lead Funnel

> Re-verifies and extends [02-Game-Catalog.md](02-Game-Catalog.md) / [03-Lead-Funnel.md](03-Lead-Funnel.md) against current code. Reminder: no game actually *runs* in this repo — every "play" surface here is either static catalog copy or a lead-gen mini-quiz that hands off to the separate `teamtastic.games` engine via a URL.

## The game catalog (`src/lib/gamesData.json`)

53 entries, single source of truth for `GamesCatalog.js` (the `/games` and `/activities` grid) and `/games/[slug]` detail pages.

| Category | Count |
|---|---|
| creative | 14 |
| chill | 14 |
| competitive | 10 |
| collaborative | 10 |
| high-energy | 5 |

- **8 "original" entries** (`isOriginal: true`) vs. **45 "imported" entries** (`isOriginal: false`, scraped/converted from the `teamtastic.games` engine via the root-level one-off `extract_*`/`combine_games` scripts, per prior doc). The imported 45 share identical boilerplate — players `4–250+`, time `15–45 min`, and `howToPlay` steps whose `desc` just repeats the `title` — so the catalog reads as thin/auto-generated for 85% of its entries. This is a content-depth gap, not a code defect.
- Each entry: `slug`, `title`, `tagline`, `category`, `badge`, `players`, `time`, `skill`, `vibe`, `howToPlay`. `GamesCatalog.js` filters client-side on `category` + a naive substring search over `title`/`tagline`/`vibe` (`GamesCatalog.js:56-61`) — fine at 53 rows, would need a real search index past a few hundred.
- The catalog page also renders a "Spotlight" random-pick drawer (`pickRandomGame`, `GamesCatalog.js:64-68`) — pure client-side `Math.random()`, no tracking event fired on this interaction (every other CTA on the page fires `track()`; this one doesn't).

## The four lead-capture "game flows"

These are the closest thing to a "game" this repo runs — each is a short interactive quiz/demo that terminates in a lead-capture form and a fork of CTAs. All four converge on the same `captureLead()` → `POST /api/leads` path (see [Lead intake](#lead-intake--apileads) below).

### Flow 1 — Event Quiz (`GameQuiz.js`, homepage `#quiz` anchor)

```
Step 0: team size  →  Step 1: vibe  →  Step 2: occasion  →  Step 3: name/email/company + Turnstile
                                                                        │
                                                                        ▼
                                                        captureLead() → /api/leads
                                                                        │
                                                    ┌───────────────────┼───────────────────────┐
                                                    ▼                   ▼                        ▼
                                        Reserve Your Event         Book a 15-Min Call      Launch a Free Game
                                        ($200 deposit link,        (→ /book, native         (→ teamtastic.games
                                         flat, not price-aware)     booking scheduler)        with query params)
```

- Hydrates from a `sessionStorage` handoff (`teamtastic_estimator`) written by `Pricing.js`'s calculator, so a visitor who used the price slider first sees "Your estimate is attached: 25 players, Core event, approximately $1,250" (`GameQuiz.js:178-183`) before answering anything.
- **The estimate is cosmetic.** The estimator's `estimatedTotal`/`players`/`packageType` are sent to PostHog as `estimator_*` metadata (`GameQuiz.js:140-146`) and displayed back to the user, but the actual "Reserve Your Event" button always links to the flat `PAYMENT_CONFIG.depositUrl` — a fixed $200 regardless of what was just computed (`GameQuiz.js:413-421`). A team that priced out $3,000+ sees the same $200 link as a team that priced out $350. This is the same root gap documented for the office proposal flow in [12](12-Private-Sales-Office.md) and confirmed repo-wide in [16](16-Payments-and-Stripe.md) — it isn't office-specific.
- Recommendation engine (`src/lib/recommendations.js`) is a static 4-entry lookup keyed by `vibe` (`competitive`/`social`/`collaborative`/`icebreaker`) — not a real scoring function, just `recommendations[vibe] || recommendations.competitive`. Every slug in it is hand-verified against `gamesData.json` per the file's own header comment; I spot-checked several and they do resolve.
- Free-tier CTA links to `https://teamtastic.games?vibe=&size=&occasion=&recommendation=&submission_id=` (`GameQuiz.js:438`) — this is an **implicit, unvalidated URL contract** with the separate game-engine product. Nothing in this repo confirms the other side actually reads or honors these params; if `teamtastic.games` ever changes its query-param names, this handoff silently breaks with no error surfaced here.
- Failure handling resets the (single-use) Turnstile token and re-renders the widget (`GameQuiz.js:155-156`) — correctly handled.

### Flow 2 — Solo Demo (`SoloDemo.js`, homepage, "playable teaser")

```
Start → 3 trivia questions (hardcoded, client-only) → Score screen → Lead form + Turnstile → captureLead()
                                                                                                  │
                                                                            "lead_captured" state ▼
                                                                    Launch Free Lobby (teamtastic.games, bare)
                                                                    Get Hosted Quote (→ /#quiz)
```

- The 3 questions are hardcoded in the component (`SoloDemo.js:12-46`) — company-culture trivia about Teamtastic itself, not an actual sample of catalog gameplay. There's no connection between "demo score" and the eventual recommendation; `demoScore`/`demoQuestionCount` are only passed as opaque `context` on the lead record (`SoloDemo.js:119`), never used to drive a recommendation the way the Event Quiz does.
- **Unbacked promise, still present:** the success screen and its toast both say "We sent a confirmation to `{email}`... Launch a free lobby below whenever your team is ready" (`SoloDemo.js:326-328`) and "Your free-game link is ready" (`SoloDemo.js:123`), implying credentials/a specific lobby were provisioned. In reality the only email actually sent is `notify-new-lead`'s generic customer-confirmation copy for `lead_source = 'playable_demo'` (per [14](14-Lifecycle-Emails-and-Deliverability.md)) — a generic "Michael's team will follow up," not a starter-lobby link or login credentials. The "Launch Free Lobby" button underneath just links to bare `https://teamtastic.games` (`SoloDemo.js:335`), with no `submission_id`/context carried over at all (unlike the Event Quiz's free-tier link, which at least passes `submission_id`). This was flagged in the 2026-07-03 pass ([03-Lead-Funnel.md](03-Lead-Funnel.md)) as the single biggest broken promise in the funnel and is still true today — it needs either a real starter-lobby email (requires `teamtastic.games` cooperation) or softer copy.

### Flow 3 — Corporate/Family Concierge (`CorporateLeadForm.js`, embedded on landing pages)

```
Inline form (name/email/company/teamSize/occasion/vibe) + Turnstile → captureLead()
                                                                              │
                                                        success state ───────┼───────────────
                                                                              ▼               ▼
                                                          Reserve with $100/$200 deposit   Book a 15-min call
```

- One component serves both audiences via props (`isFamily` flips `source`, copy, and which flat deposit link — `familyDepositUrl` $100 vs. `depositUrl` $200 — is used, `CorporateLeadForm.js:19-31,47`). Same flat-deposit-regardless-of-quote pattern as Flow 1: the subtitle states a per-person rate and minimum ("$35 per person · $350 minimum · $200 reserves your date") but the actual link is always the same fixed amount — no per-team-size link generation.
- `depositUrl` is built by appending `prefilled_email`/`client_reference_id` query params to the static Payment Link (`CorporateLeadForm.js:47-51`) — this is the one piece of dynamism Stripe Payment Links support here (prefill + a reference id for later matching in the webhook), and it's used consistently across all three CTA surfaces (Quiz, Concierge form, presumably `TalkToMichaelModal.js`).

### Flow 4 — Talk-to-Michael Concierge Modal (`TalkToMichaelModal.js`)

Not read line-by-line in this pass (confirmed only via cross-reference in the payments research: `TalkToMichaelModal.js:76,121-123,482`), but it follows the identical `captureLead()` → flat-deposit-link pattern as Flows 1 and 3, using `getCorporateConciergeRecs()`/`getFamilyConciergeRecs()` (`src/lib/recommendations.js:51-107`) for its 2-3 suggested games instead of the vibe-keyed lookup. Those two functions do simple substring matching on free-text preference/vibe strings (`p.includes("trivia")`, etc.) with a shared default fallback — same "static lookup, not real scoring" pattern as Flow 1. Worth a follow-up read if a future pass needs full confidence on this component specifically.

## Lead intake (`/api/leads`)

Shared endpoint for all four flows above. Validates `source` against a fixed enum, `submissionId` as a UUID, truncates/sanitizes every string field, and has its **own locally-defined** rate-limit (`sha256(ip:email)`, 5/10min) and Turnstile check — a byte-identical but structurally separate copy of `src/lib/server/rate-limit.js`/`turnstile.js` (used by the three booking routes). No behavioral drift today, but a maintenance foot-gun: a future tuning change to the shared lib (e.g. tightening the booking rate limit) won't apply here, and the two live in separate in-memory bucket stores. Dedup is by `submission_id` only (client-generated), with a `23505`-catch fallback for the pre-check/insert race — so the same person submitting twice with a fresh `submissionId` produces two `leads` rows by design (reconciled later at the `prospects` layer by email, not here). See [18](18-Security-Auth-and-Rate-Limiting.md) for the full security picture and [14](14-Lifecycle-Emails-and-Deliverability.md) for what happens after insert.

## Gaps specific to this layer (ranked)

1. **Cosmetic price estimates across all three interactive flows** (Quiz, Concierge form, presumably the modal) — a computed/quoted price is shown to the user and logged to analytics but never affects the actual Stripe amount charged. Same root cause as the office-proposal gap in [12](12-Private-Sales-Office.md); see [16](16-Payments-and-Stripe.md) for the full scope.
2. **SoloDemo's "confirmation email"/"free-game link is ready" copy overpromises** relative to what `notify-new-lead` actually sends (a generic confirmation, no credentials, no lobby-specific link) — the same gap flagged in the prior pass, still open.
3. **The `teamtastic.games` query-param handoff is an unvalidated, implicit contract** (`?vibe=&size=&occasion=&recommendation=&submission_id=` for the Quiz; bare URL with no params at all for SoloDemo) — nothing here would catch a silent break if the other side's expected param names ever change, and the two flows aren't even consistent with each other about what context to pass.
4. **Catalog content depth**: 45 of 53 games (85%) share boilerplate players/time ranges and a `howToPlay` whose `desc` just repeats the title — thin content for SEO/detail pages, not a functional bug.
5. **Random "Spotlight" pick on the catalog page fires no analytics event**, unlike every other CTA on the same page (minor instrumentation gap).
