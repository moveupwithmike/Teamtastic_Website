# 16 — Payments & Stripe

Refreshes [06-Payments-and-Booking.md](06-Payments-and-Booking.md) against the current codebase. Headline finding: **there is no dynamic checkout anywhere in this repo.** Every "charge the customer" surface, in both the storefront and the office CRM, is a static Stripe Payment Link with two fixed amounts.

## `src/lib/stripe.js` — the entire payments config

One exported object, three static URLs: `depositUrl` ($200, generic), `familyDepositUrl` ($100, family/consumer), `calendlyUrl` (legacy fallback). No server-side Stripe SDK usage for creating anything — the only place `Stripe` the SDK is imported anywhere in the repo is `/api/stripe/webhook/route.js`, and solely to verify webhook signatures (`stripe.webhooks.constructEvent`), never to create a Checkout Session or PaymentIntent.

## `src/lib/pricing.js` / `src/lib/products.js`

`pricing.js`'s `HOSTED_PRICING` (per-person rates, minimums, deposit amount) is a **marketing-copy/estimator data object only** — it never touches Stripe. `products.js`'s `PRODUCT_KEYS`/`classifyStripeSession()` exist purely to label an *already-completed* Stripe session after the fact (matching on `session.metadata.product_key`, then on which static Payment Link id was used, then falling back on `mode`) — for webhook classification/analytics, not for pricing.

## The price-quote-vs-flat-charge pattern (confirmed repo-wide)

Every surface that shows a customer a computed or quoted price uses the *same two* flat Payment Links to actually charge them, confirmed via grep — there is no per-package or per-quote link/session anywhere:

| Surface | Shows a computed/quoted price? | Actual charge |
|---|---|---|
| `Pricing.js` calculator | Yes — `estimatedTotal` from player count/tier/add-ons | N/A — every CTA on this page routes to the quiz or a mailto, it never itself renders a checkout link |
| `GameQuiz.js` result screen | Yes — displays the `Pricing.js` estimate handed off via `sessionStorage`, and logs `estimator_total` to analytics | `PAYMENT_CONFIG.depositUrl`, flat $200, regardless of the number just shown |
| `CorporateLeadForm.js` / `TalkToMichaelModal.js` | Yes — subtitle states a per-person rate and minimum | Flat `depositUrl`/`familyDepositUrl` ($200/$100) |
| Office `createProposal` / `approveAndSendProposal` ([12](12-Private-Sales-Office.md)) | Yes — a rep-entered custom price in the email body | Same flat `NEXT_PUBLIC_STRIPE_DEPOSIT_URL` |

The one piece of real dynamism Stripe Payment Links support here is used consistently: `prefilled_email`/`client_reference_id` query params are appended client-side everywhere a deposit link is rendered, which is what lets the webhook later match a payment back to a specific lead/submission.

## `/api/stripe/webhook/route.js`

Verifies signature via `stripe.webhooks.constructEvent`; 503 if secrets are missing, 400 on bad signature. Only handles `checkout.session.completed` — every other event type (refunds, subscription lifecycle, etc.) returns `200 "Ignored"`, unhandled by design at this stage. Idempotent via a `stripe_events.stripe_event_id` duplicate check, but re-runs side effects (lifecycle processing + internal alert) on a duplicate if they hadn't completed the first time, rather than short-circuiting blindly — a reasonable choice, though it means the alert path being un-idempotent internally could double-fire if hit exactly at the wrong retry boundary.

Feeds the phase4 client-lifecycle automation via the `process_paid_conversion` RPC (see [15](15-Database-Schema-Map.md) for the `stripe_events`-consumer mismatch this connects to) and fires a server-side PostHog event keyed by product type. **The internal-alert email failing causes the whole webhook to return 503**, which will make Stripe retry delivery even though the DB write already succeeded — the duplicate-event check mitigates re-insertion, but this coupling (alert-email reliability gating Stripe's view of webhook success) is worth flagging as a design smell, not a broken feature.

## Gaps (ranked)

1. **No dynamic checkout anywhere** — a rep-quoted or calculator-quoted price never becomes the actual amount charged; every payment surface uses one of two flat, hardcoded Payment Links. This is the single largest gap in this doc set by breadth (it touches the public quiz, both concierge surfaces, and the internal office proposal flow identically) even though each individual instance is low-severity on its own.
2. **Alert-email failure causes a 503 on an otherwise-successful webhook**, inviting Stripe retries against an event that's already durably recorded.
3. Only `checkout.session.completed` is handled — refunds/disputes/subscription-lifecycle events are explicitly out of scope today, worth confirming that's still the intended scope as any subscription-based product (`PRODUCT_KEYS.PRO`) matures.
