<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of the Teamtastic marketing site with PostHog. The existing `posthog-js` package was already installed; the wizard upgraded the initialization to the Next.js 15.3+ `instrumentation-client.js` pattern (replacing the `PostHogProvider` init approach), added a reverse-proxy rewrite in `next.config.mjs` to route PostHog traffic through `/ingest` (avoiding ad blockers), upgraded the server-side client from raw `fetch` to `posthog-node`, and added five new event-capture call sites across client components and an API route. The consent-management logic (checking `teamtastic_analytics_consent` in localStorage) was preserved in both `instrumentation-client.js` and the `track()` helper.

| Event | Description | File |
|---|---|---|
| `concierge_modal_opened` | User clicks "Talk to Michael" in the main CTA banner | `src/components/CtaBannerWithModal.js` |
| `concierge_modal_opened` | User clicks "Talk to Michael" in the footer CTA banner | `src/components/FooterCtaBanner.js` |
| `pricing_cta_clicked` | User clicks a CTA button on a pricing tier card | `src/components/Pricing.js` |
| `demo_question_answered` | User selects an answer in the playable demo quiz | `src/components/SoloDemo.js` |
| `lead_captured` | Server confirms a new lead saved to the database | `src/app/api/leads/route.js` |

Previously instrumented events (already in place, not duplicated):

| Event | File |
|---|---|
| `quiz_started` | `src/components/GameQuiz.js`, `src/components/SoloDemo.js` |
| `quiz_step_completed` | `src/components/GameQuiz.js` |
| `lead_submit_attempted` | `src/components/GameQuiz.js`, `src/components/SoloDemo.js`, `src/components/TalkToMichaelModal.js` |
| `lead_captured` (client) | `src/components/GameQuiz.js`, `src/components/SoloDemo.js`, `src/components/TalkToMichaelModal.js` |
| `lead_capture_failed` | `src/components/GameQuiz.js`, `src/components/SoloDemo.js`, `src/components/TalkToMichaelModal.js` |
| `deposit_cta_clicked` | `src/components/GameQuiz.js` |
| `free_game_clicked` | `src/components/GameQuiz.js` |
| `deposit_completed` | `src/app/api/stripe/webhook/route.js` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- [Analytics basics (wizard) — Dashboard](https://us.posthog.com/project/496937/dashboard/1797188)
- [Lead Conversion Funnel](https://us.posthog.com/project/496937/insights/NZUZEAtv) — funnel: quiz_started → lead_submit_attempted → lead_captured
- [Lead Captures Over Time](https://us.posthog.com/project/496937/insights/ND8zyXp9) — daily trend of confirmed leads
- [Concierge Modal Opens](https://us.posthog.com/project/496937/insights/Ckjzuv4H) — intent signal for "Talk to Michael"
- [Pricing CTA Clicks by Tier](https://us.posthog.com/project/496937/insights/ABTF2wf8) — which pricing tier drives the most clicks
- [Deposit Completions](https://us.posthog.com/project/496937/insights/vkV8STPA) — Stripe-confirmed revenue events

## Verify before merging

- [ ] Run a full production build (`npm run build`) and fix any lint or type errors introduced by the generated code.
- [ ] Run the test suite — call sites that were rewritten or instrumented may need updated mocks or fixtures.
- [ ] Add `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST` to `.env.example` and any onboarding/bootstrap scripts so collaborators know what to set.
- [ ] Wire source-map upload (`posthog-cli sourcemap` or your bundler's upload step) into CI so production stack traces de-minify in PostHog Error Tracking.

### Agent skill

We've left an agent skill folder in your project at `.claude/skills/integration-nextjs-app-router/`. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
