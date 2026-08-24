# Teamtastic engineering conventions

## Runtime language boundary

The runtime split is deliberate:

- The Next.js application remains JavaScript while the existing UI is maintained.
- Supabase Edge Functions and shared automation utilities are TypeScript because
  they integrate multiple external payloads and run without the Next.js build.
- New server-only modules should use TypeScript when introduced in a TypeScript
  area. Existing JavaScript server code must validate untrusted input at runtime
  and keep provider/database details out of browser-visible responses.
- A broad JavaScript-to-TypeScript conversion must be handled as a dedicated
  migration with its own test budget; feature work must not convert isolated
  components merely for appearance.

## Error ownership

- Browser URLs and rendered Office messages contain stable error codes only.
- Full database and provider errors belong in `agent_log`, task records, or
  server logs.
- Edge Functions return stable JSON error codes and write detailed failures to
  their run/audit records.

## Audit ownership

- Office server actions own the audit entry for user-initiated mutations.
- Database RPCs perform the transaction and return structured results; they do
  not duplicate the Office action's audit event.
- Background database triggers and scheduled automation continue to own their
  audit entries because no authenticated server action initiated them.

## Shared utilities

- Edge Functions use `supabase/functions/_shared/runtime.ts` for webhook
  authentication, service-role client construction, error normalization, and
  stable internal-error responses.
- Calendar day boundaries and wall-clock conversion use
  `src/lib/server/booking-time.js`; routes and dashboards must not implement
  timezone offsets independently.
- Outreach cadence and copy timing come from `sequence_steps`, not constants in
  worker source.
