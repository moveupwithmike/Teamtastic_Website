# 19 — Consolidated Gaps and Launch Risks

Updated August 23, 2026. The earlier gap audit is superseded by this verified
current-state summary.

## Launch blockers

- Final production certification is still running. Safari/Firefox lead-form
  evidence and real inbox-placement evidence have not been attested.
- The production task queue contains overdue priority work and cannot be treated
  as empty. Much of it is synthetic certification residue, but at least one
  older inbound lead and operational follow-ups require human review.
- One high-severity GDELT signal-research incident remains open. The provider is
  intermittently rate-limiting and timing out.

## Conversion and trust gaps

- Footer Privacy Policy and Terms of Service labels are not links and no legal
  routes exist in this repository.
- Social icons on the experience-specific footer point to `#` instead of real
  profiles.
- The in-app verification browser could not render Cloudflare Turnstile. The
  script is present and the production certification records Chromium success,
  but Safari and Firefox still require explicit manual evidence.

## Lead-generation coverage

- Apollo discovery, enrichment, scoring, drafting, Gmail reply ingestion, daily
  reporting, follow-up drafting, and send-worker schedules are deployed.
- Prospecting and sequence sends remain safely disabled by configuration.
- Draft generation is deterministic and brand-templated, not LLM-generated.
  This is safer for first launch but is not the maximum possible AI
  personalization. Add an LLM drafting layer only behind the existing human
  approval, suppression, evidence, and daily-cap gates.
- Organic Intent Radar is implemented but disabled pending Reddit commercial
  permission. It must not be activated early.
- SEO/GEO coverage is strong: `llms.txt`, sitemap generation, structured data,
  high-intent landing pages, comparison content, and funnel attribution exist.

## Verified strengths

- Dynamic Stripe Checkout, signed webhooks, amount matching, idempotency, and
  lifecycle reconciliation are implemented and tested.
- Lead capture, booking, cancellation, rescheduling, reminders, suppression,
  consent, PostHog identity, and game handoff have automated coverage.
- Production migrations and all 14 sales-engine Edge Functions are deployed on
  the shared Teamtastic production project.
- The latest production readiness snapshot before this audit reported healthy
  conversion, notification, deal-next-action, qualification, and mailbox checks.
- The local, not-yet-deployed August 23 readiness migration is designed to
  prevent future snapshots from hiding open high-severity incidents, overdue
  priority tasks, or incomplete final certification. The currently deployed
  evaluator can still report a false-green result.

See [20-Remaining-Work-Implementation-Plan.md](20-Remaining-Work-Implementation-Plan.md)
for the active closeout order.
