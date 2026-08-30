# Teamtastic — Final Website & Sales Engine Launch-Readiness Assessment

**Date:** 2026-08-29
**Scope:** Commercial side of the business only (marketing site, lead gen, CRM, sales engine, booking, payments, client management, analytics, SEO/AEO). The game platform (`teamtastic.games`) is out of scope — already assessed separately.
**Method:** Direct code inspection (routes, API handlers, Supabase migrations/schema, Edge Functions), live production site walkthrough (`teamtastic.events`), automated checks (`lint`/`typecheck`/`test`/`build`), and external research (6 competitor sites, 2026 AEO/GEO practices and tooling). Findings below are evidence-based — each is tied to a file:line citation or a live-site observation, not speculation.

---

## Executive Summary

Teamtastic's commercial engine is **more sophisticated than a typical small-company launch** — it has a real CRM data model (leads → prospects → companies → deals, cleanly separated), database-level concurrency safety on bookings, signature-verified and idempotent Stripe webhooks, a Claude-classified inbound-email intelligence pipeline, and an Apollo-based outbound system with a **hard, database-enforced human-approval gate** before any cold email sends. Build, lint, typecheck, and the full test suite (240/240) all pass cleanly.

Against that strength sit four bounded, fixable gaps that matter disproportionately because they touch the three things that actually sink small companies at launch: **legal exposure** (no real Privacy Policy/Terms, despite processing payments and PII, and despite the live FAQ promising a refund policy the backend cannot execute), **lost revenue** (no real-time alert beyond one email inbox for new leads or hot replies), and **deploy hygiene** (duplicate migration files that have now been removed, and an unverified production migration-ledger entry).

There is also a pattern worth naming directly: a meaningful share of the most recent engineering effort (15 of 87 migrations, the last 4 commits) went into a self-referential "prove we are launch-ready" certification system rather than closing the actual commercial gaps this report identifies. The system is real and not fake, but it is not a customer, a lead, or a dollar.

## Launch Verdict

**READY TO LAUNCH WITH MINOR CONDITIONS.**

The four P0 items below are each same-day fixes for a solo founder — write two legal pages and link them, wire one Slack/SMS webhook alongside the existing email notification, decide and document the actual refund process, and verify one migration against production. None require new infrastructure or vendor contracts. Launching without addressing them is a real but boundable risk, not a system that is fundamentally broken.

---

## Current Commercial Architecture

```
Visitor → Landing page (14 top-level pages + 54 game pages + 18 blog posts)
        → Lead capture (quiz / lead form / concierge modal) → /api/leads
        → leads table (raw submission, UTM-tagged) → prospects (deduped CRM identity)
        → notify-new-lead Edge Function → Resend email (internal + customer)
        → office/(private) dashboard (prospects, tasks, deals)
        → deals pipeline (12-stage enum, auto-advanced by booking + Stripe events)
        → /book (native scheduler, replaced Calendly) → Zoom + Calendar + confirmation email
        → Stripe Checkout (deposit/full) → webhook → payment_requests → deals.won → clients
        → Nurture (event_quiz source only, stops on verified payment)
        → Gmail reply ingestion → Claude Haiku intent classification → tasks
        → Apollo discovery/enrichment (outbound) → human-approved drafts only → send
```

This is a real, working machine, not a facade. The gaps are in the edges (alerting, refunds, coverage breadth), not the core.

---

## Website Engineering Assessment

**Build health (verified by running the actual commands):**

| Check | Result |
|---|---|
| `npm run lint` | PASS — zero warnings |
| `npm run typecheck` | PASS — zero errors |
| `npm test` (vitest) | PASS — 240/240 tests, 37/37 files |
| `npm run build` | PASS — 110 static pages, no bundle warnings |

**Findings:**

