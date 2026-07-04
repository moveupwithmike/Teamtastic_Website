# 07 — Gaps & Unfinished Wiring (Consolidated)

Cross-referenced from docs 01–06. Ordered by severity within each section.

## A. Functionality gaps

| # | Gap | Where | Detail |
|---|---|---|---|
| A1 | **Playable-demo promise has no backing email** — "login credentials sent instantly" is never sent | SoloDemo → notify-new-lead | Doc 03 flow 2 / doc 04 gap 3. Fix: per-`lead_source` email templates in the Edge Function, or soften the copy until teamtastic.games can issue starter credentials. |
| A2 | **Deposit ↔ lead matching effectively email-only**; Calendly can't inject `submission_id` into the Stripe session | Stripe webhook | Doc 04 gap 1 / doc 06. Mitigate via Calendly webhook reconciliation or accept + monitor `matched=false`. |
| A3 | **Subscriptions recorded as deposits** — $99/mo checkout fires `deposit_completed` + "Deposit received" alert | Stripe webhook | Doc 04 gap 2. Branch on `session.mode`. |
| A4 | **Silent notification loss is undetectable** — failed `pg_net` call leaves no `notification_deliveries` row; no automatic retry | DB trigger → Edge Function | Doc 04 gaps 1–2. Add "leads with zero deliveries" query + pg_cron retry. |
| A5 | **Lead vocabulary is fragmented** — modal stores display strings, quiz stores enums, demo fabricates `team-building` occasion | leads table | Doc 03. Normalize at `/api/leads` boundary. |
| A6 | **Recommendation engines ×2 recommending mostly nonexistent games** (6 of 8 quiz titles, most concierge titles absent from the 51-game catalog) | recommendations.js + TalkToMichaelModal | Doc 02 gaps 4–5. Consolidate; key to real `gamesData` slugs so recs can link to `/games/[slug]`. |
| A7 | **Pricing contradictions** — $35/pp banner vs $40/pp+$400-min estimator; $99/mo Pro sold in quiz but absent from pricing page | Pricing, CtaBanner, GameQuiz | Doc 06. |
| A8 | **No consent banner** — consent flag is honored but nothing sets it; `granted` persistence branch unreachable | analytics.js / instrumentation-client.js | Doc 05 gap 6. |
| A9 | Concierge modal shows previous lead's success screen if reopened after submit | TalkToMichaelModal | Doc 03. Reset on close from step 6. |
| A10 | `customContentLink` product has no UI; `calendlyEmbedCode` dead export | stripe.js | Doc 06 gaps 3–4. |
| A11 | Pricing estimator total never enters the lead payload | Pricing → GameQuiz | Doc 06 gap 5; `context` JSONB is the natural carrier. |

## B. SEO gaps

| # | Gap | Fix sketch |
|---|---|---|
| B1 | Sitemap lists two 404s (`/games/meme-battle`, `/games/sound-bite-trivia`) and omits `/games`, `/activities`, `/team-experiences`, `/virtual-family-game-night`, and 47 of 51 game pages | Generate game entries from `gamesData.json` in [sitemap.js](../../src/app/sitemap.js) |
| B2 | No `generateMetadata` on `/games/[slug]` — 51 pages share root title | Doc 01 #3 |
| B3 | Catalog page title set via `useEffect`; whole page is a client component | Server wrapper + metadata export |
| B4 | `/activities` duplicates `/games` with no canonical; imports another route's page module | Redirect or extract shared component |
| B5 | 45 imported games have near-duplicate placeholder copy (identical players/time, howToPlay desc = title) | Content pass on gamesData.json; render `includes`/`faqs`/`testimonials` (currently dead fields) to fatten pages |

## C. Analytics gaps (doc 05)

| # | Gap |
|---|---|
| C1 | `lead_captured` double-fired (client + server) under different distinct IDs — counts ~2× |
| C2 | No identity stitching: server events (incl. `deposit_completed`) unjoinable to client journeys; no `identify`/`alias` anywhere |
| C3 | `quiz_started` re-fires on step-0 re-selection (funnel entry inflated) |
| C4 | Untracked: quiz $99/mo CTA, game-detail launch CTA, demo results view, pricing estimator interactions, banner "Book Your Event" clicks |
| C5 | Property naming split camelCase/snake_case across events |
| C6 | `capture_exceptions` on but no source-map upload (no CI) — minified prod stack traces |

