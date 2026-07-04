# 02 — Game Catalog (Types of Games & Game Flow)

## Data source

[src/lib/gamesData.json](../../src/lib/gamesData.json) — a 51-entry array, the single source of truth for the catalog page, the 51 SSG detail pages, and `generateStaticParams`. Schema per game:

```
id / slug / title / tagline / description
category      one of: high-energy | competitive | creative | collaborative | chill
heroColor     hex, used for detail-page glow
players       display string, e.g. "8 - 200+"
time          display string, e.g. "60 min"
vibe / skill / badge
includes[]    3 bullet features        ← NOT rendered anywhere (see gaps)
howToPlay[]   3 {step,title,desc} steps
testimonials[] {quote,name,role}       ← NOT rendered anywhere (see gaps)
faqs[]        {q,a}                    ← NOT rendered anywhere (see gaps)
isOriginal    boolean                  ← NOT rendered anywhere (see gaps)
```

## Game types

Category distribution: **chill 14 · creative 12 · competitive 10 · collaborative 10 · high-energy 5**.

Two provenance tiers exist in the data:

| Tier | Count | Traits |
|---|---|---|
| **Original flagship games** (`isOriginal: true`) | 6 | Lightning Feud, Survey Showdown, Pitch Perfect, The Spotlight, Online Office Games, Tiny Campfire. Hand-written copy, distinct player ranges (8–300+), 60–75 min, unique testimonials/FAQs. |
| **Imported arcade modules** (`isOriginal: false`) | 45 | Scraped/converted from the teamtastic.games engine (via the root-level `extract_*/combine_games` scripts). **All 45 share identical boilerplate**: players `4 - 250+`, time `15 - 45 min`, and `howToPlay` steps whose `desc` merely repeats the `title`. |

### Representative game flows (as documented in `howToPlay`)

- **High-energy / competitive (e.g. Lightning Feud, Survey Showdown):** pick teams & buzz in → reveal top survey answers (strikes/steals) → crown champions. Buzzer + leaderboard + confetti mechanics; MC-paced.
- **Creative (e.g. Pitch Perfect, What The Meme, Wrong Answers Only):** receive a creative prompt → submit entries → live group voting → winner celebration. Submission + vote loop.
- **Collaborative (e.g. Mystery Box, Puzzle Dash, Mystery Mosaic):** split into rooms/teams → solve clue chains or co-op puzzles against a clock → collective reveal. Cooperative logic loop.
- **Chill / social (e.g. Tiny Campfire, Name That Tune, Superlatives):** low-stakes prompts, audio rounds, or story sharing → light scoring → conversation-driven wrap-up.

These flows are *marketing descriptions* — the actual game logic runs on teamtastic.games. The handoff is the URL contract below.

## The teamtastic.games URL contract (implicit API)

The storefront deep-links into the game engine with query parameters that are **conventions, not a validated contract**:

| Origin | Link shape |
|---|---|
| Game detail CTA | `https://teamtastic.games?launch=<slug>` |
| Quiz free-sandbox CTA | `https://teamtastic.games?vibe=&size=&occasion=&recommendation=&submission_id=` |
| Pricing free tier / SoloDemo success | `https://teamtastic.games` (bare) |

There is no shared schema, type definition, or test asserting the engine understands `launch=<slug>` for all 51 slugs, or the quiz params. If the engine renames a slug, the storefront silently deep-links to nothing. **Gap: document/freeze this contract (even a shared JSON of accepted params) between the two repos.**

## Surfaces

### Catalog page — [games/page.js](../../src/app/games/page.js)
Client component: category tab filter + text search (title/tagline/vibe) + random-game spotlight. Straightforward and works. Issues:
- Hard-coded stat chip "51 Custom Modules" will silently lie when the JSON changes; derive from `gamesData.length` (which is already used two lines above for tab counts).
- Search is O(n) per keystroke over 51 items — fine at this scale; no action needed.
- Header metadata via `useEffect` — SEO issue covered in doc 01.

### Detail page — [games/[slug]/page.js](../../src/app/games/[slug]/page.js)
Server component, SSG. Renders badge, title, tagline, description, 4 metric tiles, two CTAs, and the 3 `howToPlay` steps. Right column is an explicitly "Simulated Lobby Stage" placeholder (bouncing icon), not a screenshot.

## Gaps & per-flow issues

1. **Half the schema is dead weight.** `includes`, `testimonials`, `faqs`, `isOriginal` are populated for all 51 games but rendered nowhere. Either render them on the detail page (testimonials + FAQs are high-conversion content and FAQs could emit `FAQPage` structured data) or strip them from the JSON. This looks like an unfinished detail-page build-out.
2. **45 imported games have placeholder-quality data.** Identical player counts/durations and `howToPlay` descs that duplicate their titles make 45 of the 51 detail pages read as thin/near-duplicate content — an SEO liability layered on top of the missing per-page metadata (doc 01). The catalog page masks this; the detail pages expose it.
3. **Untracked conversion path.** The detail page's primary CTA ("Launch Free Game Lobby") has **no analytics event**, while the equivalent quiz CTA fires `free_game_clicked`. Per-game conversion — arguably the most interesting product signal in the catalog ("which game pages actually drive lobby launches?") — is invisible. Note this is a server component; the CTA needs a small client wrapper to `track()`.
4. **Recommendation titles don't match the catalog.** The quiz recommendation engine ([recommendations.js](../../src/lib/recommendations.js)) recommends "What the Meme" (catalog: "What The Meme"), "Sound Bite Trivia", "Tell a Fun Fact", "Boss Raid Escape", "Canvas Co-op", "Quick Buzz", "Standup Trivia" — **6 of the 8 recommended game names don't exist in the 51-game catalog** (and none link to a `/games/[slug]` page). The concierge modal's separate recommendation list ("Signature Trivia Jam", "Game Show Challenge", "Music Bingo Mania"…) is likewise mostly uncatalogued. Customers get recommended games they can't look up on the site.
5. **Two independent recommendation engines.** `src/lib/recommendations.js` (enum-keyed, shared with the server) vs `TalkToMichaelModal.getRecommendations()` (free-string matching, ~100 lines inline in the component, with a separate family variant). Same concept, two divergent implementations and two divergent catalogs of made-up titles. Consolidate to one module keyed to real `gamesData` entries.
6. **Category fallback hides data errors.** Catalog card styling falls back to `categoryStyles["chill"]` for unknown categories — a typo'd category in the JSON would render silently instead of failing at build. Minor, but a build-time validation of the JSON (categories, unique slugs, sitemap sync) would catch #4's class of drift too.
