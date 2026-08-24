# 01 — Marketing Site (Pages, Routing, SEO)

## Route inventory

| Route | Rendering | Purpose |
|---|---|---|
| `/` | Static | Home: Hero → value props → SoloDemo → GameQuiz → Pricing sections ([page.js](../../../src/app/page.js)) |
| `/games` | Static (client component) | Filterable 51-game catalog |
| `/games/[slug]` | SSG ×51 | Per-game detail (`generateStaticParams` from `gamesData.json`) |
| `/activities` | Static | **Alias**: re-exports the `/games` page component |
| `/pricing` | Static | Tier cards + interactive per-person estimator ([Pricing.js](../../../src/components/Pricing.js)) |
| `/team-experiences` | Static | Experience showcase, uses CTA banner + concierge modal |
| `/virtual-team-building` | Static | SEO landing page (priority 0.95 in sitemap) |
| `/virtual-family-game-night` | Static | **Light-theme** B2C page; opens concierge modal with `isFamily` |
| `/why-teamtastic` | Static | Positioning page |
| `/use-cases/[slug]` | SSG ×4 | hr-and-people-ops, remote-engineering-teams, virtual-intern-cohorts, private-vip-socials |
| `/blog` + 4 articles | Static | SEO content |
| `/resources` + faq, how-it-works, event-planning-guide | Static | Support content |
| `/api/leads` | Dynamic | Lead intake (doc 03) |
| `/api/stripe/webhook` | Dynamic (nodejs runtime) | Deposit recording (doc 04) |
| `/sitemap.xml`, `/robots.txt` | Generated | [sitemap.js](../../../src/app/sitemap.js), robots.js |

## Global layout

[layout.js](../../../src/app/layout.js) hard-codes `className="dark"` + `colorScheme: "dark"` on `<html>`; every page inherits zinc-950 background except `virtual-family-game-night`, which restyles itself locally. Shell: `PostHogProvider` (a no-op — see doc 05) → sonner `Toaster` → `Navbar` → page → `Footer`. Site-wide `metadata` (OG/Twitter cards) is defined once here with `metadataBase: https://teamtastic.events`.

## SEO surface — findings

1. **Sitemap contains two 404 URLs.** [sitemap.js](../../../src/app/sitemap.js) lists `/games/meme-battle` and `/games/sound-bite-trivia`; the real slugs are `what-the-meme` and (closest) `name-that-tune`. Neither `meme-battle` nor `sound-bite-trivia` exists in `gamesData.json`, so both sitemap entries 404.
2. **Sitemap omits most of the site.** Only 4 of 51 game pages are listed; `/games` (the index), `/activities`, `/team-experiences`, and `/virtual-family-game-night` are missing entirely. The sitemap is hand-maintained while the routes are data-driven — it should be generated from `gamesData.json` the same way `generateStaticParams` is.
3. **Game detail pages have no per-page metadata.** [games/[slug]/page.js](../../../src/app/games/[slug]/page.js) exports no `generateMetadata`, so all 51 pages share the root title/description. This forfeits the main SEO value of having 51 static pages.
4. **Catalog page sets `document.title` in a `useEffect`** ([games/page.js:56](../../../src/app/games/page.js)) — invisible to crawlers that don't execute JS and a flash-of-wrong-title for users. The page is a client component top-to-bottom; the conventional fix is a server `page.js` exporting `metadata` that renders a client `<CatalogView />`.
5. **`/activities` duplicate content.** [activities/page.js](../../../src/app/activities/page.js) re-exports the `/games` page component — two URLs serving identical content with no `canonical` tag, and importing one route's `page.js` from another is an anti-pattern (page modules are route entry points, not shared components). Either 301-redirect `/activities → /games` in `next.config.mjs` or extract the catalog into `src/components/` and give each route its own metadata + canonical.
6. **OG image is the 700 KB design mockup** (`/teamtastic_website_mockup.png`, declared 1920×1080). Fine functionally; worth replacing with a purpose-made compressed OG image.

## Coding-standards observations (site-wide)

- **ESLint currently fails with ~70 errors** (`react/no-unescaped-entities` across Hero, use-cases, blog; one `react-hooks/set-state-in-effect` in event-planning-guide). `next build` succeeds because builds don't run ESLint — so lint is effectively unenforced. Either fix the errors or codify the rules off; a failing-but-ignored linter is the worst of both.
- **~25 `no-img-element` warnings**: every image on the site uses `<img>` instead of `next/image`, giving up optimization/lazy-loading on an image-heavy marketing site.
- **No tests, no CI, no TypeScript.** There is no test script in `package.json` and nothing under `.github/`. For a lead-gen site the highest-value first test is an integration test around `/api/leads` (validation, idempotency, rate limit) — it's pure logic and easy to harness.
- `package.json` name is still `temp_next_app`.
- `jimp` sits in production `dependencies` but is only used by the root scraping scripts.