- **[P0]** No Privacy Policy or Terms of Service page exists anywhere in `src/app`. The footer renders "Privacy Policy" and "Terms of Service" as non-interactive `<span>` elements with `cursor-pointer` styling and no `href`/`onClick` ([Footer.js:225-230](src/components/Footer.js:225)) — they look clickable and do nothing. The site runs a cookie/ad-consent banner and collects name/email/phone/company PII plus processes live payments starting tomorrow with no legal page backing any of it, and no legal business entity name or address anywhere on the site (footer confirmed live: "© 2026 Teamtastic. All rights reserved." — no LLC/Inc, no address, no phone).
- **[P1]** `/games` (dedicated catalog, 0.9 sitemap priority, 54 game pages) is never linked from primary nav or footer — both point to the `/#games` homepage anchor instead ([Navbar.js:9-16](src/components/Navbar.js:9), [Footer.js:152-209](src/components/Footer.js:152)). One of the most SEO-important pages is functionally orphaned.
- **[P1]** `src/app/robots.js:1-9` allows all crawlers on `/` with no `disallow` — `/api/*`, all ~20 `/office/*` admin routes, and tokenized `/book/manage/[token]` URLs are all crawlable. Page-level `noindex` mitigates *search-index* exposure but not crawl-budget waste or token leakage via crawler logs/referrers.
- **[P1]** `src/app/blog/virtual-team-building-ideas/page.js` promises **"50 Virtual Team Building Ideas"** in its H1 and metadata but only lists 20, then substitutes a teaser box that pivots to an unrelated `teamtastic.games` CTA instead of finishing the promised content ([:8, :17-38, :97-107](src/app/blog/virtual-team-building-ideas/page.js:8)) — a verifiable content-quality/trust gap, and a bad signal for AI-answer engines that will notice the title doesn't match the content.
- **[P2]** Unsourced statistics on `virtual-team-building/page.js:148-151` ("76% of remote workers feel isolated," "$550B lost annually," "92% of HR leads say...") — no citations. Classic AI-copy tell; low legal risk, real credibility risk if a buyer or journalist asks for the source.
- **[P2]** In-memory rate limiting (`src/lib/server/rate-limit.js:16`) won't enforce globally across multiple serverless instances — acknowledged in the code's own comment. Fine at current traffic, worth revisiting post-launch.
- **[P2]** Dead component `src/components/PostHogProvider.js` (explicit no-op, imported nowhere — PostHog actually initializes via `src/instrumentation-client.js`); stale hardcoded `© 2024` on the alternate footer ([Footer.js:85](src/components/Footer.js:85)); `/games`/`/activities` missing JSON-LD despite high sitemap priority.
- **[P3]** Stray root-level artifacts (`html_structure.txt`, `original_activities.html`, `teamtastic_website_mockup.png`) — unreferenced by any source file, safe to delete for hygiene.

**AI content-quality spot check:** Homepage, pricing, and most blog content read as specifically written for this brand (real game names, real prices, distinct FAQ per page, consistent "Master Emcee" voice) — not templated AI filler. The one exception is the "50 ideas" post above.

**No client-side secret leakage found** — every `NEXT_PUBLIC_*` variable in use is legitimately public (Supabase anon key, PostHog key, Turnstile *site* key, ad-pixel IDs); zero overlap between server-secret env-var names and `"use client"` files.

---

## Landing Page & Conversion Assessment

Live homepage walkthrough confirms a genuinely premium-feeling first impression: an animated live "virtual event" hero mockup (spotlight host, live meme-battle voting, live chat), clear tagline ("Play. Connect. Celebrate."), pricing stated in the hero (`$35/person · $350 minimum · $200 deposit`), and a working **live pricing calculator** (verified interactively — 25 players × $35 = $875 correct; 5 players correctly floors to the $350 minimum, not a bug).

A first-time HR/People Ops visitor can answer all five orientation questions within ~5 seconds: what it is, who it's for (dedicated HR/Eng/Intern/Private-social persona cards), why it's different (live emcee, not just software), roughly what it costs (visible in the hero and a working calculator further down), and what to do next (Book an Event / Try a Free Game / take the quiz).

- **[P1]** Social proof is entirely anonymized role-based quotes ("HR Manager, Tech Startup," "People Ops Director, Fintech") — no named companies, no logos, no photos. This is a real credibility gap against Hooray Teams and TeamBuilding.com, which both lead with recognizable client logos (Microsoft, Google, Stanford, McKinsey).
- **[Good, verified]** The FAQ page is substantive and specific (device support, platform compatibility, custom branding, billing/PO support, refund terms) — not templated boilerplate.
- **[P0, see Payments section]** The FAQ's refund-policy answer is a promise the backend cannot currently keep.

---

## Competitor Comparison

