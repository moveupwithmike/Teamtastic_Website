# 09 — Modernization Implementation Plan

> Based on `08-Modernization-Design.md`  
> Execution rule: complete and verify each gate before starting the next phase.

## Goal

Make lead capture and revenue processing dependable first, then consolidate business rules, repair measurement and SEO, and finally add engineering safeguards. The plan deliberately avoids a rewrite and evolves the existing Next.js/Supabase architecture.

## Phase 0 — Production safety and truthful conversion

### 0.1 Activate reliable lead delivery

- [ ] Confirm Vercel Production contains Supabase, Turnstile, and Resend variables.
- [ ] Configure the `notify-new-lead` Supabase Edge Function with:
  - `LEAD_NOTIFICATION_WEBHOOK_SECRET`
  - `RESEND_API_KEY`
  - `RESEND_FROM_EMAIL`
  - `INTERNAL_NOTIFICATION_EMAIL`
- [ ] Store matching `lead_notification_function_url` and `lead_notification_webhook_secret` values in Supabase Vault.
- [ ] Apply `202607030001_reliable_lead_capture.sql`.
- [ ] Confirm the migration removes legacy trigger `on_lead_created` and creates only `leads_notify_after_insert`.
- [ ] Confirm anonymous roles cannot insert into `leads` or access delivery/payment tables.
- [ ] Add an operational query for leads missing notification-delivery rows.
- [ ] Add a retry schedule for pending/failed notification deliveries.

**Verification**

- Submit each of the four lead sources.
- Confirm one lead, one customer confirmation, and one internal email per submission.
- Replay a submission ID and confirm no duplicate lead or email.
- Force a Resend failure and confirm it remains visible and retryable.

**Release gate:** no lead is reported successful without a database row; notification loss is observable and recoverable.

### 0.2 Correct customer-facing promises

- [ ] Replace playable-demo “credentials sent instantly” copy with an honest confirmation and free-lobby link.
- [ ] Create source-specific customer email content for quiz, demo, corporate concierge, and family concierge.
- [ ] Define and display a realistic response-time expectation for concierge leads.
- [ ] Reset concierge state after completed submissions and preserve it only for unfinished forms.

**Verification**

- Compare every success message with the email actually received.
- Reopen each concierge after success and confirm no previous customer information appears.

### 0.3 Make payment processing product-aware

- [ ] Add a product registry for `hosted_event_deposit`, `pro_subscription`, and `custom_content`.
- [ ] Configure Stripe payment-link IDs or metadata for unambiguous classification.
- [ ] Branch webhook behavior by product and `session.mode`.
- [ ] Rename analytics and email subjects appropriately:
  - deposit → `deposit_completed`
  - subscription → `subscription_started`
  - custom content → `custom_content_purchased`
- [ ] Persist unknown checkouts as `unclassified`; alert without calling them deposits.
- [ ] Return a retryable webhook response when payment persistence succeeds but the required internal alert fails.
- [ ] Register and verify the production Stripe webhook.

**Verification**

- Replay signed fixtures for each product, an unknown product, an invalid signature, and a duplicate event.
- Complete one test-mode purchase per active product.
- Confirm exact database row, internal email, and PostHog event.

**Release gate:** no non-deposit purchase can generate a deposit alert or metric.

### 0.4 Resolve commercial configuration

- [ ] Decide and document the authoritative hosted-event price floor.
- [ ] Reconcile `$35/person`, `$40/person`, `$400 minimum`, and the `$200 deposit`.
- [ ] Decide whether the `$99/month` subscription and custom-content product are currently sellable.
- [ ] Remove unavailable CTAs; add active products to the pricing page.
- [ ] Configure production Calendly and Stripe URLs.
- [ ] Carry pricing-estimator selections into the quiz and lead context.

**Release gate:** every public price and CTA matches an active checkout path.

## Phase 1 — Canonical business contracts

### 1.1 Shared schemas and vocabularies

- [ ] Add TypeScript and Zod for boundary code without converting the whole application.
- [ ] Define canonical enums for source, team size, vibe, occasion, and product.
- [ ] Create one lead-request schema shared by form clients and `/api/leads`.
- [ ] Normalize legacy concierge display values at the API boundary.
- [ ] Stop demo forms from fabricating team-size/vibe/occasion values; store unknown values as `null`.
- [ ] Add a migration/backfill mapping existing lead values to canonical keys.

**Verification**

- Schema tests cover every accepted source and reject unknown values.
- SQL grouping returns one vocabulary for each segmentation field.

### 1.2 Consolidate recommendations

- [ ] Replace title-only recommendations with real `gamesData` slugs.
- [ ] Create one recommendation engine supporting corporate and family audiences.
- [ ] Make quiz and concierge consume the same result type.
- [ ] Link recommendation results to real `/games/[slug]` pages.
- [ ] Validate recommendation slugs at build/test time.

**Release gate:** every recommended game exists in the catalog and has a working landing page.

