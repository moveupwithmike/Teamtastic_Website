# 20 — Launch Readiness and Remaining Work

Updated August 23, 2026. This is the active implementation and operations list
for enabling the Teamtastic sales engine.

## Engineering status

The original nine-item engineering plan is complete:

- Office magic-link sends are transactionally claimed.
- Missing sequence steps stop visibly and appear in the daily report.
- Lead capture uses the shared rate-limit, Turnstile, and validation modules.
- `lead_captured` is client-authoritative; the server records `lead_persisted`.
- PostHog waits for effective consent and uses a non-PII lead identifier.
- Deal history and proposal template metadata appear in the prospect timeline.
- The game handoff is centralized, tested, and documented in architecture doc 21.
- Production Resend webhook events are being stored.
- Stripe uses dynamic Checkout Sessions with signature verification and
  idempotent payment reconciliation.

The local August 23 hardening migration is ready but not deployed. Once deployed,
it will make Launch Control block on unresolved high/critical incidents, overdue
urgent/high tasks, and incomplete final production certification. It also makes
a later successful automation run resolve the matching stale incident and its
generated task.

## Required before outbound activation

1. Deploy and verify the August 23 readiness migration and matching Sales Office
   activation controls. Until then, the currently deployed readiness evaluator
   can report green without the complete gate set.
2. Finish the final production certification:
   - verify the real lead forms in Safari and Firefox;
   - verify authenticated delivery and inbox placement in real mailboxes;
   - record both attestations and sign off in `/office/final-certification`.
3. Triage the Sales Office backlog. Production currently contains old synthetic
   certification tasks, older imported-lead tasks, and operational tasks. Close
   test residue only after confirming it is synthetic; review real leads before
   changing their status.
4. Resolve or monitor the GDELT signal-collector incident. GDELT's free endpoint
   intermittently times out and returns HTTP 429. Apollo discovery/enrichment
   and deterministic scoring continue independently, and sending remains off.
5. Decide whether to proceed with Reddit commercial API access. Organic Intent
   Radar must remain disabled until written commercial permission and any
   required contract are confirmed.
6. Replace the footer's nonfunctional Privacy Policy, Terms of Service, and
   social controls with approved destinations before paid traffic is scaled.

## Recommended controlled launch

Use the existing staged workflow:

1. Keep the inbound pilot running while the manual gates above are cleared.
2. Enable the human-approved proposal pilot.
3. Observe delivery, replies, Stripe reconciliation, and incident state.
4. Enable outbound at five messages per weekday, then increase only after clean
   inbox-placement, reply-quality, complaint, and bounce evidence.

Do not bypass Launch Control. The readiness snapshot, final certification,
incident queue, and overdue priority-task count are the source of truth.