| Company | Model | Pricing shown | Instant self-serve? | Notable AI feature |
|---|---|---|---|---|
| **Teamtastic** | Hybrid: free self-serve + live-hosted | Yes — hero price + interactive calculator | **Yes** — free lobby, no card, <60s | Backend only (Apollo enrichment, Claude reply classification) — invisible to buyer |
| Confetti | Self-serve marketplace | $20–85/pp (browse & book) | Yes | — |
| Hooray Teams | Curated catalog, sales-assisted | "$12/pp" teaser + per-event range | No — contact/callback within 24h | — |
| TeamBuilding.com | Managed, facilitator-run | ~$300/hr or $28–50/pp | No — quote-driven | — |
| BoomPop | Event-planning platform | Transparent tiers | Partial | **AI itinerary builder + AI text messenger** for attendee Q&A |
| The Go Game | 22-yr legacy, proprietary app | $400–$40k, sales-quote only | No | AI-branded trivia format |

**Classification by category:**

| Category | Teamtastic position |
|---|---|
| Instant/self-serve entry | **DIFFERENTIATED** — free, no-card, <60s free tier beats every reviewed competitor's quote-gated model |
| Pricing transparency | **ABOVE MARKET** — live calculator is rare in this category |
| Enterprise logos/named social proof | **BEHIND** — Hooray Teams and TeamBuilding.com both lead with Microsoft/Google/Stanford-tier logos |
| Visible AI features (buyer-facing) | **BEHIND** — BoomPop's AI concierge and Go Game's AI-trivia branding are marketed; Teamtastic's AI is entirely internal |
| AEO/GEO technical readiness | **ABOVE MARKET** — see next section |
| Sales-engine automation depth | **DIFFERENTIATED** — Apollo + LLM-classified inbound + guarded outbound is materially more sophisticated than what a company this size typically runs |
| Trust signals (legal pages, entity, address) | **BEHIND** — see Trust findings |

---

## SEO Assessment

- Comprehensive `sitemap.js` (40 static entries + all dynamic game/use-case routes), correct canonical URLs, consistent pricing figures site-wide (no contradictions found across Hero/Pricing/lead forms/JSON-LD).
- Structured data present and correct on the pages that matter most: homepage and pricing carry `Organization`, `Service`, `Review`, `FAQPage`, `AggregateOffer` JSON-LD (`src/app/page.js:117-143`).
- 100% `next/image` usage, zero raw `<img>` tags, alt text present throughout (some generic instances, e.g. `Hero.js:265-319`).
- Findings: robots.txt over-permissiveness and `/games` nav-orphaning, both listed above (P1).

## AEO / GEO / AI Search Assessment

Teamtastic is **already ahead of most small competitors here** — a well-formed `public/llms.txt` exists (business description, differentiators, and 18 recommended URLs, correctly targeting the highest-intent blog content), robots.txt does not block AI crawlers (GPTBot/ClaudeBot/PerplexityBot are implicitly allowed), and FAQ/Organization schema is in place on key pages.

2026 market context (researched): AEO focuses on being the extracted answer (featured snippets, voice, AI Overviews); GEO focuses on being *cited* inside AI-generated answers (ChatGPT, Gemini, Perplexity, Copilot). Practical small-business checklist: verify AI crawlers aren't blocked (✅ already true here), FAQ/Review/Product schema (✅ mostly true here), open each content section with a direct 2–3 sentence answer before detail, keep brand/entity naming identical across site/Google Business Profile/LinkedIn. No external tool can guarantee citation — only raise the probability.

**Recommendation:** no paid AI-visibility tool needed before launch. If revisited post-traction, Otterly.AI (~$29/mo) is the right-sized entry point — Profound/Peec are enterprise-tier ($99–499+/mo) and not justified at current scale.

---

## Lead Generation Assessment

Traced end-to-end: `src/app/api/leads/route.js` validates a source allow-list, rate-limits by IP+email hash, verifies Turnstile, strips client-spoofable "test" markers server-side, and inserts idempotently (submission-ID pre-check + Postgres `23505` fallback) into `leads` with full UTM/landing/referrer/budget/timeline persistence — **attribution genuinely survives the funnel**, this is not decorative UTM capture.

