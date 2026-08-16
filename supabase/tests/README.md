# Edge Function testing

- Put Deno unit tests in `supabase/tests` and name them `<subject>-test.ts`.
- Extract deterministic logic and external-service adapters into `functions/_shared` so tests do not need a running local stack.
- Inject network clients in unit tests; do not contact production services.
- Use `npm run test:edge` for unit tests and `npm run typecheck:edge` for all Edge Function entry points.
- Add local-stack integration tests only for behavior that depends on the gateway, database, auth, or RLS.