## D. Coding standards

| # | Issue |
|---|---|
| D1 | **No tests at all**; `/api/leads` (validation/idempotency/rate-limit) is the highest-value first target |
| D2 | **No CI** — no lint/build gate, no source-map upload step |
| D3 | **ESLint fails (~70 pre-existing errors)** while builds pass — lint is unenforced theater; fix or re-rule |
| D4 | All JS, no TypeScript — acceptable choice, but the lead payload / gamesData shapes now cross 4+ module boundaries untyped; JSDoc typedefs or a zod schema at `/api/leads` would catch the A5/A6 class of drift |
| D5 | Root-level scraping artifacts (`bundle.js` ~1 MB, `fetch_*/extract_*/combine_*` scripts, JSON dumps, `original_activities.html`) committed to repo root; `jimp` in prod deps for them |
| D6 | Fragile step-gating via `Object.keys(formData)[step]` in GameQuiz (doc 03) |
| D7 | Dead code: `PostHogProvider` no-op (still rendered in layout), `calendlyEmbedCode`, unused gamesData fields |
| D8 | `package.json` name `temp_next_app`; README is the untouched create-next-app boilerplate |
| D9 | Mixed UI copy tone/values duplicated in components rather than shared config (pricing numbers, option lists) |
| D10 | In-memory rate limiter Map grows unbounded per instance (doc 03) |

## E. Per-game-flow issues (quick index)

- **Event Quiz:** C3 over-firing; D6 gating hack; untracked $99 CTA (C4); Calendly `a1` smuggling won't reach Stripe (A2); server recommendation falls back silently to `competitive`.
- **Playable Demo:** A1 broken credentials promise; A5 fabricated segment values; missing results-view event (C4).
- **Concierge (corporate + family):** A5 vocabulary drift; A6 duplicate/fictional recommendations; A9 stale-state on reopen.
- **Catalog / detail pages:** B1–B5; untracked launch CTA (C4); dead JSON fields; `launch=<slug>` contract with teamtastic.games is undocumented and untested (doc 02).

## F. Unfinished wiring checklist (launch-blocking state as of 2026-07-03)

Deployment order and manual steps live in [LEAD_FUNNEL_OPERATIONS.md](../../LEAD_FUNNEL_OPERATIONS.md). Status observed from this repo:

| Item | Status |
|---|---|
| Supabase migration applied to linked project | ❓ not verifiable from repo — verify `submission_id` column + triggers exist before deploy |
| Vault secrets (`lead_notification_function_url`, `..._webhook_secret`) | ❓ manual step |
| `notify-new-lead` deployed (JWT off) + Edge secrets set | ❓ manual step |
| Resend domain verified + `RESEND_FROM_EMAIL` production sender | ❓ manual step |
| Local `.env.local`: Turnstile ✅, service-role ✅, Resend ✅, internal email ✅ | partially wired |
| `NEXT_PUBLIC_POSTHOG_KEY` / `_HOST` | ❌ absent from local env — client analytics + server events silently no-op until set (verify Vercel env too) |
| `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` | ❌ absent locally — webhook route returns 503 |
| Stripe webhook endpoint registered for `checkout.session.completed` | ❓ manual step |
| `NEXT_PUBLIC_CALENDLY_URL`, `NEXT_PUBLIC_STRIPE_PRO_LINK`, `NEXT_PUBLIC_STRIPE_CUSTOM_BUILD_LINK` | ❌ absent — **in production all three CTAs render dead `#...-configuration-required` anchors** |
| Calendly/Stripe native customer confirmations enabled | ❓ dashboard step |
| Consent banner component | ❌ not built (A8) |
| Starter-lobby email for playable demo | ❌ not built (A1) |
| CI (lint gate + PostHog source-map upload) | ❌ not built (C6/D2) |
| End-to-end verification pass (submit all 4 sources, idempotency replay, test-mode checkout) | ❓ pending — scripted in LEAD_FUNNEL_OPERATIONS.md |
