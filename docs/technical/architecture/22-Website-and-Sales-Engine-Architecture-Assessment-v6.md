# Teamtastic Website and Sales Engine Architecture Assessment — V6

**Assessment baseline:** `a55beeb196ef2f2ae29d6cac0e5b805ab5dcea99`
plus the uncommitted August 23 launch-hardening work described in this report.

**Production snapshot:** August 23, 2026, approximately 3:30 PM America/New_York.

**Scope:** Public website, lead funnels, private Sales Office, native booking,
Stripe payments, lifecycle email, outbound automation, AI-assisted prospecting,
analytics, production Supabase state, operating controls, and launch evidence.
The game application itself is out of scope except where it shares the same
Supabase project and therefore creates security or operational blast radius.

## 1. Executive Summary

Teamtastic has a capable, unusually complete small-business revenue platform.
The public site has broad search coverage, several lead-capture paths, native
booking, safe Stripe Checkout, lifecycle email, a private CRM, Apollo discovery
and enrichment, public-signal collection, scoring, human-approved outreach,
reply ingestion, delivery controls, incident monitoring, and staged activation.
The implementation is much stronger than a typical marketing website.

The system is **not yet cleared for outbound activation**. The reason is not a
missing core sales engine; it is incomplete operational closure. Production has
31 overdue open tasks, one open high-severity GDELT research incident, and a
final production certification that has been running since August 9 without
cross-browser form evidence, authenticated inbox-placement evidence, a real
lead-to-client portal journey, attestations, or final sign-off. The currently
deployed readiness evaluator still reports `ready` because it does not include
all of those gates.

The local August 23 hardening work corrects the readiness logic and Sales Office
activation controls, but **it has not been deployed to the shared production
database or website**. Until it is deployed and the manual gates are cleared,
the green readiness snapshot must not be treated as authorization to turn on
outbound sends.

### Ratings

| Dimension | V6 rating | Assessment |
| --- | ---: | --- |
| Architecture | 8/10 | Clear storefront, API, Edge Function, database, and third-party boundaries |
| Conversion foundation | 8/10 | Strong content and funnels; legal/social trust controls remain unfinished |
| Sales automation | 8/10 | Broad end-to-end engine with safe human approval and staged controls |
| AI lead-generation utilization | 6/10 | Good discovery/scoring automation; research is fragile and drafting is deterministic rather than LLM-personalized |
| Payments and booking | 9/10 | Modern Stripe Checkout, signed webhooks, idempotency, native booking, reminders, and reconciliation |
| Security and privacy | 6/10 | Strong application controls, but shared-project Supabase advisor debt needs explicit disposition |
| Observability and operations | 7/10 | Incidents, reports, logs, caps, cron, and rollback exist; stale tasks and a false-green readiness result reduce confidence |
| Test and release confidence | 8/10 | 240 local tests, 16 Edge tests, build, lint, typecheck, and audit pass; manual production certification remains incomplete |

**Overall: 7.5/10. Launch posture: HOLD outbound; continue inbound pilot.**

## 2. Architecture Map

```text
Search / AI discovery / paid traffic / referrals
                     │
                     ▼
Next.js public website
├─ game, use-case, seasonal, comparison, and educational pages
├─ SEO metadata, structured data, sitemap, llms.txt
├─ quiz, concierge, demo, contact, and booking funnels
├─ consent-aware PostHog analytics
└─ Turnstile-protected public intake
                     │
                     ▼
Next.js server routes and Supabase Edge Functions
├─ validation, rate limiting, suppression, and generic error handling
├─ lead persistence and notifications
├─ native booking + Google Calendar + Zoom
├─ Stripe Checkout + signed webhook reconciliation
├─ Resend lifecycle email + delivery webhooks
└─ authenticated Sales Office operations
                     │
                     ▼
Shared Supabase/Postgres production authority
├─ prospects, leads, companies, deals, clients, events, tasks
├─ proposals, payment requests, notification and webhook evidence
├─ RLS, RPCs, scheduled jobs, system configuration, audit log
├─ incidents, launch snapshots, certification, and rollback controls
└─ shared game-app tables/functions in the same project
                     │
       ┌─────────────┼──────────────────┐
       ▼             ▼                  ▼
Apollo discovery   Public signals     Gmail / Resend / Stripe
and enrichment     and intent radar   replies, delivery, payment
       │             │                  │
       └─────────────┴──────────────────┘
                     ▼
Research → enrichment → scoring → draft → human approval
→ sending window/cap/suppression → reply → deal → booking → payment
```

