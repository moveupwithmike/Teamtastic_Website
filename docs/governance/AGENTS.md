# AI Agent Governance & Repository Standards

This document establishes the master governance policy, operational constraints, and best practices for AI agents (and human developers) contributing to the Teamtastic Website codebase. All agents must read and adhere to these guidelines to maintain repository organization, safety, and clean documentation.

---

## 1. System Scope & Runtime Boundaries

The Teamtastic codebase consists of two distinct subsystems sharing one Next.js application and one Supabase project. Developers and agents must respect these language/runtime boundaries:

1. **The Storefront (Public & CRM Frontend)**
   - **Path**: `src/app/`, `src/components/`, `src/lib/`
   - **Language**: **Plain JavaScript** (no TypeScript).
   - **Rule**: Do not convert components to TypeScript or introduce `.ts`/`.tsx` files in the Next.js app unless executing a dedicated, approved migration project with its own test budget.
   - **Framework**: Next.js 16 App Router (React 19, Tailwind CSS v4).

2. **The Sales Engine & CRM Backend**
   - **Path**: `supabase/functions/`
   - **Language**: **TypeScript (Deno runtime)**.
   - **Rule**: All Edge Functions and supabase scripts must use TypeScript and be validated using Deno linting and typechecking.

---

## 2. Behavioral Policies for AI Agents

To avoid codebase drift, security gaps, or messy revisions, all agents must follow these operational rules:

- **Sandbox Execution**: Attempt all commands in **Standard Sandbox Mode** first. Do not request Bypass Sandbox Mode unless a task explicitly requires external network connectivity or local credentials that are sandboxed out.
- **Surgical Code Edits**: Edit files using localized, surgical chunk-replacement tools. Avoid rewriting entire files or classes for minor tweaks, as this consumes tokens and increases merge conflict risk.
- **Maintain Documentation Integrity**: Preserve all existing comments, docstrings, and headers in code files unless the user explicitly asks to refactor them.
- **No Boilerplate Duplication**: Re-use shared modules (such as `src/lib/server/rate-limit.js`, `src/lib/server/supabase-admin.js`, and `supabase/functions/_shared/runtime.ts`) rather than copying logic into new routes or functions.

---

## 3. Document Maintenance Policy

A primary goal of this repository is maintaining accurate, updated documentation. Agents must follow these documentation rules:

1. **Documentation is Code**: Documentation updates are not optional. If your code changes affect any of the following, you **must** update the corresponding `.md` files under `docs/`:
   - Database schema modifications -> Update [docs/technical/architecture/15-Database-Schema-Map.md](../technical/architecture/15-Database-Schema-Map.md)
   - Payment/Stripe integrations -> Update [docs/technical/architecture/16-Payments-and-Stripe.md](../technical/architecture/16-Payments-and-Stripe.md)
   - Native booking or slot holding -> Update [docs/technical/architecture/11-Booking-System.md](../technical/architecture/11-Booking-System.md)
   - Outbound pipelines or cron configs -> Update [docs/technical/architecture/13-Outbound-Automation-Pipeline.md](../technical/architecture/13-Outbound-Automation-Pipeline.md)
   - Security, auth, or Turnstile changes -> Update [docs/technical/architecture/18-Security-Auth-and-Rate-Limiting.md](../technical/architecture/18-Security-Auth-and-Rate-Limiting.md)
2. **Keep Active Directories Clean**: Do not leave older/superseded versions of plans or specifications in the active folders. Move them to `docs/archive/` and update their status in the [Central Document Index](../README.md).
3. **Register New Documents**: If you create a new documentation file, add it to the directory registry in the central [docs/README.md](../README.md).

---

## 4. Key Architectural & Security Rules

All agents must respect the following security boundaries:

- **No Public Supabase Client**: The storefront browser bundle must never contain the Supabase service-role key or route directly to Supabase. All database writes must go through validated Next.js API routes or Edge Functions.
- **Webhook Security**: All Supabase Edge Functions must keep `verify_jwt = false` and verify incoming requests via a custom `x-webhook-secret` header matching the secret stored in Supabase Vault.
- **Turnstile Defense**: All public intake/booking endpoints (e.g. `/api/leads` and `/api/bookings/{confirm,cancel,reschedule}`) must perform Turnstile widget validation on the server.
- **Error Privacy**: Never return detailed Postgres database errors or Stripe API tracebacks to the client. Map all errors to stable, generic error codes and log details to the server logs or `agent_log` table.

---

## 5. Verification Checklist

Before declaring a task complete, agents must verify their changes:

1. **Linting & Typechecking**:
   - Run `npm run lint` to inspect JavaScript storefront formatting.
   - Run `npm run typecheck:edge` to check Deno Edge Function types.
2. **Testing**:
   - Run `npm run test` (runs Vitest unit tests).
   - Run `npm run test:edge` (runs Deno Edge Function tests).
3. **Verification Command**:
   - Run `npm run check` to perform a full system check (lint, typecheck, unit tests, security audit).
