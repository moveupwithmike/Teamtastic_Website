# Organic Intent Radar operations

## Safety model

- The collector researches only public results returned by an approved Reddit API application.
- It never posts, sends direct messages, or sends email.
- Every generated response enters the private Sales Office review queue.
- Daily limits apply at both the system and source levels.
- Duplicate posts are rejected by a stable provider fingerprint.
- Missing credentials, disabled switches, and exhausted limits produce a skipped run instead of an error.

## Activation checklist

1. Obtain approved Reddit API access for Teamtastic.
2. Add Edge Function secrets: `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, and `ORGANIC_RESEARCH_WEBHOOK_SECRET`.
3. Add Vault secrets named `organic_collector_function_url` and `organic_collector_webhook_secret`. The webhook values must match.
4. In Office Settings, enable research, scoring, and drafting. Leave attribution off until the tracked-link test passes.
5. Confirm the next run shows `completed` or `skipped: daily_cap_reached`, never an authentication failure.
6. Review at least 20 drafts manually before considering broader query coverage.
7. Enable attribution and submit a tracked test lead. Confirm the opportunity becomes `converted`.

## Review standard

- Respond only where a helpful vendor response is permitted.
- Lead with useful planning advice; disclose Teamtastic plainly.
- Do not pretend to be a customer or neutral third party.
- Dismiss posts that are old, personal, irrelevant, procurement-restricted, or explicitly prohibit promotion.
- Do not copy personal details into the CRM beyond the public display name and cited post content.

## Incident response

Turn off **Automated public-source research** in Office Settings. This disables the source immediately; the scheduled function will record a skipped run and make no external API request.