The local repository contains 73 page/API route entrypoints, 14 sales-engine
Edge Function directories, 80 website-owned migrations, and 37 test files. The
shared production project contains 33 active Edge Functions and 302 migrations
because it also hosts the game application.

## 3. Production State at Assessment Time

| Control | Current state | Meaning |
| --- | --- | --- |
| Launch phase | `inbound_pilot` | Correct phase for current evidence |
| Master engine | Enabled | Scheduled evaluation infrastructure can run |
| Inbound auto-reply | Enabled | Existing inbound workflow remains active |
| Prospecting | Disabled | No cold prospecting should send |
| Outbound mode | `off` | Primary outbound safety lock is closed |
| Sequence follow-ups | Disabled | No automated follow-up sends |
| Nurture | Disabled | Lifecycle nurture is not yet active |
| Native booking/email/reminders | Enabled | Booking operations are active |
| Proposal email | Disabled | Proposal pilot is not active |
| Apollo discovery/enrichment | Enabled | Candidate and enrichment work can run without sending |
| Research/scoring/drafting pipeline | Enabled | Internal preparation can run |
| Organic Intent Radar | Disabled | Correctly waiting on Reddit commercial permission |
| Warm relationship signals | Disabled | Not yet part of the active engine |
| Daily prospecting cap | 5 | Appropriate first outbound pilot cap once gates pass |
| Latest readiness snapshot | `ready`, 0 blockers | False-green relative to the complete V6 gate set |
| Final certification | `running` since August 9 | Not signed off; one live journey and two manual evidence items remain |
| Open production tasks | 31, all overdue | Must be triaged before activation |
| Open production incidents | 1 high severity | GDELT research reliability remains unresolved |

## 4. Strengths

### Public website and demand capture

- Broad game, use-case, remote-team, seasonal, comparison, and educational page
  coverage gives Teamtastic many high-intent search entrypoints.
- Sitemap generation, structured data, canonical metadata, and `llms.txt` form a
  strong SEO and generative-engine-discovery foundation.
- Multiple capture experiences serve visitors at different levels of intent
  instead of forcing every visitor into the same contact form.
- PostHog respects effective consent, avoids direct PII identity, and separates
  client capture intent from server-confirmed lead persistence.
- Public submissions use shared validation, rate limiting, Turnstile, and stable
  error responses.

### Revenue and customer operations

- Native booking supports slot holds, confirmation, cancellation, rescheduling,
  reminders, calendar creation, and Zoom integration.
- Stripe uses hosted Checkout Sessions on the current API version, leaves
  payment methods dynamic, verifies webhook signatures, checks amounts, and
  handles duplicate events idempotently.
- Proposal, payment-request, client, event, and deal records form a credible
  lead-to-revenue operating model.
- Resend webhook events, suppression, delivery evidence, mailbox ingestion, and
  reply detection provide the right foundations for responsible email growth.

### Sales engine and AI-ready automation

- Apollo discovery and enrichment, public-signal research, scoring, drafting,
  human approval, sending, reply ingestion, and follow-up drafting are wired as
  a complete pipeline.
- Daily caps, weekday windows, cooldowns, suppression, confidence thresholds,
  and kill switches reduce brand and deliverability risk.
- The engine can research and prepare prospects while outbound sending remains
  off, allowing a safe review-first launch.
- Incident generation, launch phases, readiness snapshots, certification, and
  rollback controls show strong operational thinking.
- Brand templates and deterministic draft rules make the first launch auditable
  and predictable even though they do not yet maximize LLM personalization.

### Engineering evidence

- Lint, typecheck, 37 Vitest files/240 tests, 16 Deno Edge tests, dependency
  audit, and the production build passed during the August 23 review.
- The final build generated 110 routes and the dependency audit reported no
  known vulnerabilities.
- Phase-one production certification passed 12/12 automated checks with
  synthetic leads and without external sends.
- Stripe mismatch checks are clean, core scheduled jobs showed no recent cron
  failures, and the most recent Apollo enrichment run completed successfully.

## 5. Weaknesses and Architectural Debt

