# Office server modules

This directory contains the authenticated server-side actions behind the internal Office UI. Public action imports continue to flow through `src/app/office/actions.js`; business logic belongs in the focused modules below.

| Module | Responsibility |
| --- | --- |
| `authentication.js` | Office magic-link requests and sign-out. |
| `capacity.js` | Event-capacity checks, tentative holds, releases, and host availability settings. |
| `certification.js` | B2B and final-production certification runs, verification, attestations, and sign-off. |
| `configuration.js` | System-wide operating switches, limits, source approvals, and outbound controls. |
| `deliverability.js` | Safety review required before resuming automatically paused outbound email. |
| `distribution.js` | Human review, scheduling, and queue preparation for distribution content. |
| `eddie.js` | Live sales context, conversational answers, signed confirmations, and a closed set of replay-safe owner actions. |
| `growth-actions.js` | Thin Server Action adapters for growth workflows and ROI/score updates. |
| `growth-experiments.js` | Growth brief refresh/review and experiment lifecycle logic. |
| `incidents.js` | Production incident collection, acknowledgement, monitoring, and resolution. |
| `intelligence.js` | Audience-intelligence and daily growth-agenda refreshes. |
| `launch.js` | Guarded B2B launch-state transitions and outbound caps. |
| `organic.js` | Organic opportunity intake, deterministic response drafts, review, and source configuration. |
| `outreach.js` | Human approval or rejection of outbound outreach drafts. |
| `proposals.js` | Proposal creation, payment requests, idempotent delivery, call outcomes, and reconciliation. |
| `relationship-signals.js` | Warm-signal configuration, manual capture, review, and task closure. |
| `sales-response-actions.js` | Thin Server Action adapters for sales-response workflows. |
| `sales-response.js` | Sales-response draft generation, approval, idempotent delivery, and failure handling. |
| `shared.js` | Common input cleaning, money parsing, and attributed Office audit records. |
| `sla.js` | Holiday SLA escalation refresh and manual resolution. |

## Conventions

- Authenticate every exported action with `requireOfficeUser()` before accessing privileged data.
- Keep external sends explicit and idempotent; use the shared email helper rather than rebuilding reserve/send/record flows.
- Coordinate race-sensitive state in Postgres RPCs or constraints, not in application memory.
- Audit material operator decisions and revalidate the affected Office pages.
- Add success, validation, and provider/database-failure tests beside the owning module when behavior changes.
