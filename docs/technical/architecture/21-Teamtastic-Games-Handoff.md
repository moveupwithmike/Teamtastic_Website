# Teamtastic Games handoff contract

The marketing website opens `https://teamtastic.games` with one canonical query
shape. Producers must use `src/lib/game-handoff.js` rather than constructing the
URL directly.

| Parameter | Required | Meaning |
| --- | --- | --- |
| `vibe` | Yes, may be empty | Requested play style, such as `social` or `competitive`. |
| `size` | Yes, may be empty | Human-readable group-size bucket, such as `15-50`. |
| `occasion` | Yes, may be empty | Event context, such as `team-building`. |
| `recommendation` | Yes, may be empty | Website recommendation key or producer identifier. |
| `submission_id` | Yes | Non-PII UUID connecting the handoff to the persisted lead. |

The receiving application should ignore unknown parameters, tolerate empty
optional values, and must not treat any query value as trusted HTML or an
authorization credential.

**Unverified:** the `teamtastic.games` codebase is a separate repository not
accessible from here. Whether it has a corresponding reader for these
parameters, and where such a reader would live, has not been confirmed —
don't assume a specific file path on that side until someone with access to
that repo checks it.

Current producers:

- Event Quiz: recommendation and form inputs.
- Solo Demo: `social`, `15-50`, `team-building`, and `playable_demo`.

Cross-repository verification:

1. Open a URL produced by each flow.
2. Confirm Teamtastic Games loads without an error.
3. Confirm it reads or safely ignores all five parameters.
4. Confirm both repositories continue to link their matching contract documents.