1. **Readiness truth is split.** The deployed readiness snapshot is green while
   the final certification, high incident, and overdue priority tasks are not.
   A release control that omits real gates can create more risk than no badge.
2. **The operational queue is not trustworthy yet.** Real work, synthetic
   certification residue, imported QA leads, and incident tasks share one open
   backlog. Operators cannot safely use the count until it is classified.
3. **Public-signal research has a single fragile provider.** GDELT intermittently
   times out and returns HTTP 429. Its incident occurrence counter was also
   inflated by an earlier recount defect, making the raw 579 count unsuitable
   as a direct measure of customer impact.
4. **AI generation is below the stated ambition.** Current outreach drafts are
   deterministic templates, not LLM-generated account research or message
   personalization. This is a safe launch default but not “no stone unturned.”
5. **Organic intent is not active.** The Reddit-based Organic Intent Radar is
   correctly disabled until commercial API permission is documented.
6. **Trust pages are unfinished.** Privacy Policy and Terms labels are plain
   text/non-links, and experience-specific social icons point to `#`.
7. **Cross-browser anti-bot behavior is unproven.** Chromium evidence exists,
   but Safari and Firefox form/Turnstile verification has not been attested.
8. **One production project serves two products.** Website and game migrations,
   functions, policies, and advisors share operational blast radius and require
   explicit ownership, change coordination, and incident routing.
9. **Supabase advisor debt is material.** The review found 133 security warnings
   and 92 performance warnings across the shared project, including executable
   security-definer functions, anonymous-sign-in policy interactions, unindexed
   foreign keys, repeated permissive policies, and RLS initialization patterns.
   Many belong to the game application, but sharing the project makes them a
   website launch concern until individually dispositioned.
10. **Sales data needs closure rules.** Four qualified prospects lacked an open
    follow-up task at review time, and two open deals appeared to lack a raw
    next-action value even though the readiness query reported none missing.
    Query definitions must be reconciled.

## 6. Critical Launch Blockers

No verified data-loss or payment-integrity defect was found. Five release
blockers must be closed before outbound is enabled.

### WSE-V6-B1 — Deploy and verify complete launch gating

**Current state:** Fixed locally, not deployed.

The pending migration makes readiness block on open high/critical incidents,
overdue urgent/high tasks, and incomplete final certification. It also resolves
automation incidents only when a later successful run exists for the same
agent/action. The Sales Office activation page locally prevents proposal and
outbound activation when those preflight conditions fail.

**Done when:** migration and website are deployed; the new evaluation is run;
the Sales Office shows the expected blockers; rollback is documented; and an
attempt to activate outbound while blocked is proven to fail safely.

### WSE-V6-B2 — Complete final production certification

**Current state:** `running`; no attestations or sign-off.

Required evidence:

- successful lead forms and Turnstile behavior in Safari and Firefox;
- authenticated delivery and inbox placement in real mailboxes;
- one real lead-to-client portal journey;
- recorded attestations and named final sign-off.

**Done when:** all checks pass, evidence is attached, certification status is
complete, and the sign-off is visible in Launch Control.

### WSE-V6-B3 — Triage all 31 overdue production tasks

**Current state:** 8 urgent, 9 high, and 14 normal tasks are open and overdue.

Synthetic or QA records must never be blindly closed from title alone. Confirm
their source records first. Real leads, a possible deposit, the Reddit access
request, and incident work require explicit disposition.

**Done when:** every task in Section 11 is marked real, test, duplicate, stale,
or completed; real tasks have a new owner/date/next action; verified residue is
closed with a reason; no overdue urgent/high task remains.

### WSE-V6-B4 — Resolve or deliberately remove GDELT from the launch path

**Current state:** one open high incident; last observed failure August 21;
timeouts and HTTP 429 responses persisted after retry.

**Done when:** either the collector meets an agreed reliability threshold with
bounded retries/backoff and clean incident recovery, or it is disabled and a
documented replacement/fallback is chosen. Apollo must remain independent.

### WSE-V6-B5 — Disposition shared Supabase security warnings

**Current state:** advisor warnings exist across the combined website/game
project. A warning count alone does not prove a vulnerability, but it prevents a
responsible blanket “security is clear” claim.

