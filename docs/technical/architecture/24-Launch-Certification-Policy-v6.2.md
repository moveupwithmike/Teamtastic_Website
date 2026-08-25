# 24 — Launch Certification Policy V6.2 (Circular-Dependency Correction)

**Status:** Deployed policy. **Date:** August 25, 2026. **Supersedes:** the journey-gate
semantics of `23-Website-and-Sales-Engine-Reassessment-v6.1.md` (§5/§7). Migration:
`supabase/migrations/20260825120000_launch_certification_policy_v62.sql`.

## Problem being corrected

V6.1 required a genuine post-certification real customer journey (`real_lead_client_journey`
+ `client_portal_access` gates, both bound to a live production lineage) BEFORE controlled
outbound could begin — but a new sales motion may need controlled prospecting to obtain that
first customer. That is a circular launch dependency.

## Corrected policy

| Phase | What it is | Gate |
|---|---|---|
| PRE-LAUNCH | 13 automated + 9 manual operational gates + named atomic sign-off | All technical/operational controls that can truthfully be demonstrated without a real customer |
| Phase A `inbound_pilot` | Gmail ingestion + reporting | readiness green |
| Phase B `proposal_pilot` | human-approved proposals to existing opportunities | readiness green |
| Phase C `live` — CONTROLLED OUTBOUND PILOT | max **5** individually approved messages/weekday | readiness green (**includes final certification passed**) |
| Phase D — milestone observed | first real customer journey validated automatically | POST-LAUNCH milestone, never a pre-launch blocker |
| Phase E `controlled_scale` | cap authority up to 10 | **requires validated `first_real_customer_journey_validation` milestone** |

Nothing in the technical safety inventory was weakened: canonical classification,
synthetic/test suppression, fail-closed delivery authority, portal-lineage discipline,
evidence provenance/integrity, sign-off concurrency locks, immutable signed-off snapshots,
sending caps, human approval, and every kill switch remain authoritative.

## Canonical business-data classes

`production_record_classifications.classification ∈ {production, test_qa, certification,
research_seed, unresolved}` (check constraint widened; terminology otherwise unchanged).

- **production** — genuine business/customer record with verified commercial relevance.
- **research_seed** *(new)* — discovered company/contact that MAY suit prospecting but has
  shown NO verified interest (Apollo discovery, researched account, intent candidate).
  Never a lead. Never pipeline. Never a blocker until trusted promotion.
- **test_qa / certification / unresolved** — unchanged semantics (unresolved fails closed).

### research_seed exclusion semantics

`automation.record_affects_production_readiness` excludes records classified research_seed
AND their subtree (deals/tasks/leads/bookings/clients descending from a seed prospect) until
promotion. Research seeds therefore contribute nothing to launch blockers, deal-action
checks, or overdue-task counts. The production-only views (`production_leads`,
`production_deals`, `production_pipeline_summary`, …) exclude them automatically because
they require explicit production classification. Delivery authority already fails closed on
any non-production prospect (`automation.lead_notifications_blocked`).

New Apollo enrichments are stamped `research_seed` at creation by
`process-apollo-enrichment`.

## Canonical sales lifecycle

`research_seed → approved_prospect → contacted_prospect → engaged_prospect → lead →
opportunity → client`

Reference: `automation.sales_lifecycle_reference()`; derivation from existing domain
model: `automation.derive_sales_lifecycle_stage(prospect_id)`.

Rules: Apollo discovery alone ≠ lead. Outbound contact alone ≠ lead. Lead requires verified
interest + production classification. Opportunity requires an open/won production deal.
Client requires an actual client record.

Trusted promotion is the ONLY path out of seed status:
`automation.promote_research_seed_to_production(prospect_id, named_actor, reason>=20chars,
evidence)` → writes an immutable ledger row; caller input can never spoof classification
anywhere because every consumer reads the ledger/status view exclusively.

## Certification changes

- `final_certification_gate_requirements()` now has **23 gates**: the two journey gates were
  removed; everything else (including Safari, Turnstile×2, mailbox receipt, inbox placement,
  Calendar/Zoom, security review, owner attestation) is unchanged. `calendar_zoom_workflow`
  no longer depends on live customer lineage (it was part of the circularity); it remains a
  named-operator manual gate in production environment.
- `sign_off_final_production_certification` keeps its advisory-lock serialization, named-actor
  rule, fail-closed validation, and immutable `signed_off_state` snapshot — minus the circular
  journey prerequisite. Snapshots record `policy_version='v6.2-pre-launch'` plus the exact
  post-launch milestone state at signing.
- Historical evidence rows for the removed gates remain frozen for audit.

## Post-launch milestone subsystem

- `public.launch_phase_milestones` — append-only, immutable (trigger-guarded), service-role
  read-only. Rows exist only for ACHIEVED milestones with full lineage snapshots.
- `automation.first_production_customer_journey()` — canonical FIRST genuine production
  journey: production-classified non-synthetic lead → commercial progression (inbound reply /
  confirmed booking / open-won deal) → client → contact → SENT portal invitation ACCEPTED
  (`client_contacts.accepted_at` is the sole acceptance authority). Excludes test_qa,
  certification, research_seed, unresolved, synthetic.
- `automation.observe_post_launch_milestones()` — idempotent detector; cron
  `launch-phase-milestone-monitor` every 15 min (active; read-only observer).
- `public.launch_phase_milestone_state` — Launch Control view. Satisfaction follows CURRENT
  world state: an achieved-but-invalidated chain stops reporting `validated` and shows
  `invalidated`, while history is retained.
- Milestones NEVER present as pre-launch failures; they gate only CONTROLLED SCALE via
  current-world-validated state.

## Drafts

- `retired` is terminal: trigger blocks any transition out of retired; send worker only ever
  selects `approved`. History preserved; nothing deleted.
- Approval now additionally requires a production-classified prospect and complete approval
  metadata (pre-existing DB check).
- Send path defense-in-depth: `send-approved-outreach` skips (and logs) any draft whose
  prospect is not explicitly production-classified.
- The four July drafts (one per qualified Apollo discovery) were retired with audit entries;
  the pilot starts from fresh research.

## Data reclassification performed by the migration (evidence preserved)

- Four Apollo discoveries (Sparkle Wimberly / Center on Rural Innovation, Charisse Sarsano /
  Sticky.io, Natalie Anderson / Flowspace, Elaine Meru / Umpisa Inc) → `research_seed`
  (verified zero interest signals at execution time; re-check guarded).
- Legacy QA artifacts explicitly `test_qa`: the "Teamtastic Production QA" chain
  (own-domain contact, "QA Smoke Test" deal) and the orphaned "Acme Corp" placeholder client
  row — preventing false real-business metrics and a false milestone auto-validation.

## Regression coverage

Harness `supabase/tests/run_manual_certification_tests.sh` (dockerized, production-dump
based): `manual_certification_operator_controls.sql` (64 assertions incl. journey-free
sign-off, milestone invalidation/promotion, immutability, races), `classification_aware_
launch_readiness.sql` (20 assertions incl. seed subtree/promotion/spoof-proofing),
`launch_phase_policy.sql` (19 assertions: outbound gated on pre-launch cert, pilot without
journey, cap clamped to 5, scale gated on validated milestone, retired-draft terminality,
kill-switch authority), plus three two-session concurrency races.
