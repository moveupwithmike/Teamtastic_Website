# 20 — Sales Engine Clean-Launch Checklist

Updated August 25, 2026. This is the active path for moving from a fully
synthetic/test pipeline to the first controlled production campaign.

## Corrected pipeline baseline

There are **zero verified real leads, qualified opportunities, customers, or
production bookings** in the current Sales Office dataset.

- All 10 lead rows are fictional, QA, system-verification, or certification data.
- All 16 Apollo contacts are discovery/research seed records. They may identify
  real external people, but they have no inbound engagement or commercial
  evidence and are not Teamtastic leads or qualified opportunities.
- The four Apollo rows labeled `qualified` are incorrectly named for business
  purposes. Each has only a score of 60 and a deterministic draft; none has a
  lead, deal, task, message, reply, meeting, or customer interaction.
- All six deals are Test Co, certification, or QA journeys.
- All three client rows are Acme/test, certification, or archived QA data.
- The one booking explicitly has `synthetic_test: true`.
- The four review drafts and 18 retired drafts are test/research inventory and
  must not be sent.

Dashboard status values are not evidence that a person is a real lead. Until
the data model enforces provenance, all current pipeline rows must be treated as
non-production.

## Current operating state

- Launch phase: `inbound_pilot`.
- Outbound, prospecting, sequences, nurture, proposal email, and Organic Intent
  Radar: off.
- Open incidents: zero.
- Launch Control: blocked only by final production certification, with one
  non-blocking Reddit follow-up warning.
- Certification: 12 of 13 automated gates satisfied; 0 of 12 manual gates
  attested.
- No production outbound messages have been sent.

## Phase 0 — Establish trustworthy production data

- [ ] Add an explicit classification to sales records: `production`, `test`,
  `certification`, or `research_seed`.
- [ ] Make Sales Office pipeline totals, readiness checks, scoring, tasks,
  reports, and attribution exclude non-production records by default.
- [ ] Prevent test/certification/research records from being promoted to
  business-qualified status by ordinary scoring automation.
- [ ] Add a visible “Test/Research” badge and a separate filter for operators who
  need to inspect non-production evidence.
- [ ] Decide whether to archive or permanently purge the current seed dataset.
  No bulk deletion is authorized by this checklist.
- [ ] Reconcile the production-only August 23/24 migrations back into source
  control before making another database change.

## Phase 1 — Finish launch certification without circular gates

- [ ] Complete the remaining automated `authenticated_email_delivery` check.
- [ ] Attest Sales Office access and review the current security advisors.
- [ ] Verify Safari form submission and Turnstile success/rejection behavior.
- [ ] Verify authenticated mailbox receipt and real inbox placement using
  Teamtastic-owned test mailboxes.
- [ ] Verify Calendar and Zoom using an explicitly synthetic certification
  booking with external artifacts cleaned up afterward.
- [ ] Replace “real lead-to-client journey” and “real client portal access” as
  pre-launch blockers with controlled synthetic certification evidence. A true
  customer journey is impossible before the first real customer and must be a
  post-launch observation milestone, not a circular activation requirement.
- [ ] Record the operational owner and final named sign-off.
- [ ] Confirm Launch Control becomes green and historical watchlist alerts close.

## Phase 2 — Prepare the first real outbound pilot from a clean slate

- [ ] Do not approve or send the four existing July drafts.
- [ ] Define the first-campaign ICP and exclusion rules before collecting new
  contacts: industry, company size, geography, role, event need, and prohibited
  segments.
- [ ] Create a fresh, separately labeled production campaign and source a small
  candidate set after the classification controls are live.
- [ ] Require evidence for each candidate: why the company fits, why the role is
  relevant, the timely signal, source URL/date, and email verification status.
- [ ] Generate fresh grounded drafts; human-review every claim, subject, recipient,
  and call to action.
- [ ] Confirm suppression, stop-on-reply, sending windows, weekday caps, bounce,
  complaint, and emergency-pause behavior.
- [ ] Start with no more than five human-approved messages per weekday.

## Phase 3 — Define what creates a real lead

A sourced cold contact is a `production prospect`, not a lead. It becomes a
real lead only through a verified inbound form, meaningful reply, meeting, or
other recorded expression of interest.

- [ ] Require provenance and engagement evidence before changing a prospect to
  `qualified`.
- [ ] Create an owned next action only after a real engagement signal exists.
- [ ] Convert to a deal only when there is a genuine opportunity with an owner,
  stage, value hypothesis, and due date.
- [ ] Measure the first real journey as a post-launch milestone: reply → meeting
  → proposal → deposit → event → repeat/referral.

## Phase 4 — Scale AI only from real outcomes

- [ ] Use replies, meetings, proposals, deposits, losses, unsubscribes, bounces,
  and complaints to calibrate scoring.
- [ ] Add grounded LLM research summaries and copy variants behind human
  approval; do not allow unsupported claims.
- [ ] Supplement GDELT with resilient providers and source citations.
- [ ] Keep Reddit collection off until written commercial permission is recorded.
- [ ] Increase volume only when deliverability and commercial outcomes justify it.

## Remaining non-pipeline work

- [ ] Publish approved Privacy Policy and Terms routes and connect footer links.
- [ ] Replace or remove social icons that still link to `#`.
- [ ] Finish the shared Supabase security-warning disposition.
- [ ] Maintain a clean, committed repository baseline matching production.

Do not bypass Launch Control. More importantly, do not use database labels alone
to represent synthetic or research contacts as real leads.