**Done when:** each security warning class has an owner and one of: fixed,
accepted with rationale and compensating control, or proven unreachable by
public/authenticated roles. Prioritize public `SECURITY DEFINER` execution,
anonymous-user policy behavior, and exposed-schema/RLS access.

## 7. Immediate and Near-Term Work

### Immediate — before any outbound activation

| ID | Action | Owner | Acceptance test |
| --- | --- | --- | --- |
| WSE-V6-I1 | Deploy WSE-V6-B1 hardening | Engineering | Blocked activation cannot be bypassed from the Sales Office |
| WSE-V6-I2 | Finish certification evidence and sign-off | Operations + Engineering | Certification reports complete with named attestations |
| WSE-V6-I3 | Classify and close/re-date all 31 tasks | Operations | Zero overdue urgent/high; every remaining task has a valid next action |
| WSE-V6-I4 | Resolve/disable GDELT collector | Engineering | No open high incident; fallback documented |
| WSE-V6-I5 | Review shared Supabase security warnings | Engineering | Written warning disposition and fixes for exposed high-risk functions/policies |
| WSE-V6-I6 | Verify four qualified prospects have follow-up ownership | Sales | Every qualified prospect has an open task or documented disposition |
| WSE-V6-I7 | Reconcile deal next-action query definitions | Engineering + Sales | Office and readiness counts agree on the same open-deal rule |

### Near term — first 30 days

| ID | Action | Outcome |
| --- | --- | --- |
| WSE-V6-N1 | Publish approved Privacy Policy and Terms routes; replace footer labels with real links | Trust, compliance, and paid-traffic readiness |
| WSE-V6-N2 | Replace `#` social URLs or remove the icons | No dead trust controls |
| WSE-V6-N3 | Launch proposal pilot, then five-per-weekday human-approved outbound | Controlled evidence before scale |
| WSE-V6-N4 | Add provider health scoring and fallback research source | GDELT cannot stall research |
| WSE-V6-N5 | Complete Reddit commercial-access decision | Organic Intent Radar has a lawful go/no-go state |
| WSE-V6-N6 | Add LLM-assisted research summaries and message variants behind human approval | Better personalization without autonomous brand risk |
| WSE-V6-N7 | Create an inbox-placement, bounce, complaint, reply-quality, and meeting dashboard | Scale decisions use real outcomes |
| WSE-V6-N8 | Review unindexed sales foreign keys and repeated RLS policies | Lower latency and clearer authorization behavior |
| WSE-V6-N9 | Verify Stripe uses restricted live keys where feasible, IP restrictions, strong Dashboard 2FA, and a rehearsed key-rotation process | Reduced payment credential blast radius |
| WSE-V6-N10 | Create weekly stale-task and orphaned-qualified-prospect controls | Backlog stays operationally trustworthy |

## 8. Long-Term Work

1. **Multi-source intent intelligence.** Combine Apollo, approved community
   sources, first-party engagement, company news, job changes, event timing, and
   closed-lost reactivation into one evidence-scored opportunity model.
2. **LLM personalization with evaluation.** Generate research summaries,
   hypotheses, subject lines, and message variants with citations to source
   evidence. Retain human approval, deterministic safety rules, suppression,
   caps, and a no-fabrication evaluation set.
3. **Learning loop.** Feed replies, booked meetings, no-shows, proposals,
   deposits, losses, unsubscribes, and complaints back into source and message
   scoring without allowing self-modifying production sends.
4. **Experiment platform.** Version landing-page offers, calls to action,
   qualification questions, email variants, and audience definitions; promote
   only statistically and commercially useful changes.
5. **AI-search visibility.** Monitor whether major answer engines cite
   Teamtastic, refresh factual/comparison pages, publish original team-event
   data, and keep machine-readable content current.
6. **Project boundary decision.** Either separate game and revenue workloads
   into different Supabase projects or formally establish shared-schema owners,
   migration coordination, release windows, advisor SLAs, and cross-product
   incident rules.
7. **Revenue observability.** Establish SLOs and traceable funnel lineage from
   anonymous session through lead, reply, meeting, proposal, deposit, event,
   repeat booking, and referral.
8. **Data lifecycle governance.** Define consent basis, retention, deletion,
   export, enrichment provenance, model-input rules, and vendor access review for
   every lead/prospect source.

## 9. AI Lead-Generation Coverage — No-Stone-Unturned Review