- **[Good, verified]** Notification failure is not a silent data loss: a `notification_deliveries` table tracks per-attempt status, and `retry_pending_lead_notifications()` runs every 5 minutes via `pg_cron` for up to 7 days / 5 attempts if Resend fails.
- **[P0]** The only channel a human is alerted through — for a brand-new lead *or* a Claude-classified "interested"/"question" reply, the highest-value moments in the entire funnel — is one Resend email to a single `INTERNAL_NOTIFICATION_EMAIL` inbox. No SMS, Slack, or push exists anywhere in the codebase (confirmed via repo-wide grep). A missed inbox notification or a from-domain deliverability issue on day one has no fallback except someone proactively opening `/office`.
- **[P1]** Nurture automation (`send-nurture-emails`) is scoped only to `lead_source = 'event_quiz'` — leads from the holiday pages, playable demo, and concierge modal get zero automated re-engagement if they don't respond to SLA-driven outreach tasks.
- **[P1]** The SLA/response-time dashboard (`office/(private)/sla`) is scoped only to 3 holiday-specific lead sources. Management cannot currently see "unresponded leads" or "response time" for the majority of funnel entry points.

---

## Sales Engine Assessment

**Data model** (verified against migrations): `leads` (raw submissions) → `prospects` (deduped identity, `email_normalized` unique) → `companies` (separate entity) → `deals` (real opportunity object, FK'd, not conflated) → `clients`/`events`. This is a cleaner separation of LEAD/CONTACT/COMPANY/OPPORTUNITY/CUSTOMER than most small companies build.

**Pipeline** (`deals.stage` 12-value enum): `new_lead → qualified → call_booked → call_completed → proposal_needed → proposal_sent → decision_pending → deposit_paid → event_scheduled → completed → rebooking`, plus terminal `closed_lost`. Transitions are automated and audit-logged (`deal_stage_history`), not just UI-driven — booking confirmation and Stripe payment both auto-advance the stage via database triggers, and a paid customer with no prior lead record gets a prospect/deal *retroactively created* rather than falling outside the CRM.

- **[P1]** No distinct DISCOVERY or REFERRAL stage — a Gmail-classified `referral` reply produces only a task, never a pipeline-visible stage change.
- **[P2]** Only one *open* deal allowed per prospect (unique partial index) — blocks two simultaneous legitimate opportunities for a repeat-business company. No `owner`/rep-assignment column anywhere — a non-issue solo, a blocker before hiring a second salesperson.

**Outbound (Apollo):** discover → enrich → score → draft → **human approval enforced at the database constraint level** (`outreach_drafts` check constraint requires `approved_by` + `approved_at` before `status = 'approved'`) → send with a 14-day domain-cooldown and a re-check of production/certification classification at send time. **This cannot send autonomously** — genuinely strong engineering, one of the better-built parts of the whole system.

**Inbound (Gmail):** two-tier classification — regex hard-stops (unsubscribe/legal/complaint/out-of-office) before any LLM call, then Claude Haiku for the fuzzy interested/not-interested/referral/question/unknown cases, with regex fallback on LLM failure and automatic escalation of low-confidence results. Solid design. The gap is the same P0 as above: classification produces only a `tasks` row, no push notification.

---

## Email + Nurture Assessment

Stop-condition is real and correctly ordered: `send-nurture-emails` calls `lead_has_paid_hosted_event()` before every single send, keyed directly off `stripe_events` (written by the webhook) rather than depending on the slower CRM-conversion step — **the specific failure mode the audit was asked to hunt for (customer keeps getting promotional email after paying) does not occur.** Suppression/unsubscribe is enforced centrally. Scheduling is a real hourly `pg_cron` job, not aspirational.

Gap: coverage is quiz-only (P1, above).

---

## Booking Assessment

Walked the flow live at `/book`: real dynamic dates, correct timezone display ("Times are displayed in America/New York"), Turnstile verification gating live availability.

- **[Verified strong]** Double-booking is prevented at the **database** level via a Postgres `EXCLUDE USING gist` constraint on the booking time range — not a race-prone application-level check.
- **[Verified]** Manage-booking tokens are 256-bit random, only the SHA-256 hash is ever stored/queried — unguessable.
- **[P1]** Zero route-level tests exist for `confirm`, `cancel`, `reschedule`, `availability`, or `config` — these are revenue-path endpoints shipping with no direct test coverage.
- **[P2]** Manage tokens don't expire independently of booking status/date — low risk given entropy, but no defense-in-depth TTL.

---

## Payments Assessment

- **[Verified]** Stripe webhook signature is checked (`stripe.webhooks.constructEvent`), wrapped in try/catch → 400 on failure. Idempotency is enforced two ways: a DB unique constraint on `stripe_event_id` and an app-level duplicate-safe branch. Double-click/duplicate-charge protection uses both a content-fingerprinted `payment_requests` row reuse and a real Stripe `idempotencyKey`.
- **[P0]** **No refund or dispute handling exists anywhere in the codebase** — the webhook handler explicitly only processes `checkout.session.completed`; `charge.refunded` and `payment_intent.canceled` are not handled at all. The live FAQ page currently states: *"Yes. We offer full refunds for cancellations made more than 48 hours before a booked hosted event."* This is a direct, customer-facing promise the system cannot execute: a manual Stripe refund will never propagate to `clients`/`deals` state, permanently leaving a refunded customer marked "paid"/"converted" in the CRM.
- **[P1]** `20260825120000_launch_certification_policy_v62.sql` (71KB, the most recent migration) was registered in the production migration ledger via a standalone script (`supabase/tests/register_migration_once.mjs`) that inserts the ledger row directly and **never executes the migration's SQL against the schema**. Whether production's actual schema matches this migration is currently unverified. I attempted a read-only verification query against production and it was correctly blocked by the permission system as a production-touching action — **this needs the founder's own sign-off**, see Launch-Day Checklist. Confirmed blast radius: internal `/office/certification` and `/office/launch` tooling only, not the customer checkout/booking path.

---

## Client Management Assessment

Architecture cleanly distinguishes LEAD → PROSPECT → COMPANY → DEAL → CLIENT/EVENT via foreign keys, not shared/overloaded columns — better than typical for a company this size. Weaknesses are the same ones noted above: no rep-ownership concept (fine solo), and the "one open deal per prospect" constraint (minor, fine for launch).

## Analytics Assessment

`office/(private)/roi` answers leads→qualified→calls→proposals→deposits→revenue→CPL→ROAS by campaign/source. `office/(private)/page.js` (main dashboard) surfaces interested replies, overdue deals, today's bookings, failed automation entries, and pending outreach — a genuinely usable single-screen operator view. The gap is SLA/response-time visibility outside the 3 holiday sources (P1, noted above). Client-side conversion tracking (`funnel-events`) is validated and rate-limited; the Hero's two primary CTAs are not directly instrumented (P2).

## AI Capability Assessment

Already substantive and mostly invisible to the buyer: Apollo-based lead discovery/enrichment, Claude Haiku inbound-intent classification, automated CRM stage transitions driven by real business events (payment, booking) rather than manual data entry, and — notably — a database-enforced human-approval gate that makes autonomous outbound sending structurally impossible, not just policy-discouraged. See AI Maturity Score below for where this sits and what (not) to build next.

## Security / Privacy Assessment

- RLS is enabled and grants are deny-by-default on sensitive tables (`bookings`, `booking_types`, `booking_settings` — all grants revoked from `anon`/`authenticated`, service-role only). The `leads` table's RLS policy is correctly scoped to admin users today but sits atop an overly wide base grant (`authenticated` gets full CRUD) — a fragile pattern (P2) worth simplifying post-launch.
- `office/(private)` is protected **server-side** in the layout (`requireOfficeUser()` validates against real Supabase Auth + an email allowlist) — not client-side hiding.
- Both Stripe and Resend webhooks verify signatures using env-sourced secrets (Stripe's own SDK; Resend via `svix`).
- `.env*` is correctly gitignored across every pattern that matters; no env file has ever been committed to git history (verified).
- **[P1]** `supabase/tests/prod_query.sh` and `register_migration_once.mjs` are prod-reading/prod-mutating operational scripts that read a full-privilege Supabase Management API token from `.env.local` and hit production directly — both are misfiled inside `supabase/tests/`, which invites accidental execution by a future broad test-glob or CI job. Recommend moving to a clearly-named `scripts/ops/` directory.
- **[P2]** `funnel-events` (analytics-only, low value target) has rate limiting but no Turnstile — acceptable given it can't write leads/bookings/payments, only pollute attribution data.

---

## Customer Journey Findings

- **Journey A (Google → landing → browse → consultation → booking):** No friction found — homepage → games catalog → `/book` flow all work live, with correct timezone and real availability.
- **Journey B (LinkedIn → homepage → quiz → email follow-up):** Quiz reaches the CRM correctly; **but** recommendation shown to the user personalizes only on "vibe," not on team size or occasion, even though both are captured (P2) — a missed personalization opportunity, not a broken flow.
- **Journey C (AI search engine → Teamtastic page → pricing → booking):** `llms.txt` and FAQ/Organization schema mean this path is technically well-supported for late-2026 AI search behavior — ahead of most direct competitors here.
- **Journey D (Outbound email → landing page → response → sales conversation):** Structurally sound (approval-gated outbound, classified inbound) but **the human handoff on a positive reply has no urgency signal** (same P0 as above) — the conversation could sit unanswered in a task queue.
- **Journey E (Returning customer → new event → booking):** Data model supports repeat business via `clients`, but the one-open-deal-per-prospect constraint (P2) is worth revisiting before this becomes a common path.

---

## Findings Summary

### P0 — Launch Blockers (fix before or on launch day)

1. **No real Privacy Policy / Terms of Service** — dead footer links, no legal entity name or address anywhere on a site collecting PII and processing payments starting tomorrow. *(Website Engineering)*
2. **No refund/dispute handling exists in the Stripe integration, yet the live FAQ promises a refund policy.** A real refund will never sync to CRM state. *(Payments)*
3. **No real-time alert (SMS/Slack/push) for new leads or hot inbound replies** — single email inbox is the only channel for the highest-value, most time-sensitive signal in the funnel. *(Lead Gen / Sales Engine)*
4. ~~Untracked duplicate migration files in `supabase/migrations/`~~ — **fixed during this assessment** (4 confirmed byte-identical, untracked files removed).

### P1 — High Priority

- Unverified production schema state for `20260825120000_launch_certification_policy_v62.sql` (ledger entry inserted without running the SQL) — needs founder verification, see checklist.
- No route-level tests for booking API endpoints (confirm/cancel/reschedule/availability/config).
- `robots.txt` allows crawling of `/api/*`, `/office/*`, and tokenized `/book/manage/[token]` URLs.
- `/games` catalog page orphaned from primary navigation and footer.
- Blog post "50 Virtual Team Building Ideas" delivers 20, then diverts to an unrelated CTA.
- Nurture automation scoped only to `event_quiz` lead source; SLA/response-time dashboard scoped only to 3 holiday sources — most of the funnel has no automated re-engagement or response-time visibility.
- No distinct DISCOVERY/REFERRAL pipeline stage.
- Recent engineering effort disproportionately concentrated on internal "launch certification" bureaucracy (15/87 migrations, last 4 commits) rather than the commercial gaps in this list — see "What NOT to Build."
- `prod_query.sh` / `register_migration_once.mjs` are prod-privileged scripts misfiled in a `tests/` directory.
- Anonymized-only social proof (no named companies/logos) — behind two direct competitors.

### P2 — Improvements

In-memory (non-distributed) rate limiting; quiz recommendation ignores team-size/occasion despite capturing them; Hero primary/secondary CTAs untracked; manage-booking tokens lack independent TTL; `leads` RLS policy layered on an overly wide base grant; one-open-deal-per-prospect constraint; no rep-ownership column; `/games`/`/activities` missing JSON-LD; stale hardcoded copyright year; unsourced statistics block; dead `PostHogProvider.js` component; `funnel-events` has no bot check.

### P3 — Future Optimization

Stray root-level scrape/design artifacts (`html_structure.txt`, `original_activities.html`, mockup PNG) — safe to delete, zero urgency.

---

## Recommended Technology Stack

| Category | Current | Recommendation | Why |
|---|---|---|---|
| CRM | Custom Supabase schema | **Keep** | Already cleaner than most off-the-shelf CRMs for this business shape; migrating would be pure cost, no ROI |
| Lead alerting | Resend email only | **Add**: a Slack incoming webhook or Twilio SMS alongside the existing email, gated on the same conditions (`new lead`, `interested`/`question` classification) | Closes the #1 P0 gap; a few hours of work, no new vendor contract needed for Slack |
| Booking | Native scheduler (already replaced Calendly) | **Keep** | Genuinely more capable than Calendly here (DB-level concurrency safety, integrated Zoom/Calendar, CRM sync) |
| Outbound | Apollo.io | **Keep** | Approval-gated design is already correct; don't add a second outbound tool |
| Inbound classification | Claude Haiku via Gmail ingestion | **Keep** | Well-scoped, cheap, has a regex fallback |
| AI visibility monitoring | None | **Defer** | `llms.txt` + schema already in place; add Otterly.AI (~$29/mo) only after real search-referral traffic exists to monitor |
| Legal pages | None | **Add**: Privacy Policy + Terms (template service like Termly/Iubenda, or a lawyer for the refund/cancellation terms specifically, given real money changes hands) | P0 |

## Build vs Buy Recommendations

- **Legal pages:** Buy/template (Termly, Iubenda, or a one-time lawyer review) — do not hand-write refund/cancellation terms without review given live payment processing.
- **Lead alerting:** Build (Slack webhook is ~20 lines given the existing notification infrastructure) — buying a dedicated alerting tool for one webhook is overkill.
- **AI visibility monitoring:** Defer, then buy (Otterly.AI) when there's traffic to monitor — do not build custom AI-citation tracking.
- **CRM/sales engine:** Keep building internally — already ahead of what a bought CRM (HubSpot, Pipedrive) would offer for this specific booking→payment→event workflow, and migrating now would be pure sunk cost.

## What NOT to Build Yet

- **No autonomous SDR agent.** The current human-approval gate on outbound is a deliberate, well-built safety feature — removing it for "efficiency" would trade a real differentiator (a founder personally reviewing every cold email) for spam risk.
- **No expanded self-certification framework.** The existing "launch readiness" system (22 gates, synthetic-lead pilots, multi-migration attestation chain) is already more elaborate than a solo-operator business needs. Adding to it before fixing the P0 alerting gap would repeat the exact pattern this audit flags as a risk.
- **No third-party CRM migration** (HubSpot/Salesforce) — the custom schema is better-fitted to this specific commercial model than a generic CRM would be at this scale.
- **No AI website concierge/chatbot** — hallucination risk on pricing/availability questions is real, and the existing quiz + lead form + FAQ already answer the qualifying questions a chatbot would. Revisit only if post-launch data shows visitors bouncing specifically on unanswered questions.
- **No advanced attribution warehouse** — the existing `office/roi` page already answers source→revenue; a dedicated attribution product is enterprise-scale tooling for enterprise-scale ad spend this business doesn't have yet.

## Launch-Day Checklist

**Automated verification (already done in this assessment):**
- ✅ `npm run lint` / `typecheck` / `test` / `build` all pass
- ✅ Stripe/Resend webhook signature verification confirmed present
- ✅ Booking double-booking prevention confirmed at DB level
- ✅ Nurture stop-on-payment condition confirmed correct
- ✅ Outbound human-approval gate confirmed enforced at DB constraint level
- ✅ No secrets leaked to client bundles
- ✅ Duplicate migration files removed

**Manual verification (founder must do — requires production access this session correctly declined to touch):**
- [ ] Run the read-only check in `supabase/tests/prod_query.sh` against production to confirm the objects created by `20260825120000_launch_certification_policy_v62.sql` (e.g. `public.launch_phase_milestones`, `automation.derive_sales_lifecycle_stage`) actually exist in the live schema, not just the migration ledger.
- [ ] Decide and publish the real refund policy, then either implement `charge.refunded` handling or update the FAQ to match reality.
- [ ] Publish real Privacy Policy + Terms of Service and link them from the footer.
- [ ] Confirm `INTERNAL_NOTIFICATION_EMAIL` inbox is actively monitored on launch day, or ship the Slack/SMS alert first.

**Owner sign-off:**
- [ ] Founder confirms Stripe account is in live (not test) mode with correct payout details.
- [ ] Founder confirms `OFFICE_ALLOWED_EMAIL` allowlist is current.

## First 30 Days

- **Day 1:** Watch `/office` main dashboard directly (not just email) for the first real leads; confirm notification delivery end-to-end with a real test submission.
- **Day 7:** Review actual response times to real leads — decide if the SLA dashboard needs to expand beyond holiday sources sooner than planned.
- **Day 14:** Check whether any refund/cancellation requests occurred and whether the manual process held up; check nurture-coverage gap (non-quiz leads) against actual lead-source mix.
- **Day 30:** Review `office/roi` for real source→revenue data; decide next investment (paid social proof/testimonials, nurture expansion, or SLA dashboard expansion) based on where real leads are actually coming from — not on assumption.

## Scorecard

| Category | Score | Evidence |
|---|---|---|
| Website Engineering | 8/10 | Clean build/lint/typecheck/240-test suite; real gaps are content-completeness and nav, not architecture |
| UX | 8/10 | Clear 5-second value prop, working live pricing calculator, functional booking flow |
| Mobile UX | 7/10 | Not independently re-verified live in this pass beyond desktop walkthrough; no mobile-specific defects surfaced by either agent or spot-checks |
| Conversion | 7/10 | Strong hero/pricing/CTA structure; held back by anonymized-only social proof |
| Brand Positioning | 8/10 | Consistent "Master Emcee" voice across site, sales email, and booking copy |
| Trust | 4/10 | No legal pages, no legal entity/address, anonymized-only testimonials — the weakest category |
| SEO | 7/10 | Strong technical foundation; nav-orphaned `/games`, permissive robots.txt |
| AEO/GEO/AI Discovery | 8/10 | `llms.txt` + FAQ/Organization schema already in place — ahead of most direct competitors |
| Lead Generation | 7/10 | Attribution genuinely survives the funnel end to end; single-channel alerting is the real weakness |
| CRM | 8/10 | Clean LEAD/PROSPECT/COMPANY/DEAL/CLIENT separation, audit-logged stage transitions |
| Sales Automation | 8/10 | Approval-gated outbound + classified inbound is genuinely above typical small-company sophistication |
| Email/Nurture | 6/10 | Correctly stops on payment; coverage limited to one lead source |
| Booking | 9/10 | DB-level concurrency safety, correct timezone handling, verified live |
| Payments | 6/10 | Signature/idempotency solid; refund handling is a real, customer-promised gap |
| Client Management | 8/10 | Clean data model, retroactive CRM creation on payment |
| Analytics | 7/10 | ROI dashboard answers most management questions; SLA visibility gap |
| AI Utilization | 8/10 | Substantive, invisible-to-buyer sales automation; correctly gated against autonomy risk |
| Security/Privacy | 7/10 | RLS deny-by-default, server-side admin auth, verified webhook signatures; ops scripts misfiled |
| Competitive Position | 7/10 | Differentiated on self-serve entry and pricing transparency; behind on named social proof |
| **Overall Commercial Readiness** | **7/10** | Strong core, four bounded fixes stand between this and a clean launch |

## AI Maturity Score

**Current level: Level 3 — AI-assisted sales/customer workflows.**

Evidence: Claude Haiku classifies inbound email intent with a regex fallback; Apollo enrichment feeds lead scoring; deal-stage transitions are automated off real business events; outbound generation is AI-drafted but human-gated at the database level, not merely the UI.

**Not yet Level 4** (integrated intelligent operating system) — the gaps (single-channel alerting, coverage-limited nurture/SLA dashboards) show the AI workflows aren't yet woven into a fully reliable operating loop; a hot reply can currently sit unnoticed despite being correctly classified.

**Recommendation for next 12 months: stay at Level 3, focus on reliability over autonomy.** Close the alerting and coverage gaps identified in this report before adding any new AI capability. Do not pursue Level 4/5 (autonomous business operations) — the existing human-approval gate on outbound is a deliberate strength, and the certification-bureaucracy pattern already observed in this codebase is evidence that more autonomous process-building is not this business's current bottleneck. The bottleneck is answering real leads fast, once they arrive.

## Final Verdict

**READY TO LAUNCH WITH MINOR CONDITIONS.**

The commercial engine — lead capture, CRM, booking, payments, and sales automation — is built to a standard well above what's typical for a company this size, verified by direct code inspection rather than taken on faith. The four P0 conditions (legal pages, refund-handling truth, real-time lead alerting, and the now-completed migration-file cleanup) are each bounded, same-day, no-new-infrastructure fixes. Fix those — or at minimum the alerting and legal-page gaps, which carry the most real-world downside — before or within the first 24 hours of live traffic, and this is a genuinely sound commercial launch.