### 1.3 Centralize products and pricing

- [ ] Move prices, deposit amount, checkout URLs, and product availability into one registry.
- [ ] Make Pricing, quiz results, banners, and webhook classification consume that registry.
- [ ] Remove dead `calendlyEmbedCode` and unused `customContentLink` if the product is inactive.
- [ ] Add startup/build validation for required production variables.

## Phase 2 — Trustworthy analytics and SEO

### 2.1 Repair the PostHog contract

- [ ] Send the anonymous PostHog distinct ID with lead submissions.
- [ ] Persist that anonymous ID with the lead and reuse it for server/revenue events.
- [ ] Rename server persistence event to `lead_recorded`; keep only one `lead_captured` funnel event.
- [ ] Standardize all event properties as `snake_case`.
- [ ] Guard `quiz_started` so it fires once per quiz attempt.
- [ ] Track demo completion, Pro CTA, game-launch CTA, estimator changes, and booking-banner clicks.
- [ ] Add a consent control that writes `teamtastic_analytics_consent`.
- [ ] Rebuild PostHog funnels after event-contract changes.

**Verification**

- PostHog lead counts match Supabase samples.
- Deposit/subscription counts match Stripe samples.
- No event includes names, emails, phone numbers, free text, or bot tokens.

### 2.2 Repair SEO and rendering

- [ ] Generate sitemap game URLs from `gamesData`.
- [ ] Remove nonexistent sitemap slugs and include all important static routes.
- [ ] Add `generateMetadata` for every game page.
- [ ] Split `/games` into a Server Component route and client-only catalog controls.
- [ ] Redirect `/activities` permanently to `/games`.
- [ ] Add canonical URLs.
- [ ] Replace the oversized mockup with a purpose-built social image.
- [ ] Convert priority marketing imagery to `next/image`.
- [ ] Improve thin imported game content before indexing it.

**Verification**

- Sitemap URLs return 200 or an intentional redirect.
- Every game page has a unique title, description, canonical URL, and social preview.
- Catalog content is present in initial HTML without client execution.

## Phase 3 — Engineering safety and cleanup

### 3.1 Tests

- [ ] Add unit tests for schemas, normalization, recommendations, and product classification.
- [ ] Add API tests for validation, rate limiting, Turnstile outcomes, idempotency, and Supabase failures.
- [ ] Add Stripe webhook tests for signatures, classification, replay, matching, and retry.
- [ ] Add browser smoke tests covering all four lead sources and post-capture CTAs.
- [ ] Add database tests for migration constraints, trigger replacement, and RLS.

### 3.2 CI and observability

- [ ] Fix the existing ESLint baseline.
- [ ] Add `typecheck`, `test`, and `test:e2e` scripts.
- [ ] Add GitHub Actions: install → lint → typecheck → tests → build.
- [ ] Upload PostHog source maps from the production build.
- [ ] Add scheduled checks for failed notifications and unmatched payments.
- [ ] Document rollback for migration, Edge Function, and webhook releases.

**Release gate:** changes cannot merge when lint, type, tests, or production build fail.

### 3.3 Repository cleanup

- [ ] Rename the package from `temp_next_app`.
- [ ] Replace the starter README with setup, architecture, testing, and deployment instructions.
- [ ] Move import/scraping tools and raw captures to `tools/catalog-import/` or archive them.
- [ ] Move `jimp` to development dependencies if retained.
- [ ] Delete the no-op PostHog provider and unused code paths.
- [ ] Remove or render intentionally unused game-data fields.

## Execution sequence

| Order | Work package | Dependency | Estimated size |
|---|---|---|---|
| 1 | Lead migration, Edge secrets, delivery verification | Production credentials | 1–2 days |
| 2 | Truthful copy and source-specific emails | Lead delivery | 0.5–1 day |
| 3 | Stripe product classification and retry | Stripe product IDs | 1–2 days |
| 4 | Pricing/product decision and registry | Business decision | 1–2 days |
| 5 | Canonical schemas and lead backfill | Stable product vocabulary | 2–3 days |
| 6 | Recommendation consolidation | Catalog audit | 1–2 days |
| 7 | Analytics contract repair | Canonical schemas | 1–2 days |
| 8 | Sitemap, metadata, server/client split | Catalog contract | 2–3 days |
| 9 | Tests and CI | Stable interfaces | 3–5 days |
| 10 | Cleanup and documentation | CI active | 1–2 days |

## Definition of done

- Every lead is durably recorded, notified once, and retryable.
- Every payment is classified correctly, deduplicated, and reconciled.
- Public promises, prices, and links reflect working products.
- Lead and analytics vocabularies are canonical and tested.
- PostHog, Supabase, and Stripe totals reconcile within documented timing differences.
- All indexed pages have valid metadata and sitemap coverage.
- CI enforces lint, types, tests, and production build.
- Production operations have monitoring queries and rollback instructions.