| Capability | Current state | Gap / next move |
| --- | --- | --- |
| Search and AI discoverability | Strong | Measure citations and content freshness, not only page count |
| On-site conversion | Strong | Finish trust/legal links and cross-browser verification |
| Apollo company/contact discovery | Implemented | Monitor data quality, duplicate rate, and unit economics |
| Apollo enrichment | Implemented and recently successful | Track enrichment-to-meeting lift |
| Public news intent | Implemented but unreliable | Replace or supplement GDELT |
| Community intent | Built but disabled | Wait for documented Reddit commercial permission |
| First-party behavioral intent | Partial | Turn consented high-intent visits, quiz answers, and return visits into warm review signals |
| Existing-network/warm signals | Disabled | Design privacy-safe relationship and referral signals |
| Closed-lost reactivation | Data model present | Activate with eligibility, timing, and suppression rules |
| Lead scoring | Implemented | Calibrate against meetings and revenue; explain score evidence |
| Draft generation | Deterministic templates | Add grounded LLM variants behind approval and evaluation |
| Human approval | Strong | Keep mandatory until quality evidence supports narrower automation |
| Sending controls | Strong | Prove deliverability before increasing caps |
| Reply ingestion | Implemented | Add intent classification QA and response-time SLA |
| Follow-up sequences | Implemented but disabled | Enable only after pilot evidence and stop-on-reply verification |
| Booking and payment attribution | Strong foundation | Report source-to-deposit and source-to-repeat-booking ROI |
| Learning/optimization | Early | Build outcome feedback and controlled experiments |

Potential supplemental research providers identified for evaluation—not purchase
or automatic activation—include Exa, You.com, and Tavily. Selection should be
based on commercial-use terms, source traceability, coverage, latency, cost,
privacy, and a Teamtastic-specific benchmark rather than feature claims.

## 10. Launch Sequence and Exit Criteria

### Gate A — inbound pilot (current)

- Keep inbound auto-reply, booking, reminders, and internal notifications active.
- Keep outbound, nurture, sequences, proposal email, organic research, and warm
  signals off unless separately approved by a later gate.
- Close WSE-V6-B1 through B5.

### Gate B — proposal pilot

- Send only human-approved proposals to verified existing opportunities.
- Observe delivery, replies, booking, Stripe reconciliation, and incidents.
- Exit after clean live evidence and no unresolved high/critical incident.

### Gate C — outbound pilot

- Maximum five human-approved messages per weekday.
- Require source evidence, suppression checks, sending windows, stop-on-reply,
  and a visible owner for every positive response.
- Pause automatically on complaint, abnormal bounce, authentication, provider,
  or webhook reconciliation failures.

### Gate D — controlled scale

- Increase volume only from measured positive reply, meeting, deposit, bounce,
  complaint, and unsubscribe evidence.
- Never use volume as the remedy for poor targeting or weak personalization.

## 11. Complete Production Open-Task Ledger

All rows below were `open` and overdue at the assessment snapshot. IDs are
abbreviated for operational matching. “Likely test” is a review hypothesis, not
authorization to close the record without checking its linked source.

### Urgent — 8

| ID | Task | Due (UTC) | Initial classification |
| --- | --- | --- | --- |
| `0c098d2e` | Check prime-time December capacity | Aug 9 16:10 | Likely certification residue; verify source |
| `5f5e30c7` | Check prime-time December capacity | Aug 9 16:10 | Likely certification residue; verify source |
| `4c5e3967` | Check prime-time December capacity | Aug 9 16:10 | Likely certification residue; verify source |
| `0d43f9cc` | Start paid client onboarding: Teamtastic Certification c329621e | Aug 9 16:11 | Likely certification residue; verify payment/client |
| `e4b8a1d1` | Holiday lead: confirm December availability | Aug 9 16:25 | Likely certification residue; verify source |
| `e3ee6f42` | Holiday lead: confirm December availability | Aug 9 16:25 | Likely certification residue; verify source |
| `682215ca` | Holiday lead: confirm December availability | Aug 9 16:25 | Likely certification residue; verify source |
| `6073c2e3` | Deposit paid — immediate response required | Aug 15 18:30 | Revenue-critical until proven test |

### High — 9

