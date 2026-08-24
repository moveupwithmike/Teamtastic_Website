# Claude Developer Agent Guidelines

This document provides specialized guidelines for Claude developer agent instances when modifying code or documentation in this repository.

---

## 1. Development Role & Execution Strategy

When responding to tasks, Claude agents must adopt the following execution strategy:

- **Analyze first**: Use grep or ripgrep search to find files, functions, or database queries relevant to the task before proposing edits.
- **Surgical edits**: Use the file editing tool (`replace_file_content` or equivalent) to replace exact character sequences. Do not rewrite whole functions or files unless a complete refactor is requested.
- **Preserve types/JS boundary**: Respect the plain JS boundary for the Next.js app, and Deno/TS boundary for Supabase Edge Functions. Do not mix files or file extensions (e.g., do not introduce `.ts` files inside Next.js components).

---

## 2. Storefront UI Standards (React 19 & Tailwind v4)

For public storefront code edits, Claude must follow these conventions:

- **Forced Dark Theme**: The application enforces a dark theme globally via `className="dark"` on `<html>` in `src/app/layout.js`. All UI elements must look consistent in dark mode (using `zinc-950` as the standard background).
- **Client vs. Server Components**: Use the `'use client'` directive only when a component uses state (`useState`), effects (`useEffect`), or browser-only APIs. Keep data fetching and static page layouts as React Server Components.
- **Tailwind CSS v4**: The project uses Tailwind CSS v4. Ensure classes are clean, responsive, and avoid deprecated v3 config properties.

---

## 3. CRM & Edge Function Standards (Deno & TypeScript)

For CRM database queries and outbound sales edge functions:

- **Boilerplate Minimization**: Do not duplicate client setups. Share database and Resend initialization blocks using helper modules under `supabase/functions/_shared/`.
- **Database Client Access**: Edge Functions must use the Supabase service-role client to perform administrative transactions.
- **Webhook Authentication**: Ensure `verify_jwt = false` in the Edge Function configuration, and check `x-webhook-secret` headers against Vault secrets.

---

## 4. Verification Workflow

Before completing any task, Claude must execute:
1. `npm run lint` to verify coding styles.
2. `npm run test` to verify Vitest tests run and pass.
3. `npm run typecheck:edge` to verify Edge Function compilation.
4. `npm run check` for a complete pipeline check.
