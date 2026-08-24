# Teamtastic Documentation Index

Welcome to the central documentation repository for the Teamtastic storefront and sales engine. This directory is organized to facilitate project planning, status tracking, technical architecture audits, and AI agent alignment.

## Directory Structure

The documentation is divided into five logical sections:

```
docs/
├── planning/       # Business & marketing operations, ad campaigns, and strategy
├── technical/      # Architecture overview, code design, and subsystem detail maps
├── tracking/       # Testing reports, event metrics, and code review histories
├── governance/     # Repository guidelines, coding standards, and AI agent rules
└── archive/        # Deprecated or historical plans kept for audit purposes
```

---

## Document Registry

| Section | Document | Purpose & Scope | Status |
| :--- | :--- | :--- | :--- |
| **Planning** | [GROWTH_ENGINE_PLAN.md](planning/GROWTH_ENGINE_PLAN.md) | Business growth strategies and conversion optimization plans. | Active |
| | [website_strategy.md](planning/website_strategy.md) | Initial website positioning and feature roadmap. | Active |
| | [LEAD_FUNNEL_OPERATIONS.md](planning/LEAD_FUNNEL_OPERATIONS.md) | Lead capture flow configurations, secrets, and manual checks. | Active |
| | [ORGANIC_INTENT_RADAR_OPERATIONS.md](planning/ORGANIC_INTENT_RADAR_OPERATIONS.md) | Search intent optimization and marketing radar strategy. | Active |
| | [AD_CREATIVE_WEEK3.md](planning/AD_CREATIVE_WEEK3.md) | Marketing ad creative review and outreach copy. | Active |
| | [TEAMTASTIC_OUTREACH_VOICE.md](planning/TEAMTASTIC_OUTREACH_VOICE.md) | Cold outreach messaging standards and voice guidelines. | Active |
| **Technical** | [ARCHITECTURE.md](technical/ARCHITECTURE.md) | Repository-wide engineering conventions and runtime boundaries. | Active |
| | [design.md](technical/design.md) | Storefront system design and user experience specification. | Active |
| | [00-Overview-v3.md](technical/architecture/00-Overview-v3.md) | **Core Subsystems Overview** - Storefront vs. CRM & Outbound Sales Engine. | Active |
| | [01-Marketing-Site.md](technical/architecture/01-Marketing-Site.md) | Next.js routes, layouts, and public page configurations. | Active |
| | [02-Game-Catalog.md](technical/architecture/02-Game-Catalog.md) | Structured game data, catalog pages, and recommendation logic. | Active |
| | [03-Lead-Funnel.md](technical/architecture/03-Lead-Funnel.md) | Quiz, demo, concierge lead capture flows and rate-limiting. | Active |
| | [04-Backend-Services.md](technical/architecture/04-Backend-Services.md) | Supabase schemas, triggers, and Resend edge function details. | Active |
| | [05-Analytics.md](technical/architecture/05-Analytics.md) | PostHog setup, event taxonomy, and GDPR analytics compliance. | Active |
| | [06-Payments-and-Booking.md](technical/architecture/06-Payments-and-Booking.md) | Stripe payment integration config (superseded by native booking). | Historical |
| | [11-Booking-System.md](technical/architecture/11-Booking-System.md) | Native event booking holding/rescheduling slots with Google/Zoom. | Active |
| | [12-Private-Sales-Office.md](technical/architecture/12-Private-Sales-Office.md) | Internal sales CRM (/office) authentication, deals, and proposals. | Active |
| | [13-Outbound-Automation-Pipeline.md](technical/architecture/13-Outbound-Automation-Pipeline.md) | Apollo prospecting, scraping, scoring, and cold outreach pipelines. | Active |
| | [14-Lifecycle-Emails-and-Deliverability.md](technical/architecture/14-Lifecycle-Emails-and-Deliverability.md) | Nurture drips, email delivery caps, Resend webhooks, and safety nets. | Active |
| | [15-Database-Schema-Map.md](technical/architecture/15-Database-Schema-Map.md) | Detailed schema maps, orphaned tables, and `system_config` flags. | Active |
| | [16-Payments-and-Stripe.md](technical/architecture/16-Payments-and-Stripe.md) | Flat Stripe deposit link validation and payment mismatch details. | Active |
| | [17-Analytics-and-Consent.md](technical/architecture/17-Analytics-and-Consent.md) | PostHog reverse-proxy setups and client-side cookie permissions. | Active |
| | [18-Security-Auth-and-Rate-Limiting.md](technical/architecture/18-Security-Auth-and-Rate-Limiting.md) | Turnstile defense, booking capability tokens, and CRM route security. | Active |
| | [19-Gaps-Unfinished-Wiring-and-Standards.md](technical/architecture/19-Gaps-Unfinished-Wiring-and-Coding-Standards.md) | Ranked gap analysis across all storefront and CRM components. | Active |
| | [20-Remaining-Work-Implementation-Plan.md](technical/architecture/20-Remaining-Work-Implementation-Plan.md) | Target action plan for remaining open engineering issues. | Active |
| | [21-Teamtastic-Games-Handoff.md](technical/architecture/21-Teamtastic-Games-Handoff.md) | Product handoff and external `teamtastic.games` interaction rules. | Active |
| | [22-Website-and-Sales-Engine-Architecture-Assessment-v6.md](technical/architecture/22-Website-and-Sales-Engine-Architecture-Assessment-v6.md) | V6 launch assessment, ratings, blockers, AI lead-generation coverage, roadmap, and complete open-task ledger. | Active |
| | [23-Website-and-Sales-Engine-Reassessment-v6.1.md](technical/architecture/23-Website-and-Sales-Engine-Reassessment-v6.1.md) | August 24 V6.1 production reassessment, completed work, remaining blockers, human approvals, and activation status. | Active |
| **Tracking** | [TEST_COVERAGE.md](tracking/TEST_COVERAGE.md) | Unit test metrics, test runners, and script execution paths. | Active |
| | [posthog-setup-report.md](tracking/posthog-setup-report.md) | Funnel tracking stats and analytics board link references. | Active |
| | [CODE_REVIEW_PLAN_V2.md](tracking/reviews/CODE_REVIEW_PLAN_V2.md) | Current code review structure and audit standards. | Active |
| | [CODE_REVIEW_PROMPT.md](tracking/reviews/CODE_REVIEW_PROMPT.md) | Standardized instruction prompt template for performing reviews. | Active |
| **Governance**| [AGENTS.md](governance/AGENTS.md) | **Master Governance Policy** for AI code contributions. | Active |
| | [claude.md](governance/claude.md) | Claude-specific developer rules, coding standards, and tooling. | Active |
| | [gemini.md](governance/gemini.md) | Gemini-specific execution tips, subagents, and schedule tools. | Active |
| **Archive** | [00-Overview.md](archive/00-Overview.md) | Outdated high-level storefront summary. | Superseded |
| | [07-Gaps-and-Unfinished-Wiring.md](archive/07-Gaps-and-Unfinished-Wiring.md) | Legacy gap analysis prior to outbound CRM buildout. | Superseded |
| | [08-Modernization-Design.md](archive/08-Modernization-Design.md) | Historical storefront design modernization roadmap. | Superseded |
| | [09-Modernization-Implementation-Plan.md](archive/09-Modernization-Implementation-Plan.md) | Original release gates and storefront phase plan. | Superseded |
| | [CODE_REVIEW_PLAN.md](archive/CODE_REVIEW_PLAN.md) | Older code review framework before V2 upgrade. | Superseded |

---

## Maintenance Guidelines

- **Always Update**: If a code change modifies database schemas, route configurations, API behaviors, or environment variables, the corresponding document **must** be updated immediately.
- **Archive Wisely**: Do not delete old documentation if it has historical reference value. Instead, move it to `docs/archive/` and update its status in this README registry to `Superseded`.
- **Register New Files**: When adding a new documentation file, add a corresponding entry to this registry table.