| ID | Task | Due (UTC) | Initial classification |
| --- | --- | --- | --- |
| `54ff2201` | Review inbound lead: RASHIDA Glass | Jul 19 20:19 | Potential real lead; manual review required |
| `8090c429` | Review inbound lead: Certification Buyer 2 | Aug 9 16:25 | Likely certification residue; verify source |
| `fb3bb173` | Review inbound lead: Certification Buyer 3 | Aug 9 16:25 | Likely certification residue; verify source |
| `c8de8ae6` | Review inbound lead: Certification Buyer 1 | Aug 9 16:25 | Likely certification residue; verify source |
| `8551413e` | Holiday lead follow-up — day 1 | Aug 10 16:10 | Likely certification residue; verify source |
| `676f8bb2` | Holiday lead follow-up — day 1 | Aug 10 16:10 | Likely certification residue; verify source |
| `541ee889` | Holiday lead follow-up — day 1 | Aug 10 16:10 | Likely certification residue; verify source |
| `978d8851` | Production incident: collect public news signals | Aug 12 12:35 | Real open GDELT incident |
| `e16e47e6` | Production incident: live event clients are not reconnecting | Aug 21 21:25 | Incident appears resolved; task linkage is stale—verify then close |

### Normal — 14

| ID | Task | Due (UTC) | Initial classification |
| --- | --- | --- | --- |
| `96a824f8` | Review existing inbound lead: Dwight Schrute | Jul 18 15:02 | Likely imported QA/test lead |
| `b960b179` | Review existing inbound lead: Dwight Schrute | Jul 18 15:02 | Likely imported QA/test lead |
| `8013c5c1` | Review existing inbound lead: Michael Scott | Jul 18 15:02 | Likely imported QA/test lead |
| `64ce6996` | Review existing inbound lead: Teamtastic Production QA — Event Quiz | Jul 18 15:02 | QA residue |
| `d6c1621a` | Review existing inbound lead: Dwight Schrute | Jul 18 15:02 | Likely imported QA/test lead |
| `fff90b17` | Review existing inbound lead: Pam Beesly | Jul 18 15:02 | Likely imported QA/test lead |
| `acb3114a` | Review existing inbound lead: Teamtastic System Verification | Jul 18 15:02 | QA residue |
| `cdbcceec` | Holiday lead follow-up — day 3 | Aug 12 16:10 | Likely certification residue; verify source |
| `1460551a` | Holiday lead follow-up — day 3 | Aug 12 16:10 | Likely certification residue; verify source |
| `039e7e48` | Holiday lead follow-up — day 3 | Aug 12 16:10 | Likely certification residue; verify source |
| `0facd349` | Holiday lead follow-up — day 7 | Aug 16 16:10 | Likely certification residue; verify source |
| `01259831` | Holiday lead follow-up — day 7 | Aug 16 16:10 | Likely certification residue; verify source |
| `fe1a3489` | Holiday lead follow-up — day 7 | Aug 16 16:10 | Likely certification residue; verify source |
| `362d4141` | Follow up on Reddit commercial API request | Aug 23 14:37 | Real external-dependency decision |

## 12. Definition of Done

The website and sales engine may be represented as launch-ready only when:

- the complete readiness logic is deployed and independently verified;
- final certification is complete and signed;
- no unresolved critical/high incident exists;
- no overdue urgent/high production task exists;
- every real qualified prospect and open deal has a named next action;
- Safari, Firefox, Chromium, Turnstile, and real inbox placement evidence passes;
- approved legal and trust destinations are live;
- Stripe, Resend, Gmail, booking, and analytics reconciliation are healthy;
- shared Supabase security warnings have documented disposition;
- outbound remains human-approved, capped at five per weekday, and reversible;
- stop-on-reply, suppression, bounce, complaint, and kill-switch behavior is
  proven with live-safe evidence;
- one real lead completes the lead → reply/meeting → client portal journey;
- monitoring has a named daily owner during the launch week.

## 13. Assessment Boundary

This report combines repository inspection, local verification, production
read-only queries, live-page inspection, and current operating evidence. It did
not close production tasks, change configuration, send email, purchase data,
deploy the pending migration, or enable the sales engine. Browser evidence from
the in-app environment does not substitute for the missing Safari/Firefox and
real-mailbox attestations.

The production snapshot will change. Section 11 is the authoritative list only
for the timestamp at the top of this report; Launch Control and the production
task/incident tables remain the live source of truth.
