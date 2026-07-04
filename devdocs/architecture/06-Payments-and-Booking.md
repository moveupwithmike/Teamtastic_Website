# 06 — Payments & Booking

## Configuration — [src/lib/stripe.js](../../src/lib/stripe.js)

`PAYMENT_CONFIG` holds three externally-hosted checkout surfaces (no in-app checkout exists):

| Key | Product | Backing |
|---|---|---|
| `calendlyUrl` | Hosted VIP MC event — **$200 deposit** collected at booking | Calendly event type with Stripe payment enforcement (`NEXT_PUBLIC_CALENDLY_URL`) |
| Custom content | Active, custom quote based on scope | Captured through the event quiz; no fixed Payment Link |

Fail-safe behavior: in production, an unset env var resolves to a dead anchor (`#payment-configuration-required` / `#booking-configuration-required`) instead of the dev mock URLs — CTAs break visibly rather than sending customers to placeholder Stripe pages. **Consequence: all three env vars are launch-blocking config** (see doc 07 checklist).

`calendlyEmbedCode` (inline-widget HTML string) is exported but **never imported anywhere** — dead code from a planned embedded-Calendly approach; the quiz links out instead.

## Deposit booking flow (primary revenue path)

```
GameQuiz result → Calendly link with ?name=&email=&a1=<company|teamSize|vibe|occasion|rec|submissionId>
  → invitee picks slot, pays $200 via Calendly's Stripe integration
  → Stripe checkout.session.completed → /api/stripe/webhook
  → stripe_events row + lead match (email fallback — see doc 04 gap #1)
  → internal "Deposit received" email + PostHog deposit_completed
  → customer confirmations come from Calendly + Stripe native emails (dashboard config)
```

The `a1` prefill packs six fields into one Calendly custom-question answer. It survives into the Calendly booking record (and Calendly webhooks, if ever subscribed) but **does not propagate into the Stripe session**, which is why webhook lead-matching falls back to email.

## Pricing surfaces & consistency

Pricing is stated in four places with **three disagreeing anchors**:

| Surface | Claim |
|---|---|
| [Pricing.js](../../src/components/Pricing.js) estimator | $35/pp core, $58/pp premium, **$350 minimum**, add-ons ($25–40/pp kits, +$250 awards, +$300 premium host, +$200 theme, +$150 extra time) |
| [CtaBannerWithModal.js](../../src/components/CtaBannerWithModal.js) | "start at **$35 per person**" |
| GameQuiz result CTA | "$200 Deposit" + free-game launch |
| Pricing add-ons | Custom content is quoted separately based on scope |

The hosted-event starting rule is now canonical: **$35 per person with a $350 minimum for groups up to 10**. It lives in `src/lib/pricing.js`. The $99/mo subscription is inactive and has been removed from customer-facing surfaces. Custom-content work remains available by quote.

## Gaps summary

1. **Webhook treats every checkout as a deposit** — subscription checkouts from `proSaaSLink` will be recorded/alerted/tracked as deposits (doc 04 gap #2).
2. **Deposit ↔ lead matching is email-only in practice** (doc 04 gap #1); the `matched=false` monitoring query in LEAD_FUNNEL_OPERATIONS.md is the safety net and should be checked routinely.
3. **Custom-content quoting context** should be carried from the estimator into the lead so scope can be priced efficiently.
4. **Dead `calendlyEmbedCode` export.**
5. **Pricing estimator produces intent but no capture** — "Estimated Total" ends in `/#quiz` links rather than carrying the configured estimate into the quiz/lead payload (`context` field already exists for exactly this kind of data). The user rebuilds their selection from scratch in the quiz.
6. No Stripe *customer* confirmation emails are sent by this codebase for deposits — by design (Calendly/Stripe dashboard-native emails); the operational checklist correctly flags enabling them as a manual dashboard step.
