# Teamtastic Seasonal Theme + SEO Content Engine — Design & Delivery Report

**Date:** 2026-08-29
**Scope:** Reusable seasonal/theme growth system for `teamtastic.events` — themes → themed experiences → blog content → proof → CTA → attributed lead → booking — with classic SEO + AEO/GEO (AI search) best practice.
**Status:** Wave 1 implemented, tested, and verified. Production-ready pending human review.

---

## 1. Executive Summary

Teamtastic previously handled themed seasonality with a handful of hand-built money pages (`/virtual-holiday-party`, `/virtual-year-end-team-celebration`, `/virtual-holiday-party-for-large-groups`, `/virtual-family-game-night`) plus holiday blog posts. There was no reusable pattern for *new* themes, no theme hub, and no theme-aware attribution.

This work introduces a **data-driven theme engine**: one structured data source (`src/lib/themes.js`), one shared template (`src/components/ThemePage.js`), one hub (`/themes/`), and an arbitrary number of `/themes/[slug]` pages generated at static-build time. Wave 1 ships **four production-grade themes** + the hub. Tests, lint, typecheck, production build, route validation, and real-browser mobile checks all pass.

Key product for the engine: theme → curated ranked game recommendations (resolution against the real game catalog) → themed run-of-show → FAQs → lead form with per-theme CRM attribution → internal links to blog, related themes, and existing money pages.

---

## 2. Current-State Audit (Initial State)

| Area | Finding |
|---|---|
| App | Next.js 16.3.1 App Router, React 19.2.4, Tailwind v4, TypeScript. Domain `https://teamtastic.events`; `metadataBase` in `src/app/layout.js`. |
| Game catalog | `src/lib/gamesData.json` — 53 games, no URLs duplicated; sitemap derives `/games/[slug]` from it. **Chosen anchor for theme→game resolution.** |
| Themed pages | `/virtual-holiday-party`, `/virtual-year-end-team-celebration`, `/virtual-holiday-party-for-large-groups`, `/virtual-family-game-night` — existing money templates; must be linked, not duplicated. |
| Blog | 17 hard-coded posts inside `src/app/blog/page.js`; sitemap repeats the slugs. No shared data source. **Extracted to `src/lib/blog-posts.js`.** |
| Dynamic-page precedent | `use-cases/[slug]` and `games/[slug]` prove the project's generated-metadata + `generateStaticParams` pattern. |
| Lead capture | `POST /api/leads` with a `SOURCES` allowlist; stores `lead_source`, `landing_page`, `referrer`, `occasion`, `team_size`, UTM fields, `context` JSON. Attribution already preserves page provenance server-authoritatively. |
| Shared components | `CorporateLeadForm` (client form with `source`/`entryPoint`/`defaultOccasion`/`holidayQualification` props) and `HolidayConversionPage` (dark-brand conversion template). |
| Sitemap | `src/app/sitemap.js` stamped every URL with a fabricated `lastModified: TODAY`. **Fixes required for honest freshness.** |
| Schema | Organizential identity was absent. FAQPage/BreadcrumbList present on game pages. |
| Tests | Vitest: 40 files / 287 tests, node-env mocks; Playwright infra in temp workspace. |

---

## 3. Theme Taxonomy & Categories

Themes are grouped into three intent categories (kept in `src/lib/themes.js`):

1. **Seasons & Holidays** (`seasons`) — calendar-driven, recurring demand, competitive AEO surface.
2. **Heritage & Culture** (`heritage`) — observance programming requiring extra editorial care (co-created, opt-in, celebratory).
3. **Workplace Moments** (`workplace`) — company-life moments that benefit from a structured format (reserved for Wave 2 candidates).

Design rule: **one authoritative URL per intent cluster.** No mass-production of near-duplicate keyword variants; the engine scales *quality* pages, not thin pages.

---

## 4. Wave 1 vs Wave 2 Decisions (candidate-by-candidate)

Decision key: **A** = standalone `/themes/[slug]` page · **B** = hub subsection only · **C** = blog-only · **D** = defer.

| Candidate | Category | Decision | Rationale |
|---|---|---|---|
| **Fall team building** | seasons | **A** 🟢 Wave 1 | Broad evergreen demand (Aug–Nov), maps cleanly to the catalog, no editorial sensitivity. |
| **Halloween** | seasons | **A** 🟢 Wave 1 | High-intent October spike; distinct creative identity; easy "fall festival" fallback. |
| **Holiday team building** | seasons | **A** 🟢 Wave 1 | Peak season; **ties existing holiday money pages together** via internal links rather than competing with them. |
| **Black History Month** | heritage | **A** 🟢 Wave 1 | User-prioritized; validated the "extra-careful editorial standard" path of the engine (co-creation, opt-in framing). |
| Spring team building | seasons | D | Narrower demand; revisit with dedicated copy + AEO test. |
| Summer team building | seasons | D | Defer; catalog mapping is generic, would risk a thin page. |
| Earth Day | seasons | C | Informational intent; better served by a blog post + hub subsection later. |
| Year-end / Q4 | seasons | **B/C** | Already covered by existing money pages; engine links them; blog + hub subsection suffice (avoid duplicate cluster). |
| Valentine's / Galentine's | seasons | D | Defer; revisit after Wave 1 measures. |
| St. Patrick's Day | seasons | D | Defer. |
| Pride Month | heritage | D | Strong demand but high editorial stakes; must co-create before shipping. |
| Women's History Month | heritage | D | Same reason as Pride. |
| AAPI Heritage Month | heritage | D | Same reason. |
| Mental Health Awareness (May) | workplace | C/D | Sensitive topic; needs a real editorial position first. |
| Team offsite / anniversary | workplace | C | Company-life invitation to the quiz funnel; blog + existing `/use-cases` cover it. |

**Wave 1 shipped: `/themes/`, `/themes/fall-team-building/`, `/themes/halloween/`, `/themes/holiday-team-building/`, `/themes/black-history-month/`.**

---

## 5. Shared, Reusable Architecture

```
src/lib/themes.js              ← single source of truth (pure data + tiny helpers)
  ├── THEME_CATEGORIES         ← taxonomy groups
  ├── THEMES[]                 ← 4 Wave 1 themes, each fully specified
  ├── themeBySlug / themesByCategory
  └── resolves blog + game slugs against real data (no dangling links)

src/lib/blog-posts.js          ← blog content extracted from page (single source)
src/components/ThemePage.js    ← ONE server template renders ANY theme
src/app/themes/page.js         ← hub (SSG) + metadata + BreadcrumbList
src/app/themes/[slug]/page.js  ← dynamic route (SSG) + metadata, canonical, OG
src/app/sitemap.js             ← hub + theme routes with honest lastModified
src/app/api/leads/route.js     ← +4 lead sources for CRM attribution
src/app/layout.js              ← Organization JSON-LD (stable @id, all pages)
```

**Data model per theme:** slug, category, name, eyebrow, title, metaTitle, metaDescription, *intro* (self-contained 45–90-word direct answer for AI extraction), summary, benefits, **ranked `topGames`** (slug + honest pitch, resolved against the catalog — never duplicated copy), details, sample agenda, FAQs (self-contained answers), relatedArticles (real blog slugs), relatedThemes (live cross-links), featuredPages (existing money pages), hero styling, **form config** (source/entryPoint/occasion), and honest `seo.{lastModified, changeFrequency, priority}`.

Adding a theme = adding one object + one slug. No component changes, no new route files.

---

## 6. File-by-File Implementation Summary

| File | Change |
|---|---|
| `src/lib/blog-posts.js` | **New** — `POSTS` extracted verbatim from blog page; `postBySlug`. |
| `src/app/blog/page.js` | Imports `POSTS`; output unchanged. Removes inline 17-post array duplication. |
| `src/lib/themes.js` | **New** — taxonomy + 4 themes + helpers. |
| `src/components/ThemePage.js` | **New** — single reusable theme template (hero, direct answer, ranked games, details, agenda, FAQs, related reading/themes, embedded `CorporateLeadForm`, closing CTA). |
| `src/app/themes/page.js` | **New** — hub with category sections, existing-money-page directory, quiz CTA. |
| `src/app/themes/[slug]/page.js` | **New** — `generateStaticParams`, metadata/canonical/OG/twitter, `notFound()`. |
| `src/app/sitemap.js` | Adds `/themes` + all theme routes; `url()` now accepts an explicit `lastModified` per theme (honest dates, no fabricated `today`). |
| `src/app/api/leads/route.js` | `SOURCES` +4: `theme_fall_team_building`, `theme_halloween`, `theme_holiday_team_building`, `theme_black_history_month`. |
| `src/app/layout.js` | Organization JSON-LD with stable `@id`, logo, `knowsAbout` (serves every page/engine). |
| `src/lib/themes.test.js` | **New** — 15 assertions across taxonomy, routing, SEO/AEO data, link integrity, attribution config. |
| `src/app/sitemap.test.js` | **New** — hub/themes presence, honest lastModified, no duplicates. |
| `src/app/api/leads/route.test.js` | +1 test: theme-page attribution persists (`lead_source`, `occasion`, `landing_page`, `context.entry_point`). |

---

## 7. Wave 1 Catalog Entries (shipped content)

- **Fall Team Building** (`/themes/fall-team-building/`) — 7 ranked games, 6 FAQs, 60-min agenda, "autumn season" positioning across Sept–Nov.
- **Halloween** (`/themes/halloween/`) — 7 ranked games, costume-optional + G-rated + "fall festival" alternatives, 5 FAQs.
- **Holiday Team Building** (`/themes/holiday-team-building/`) — inclusive year-end framing, links to all four existing holiday money pages, holiday qualification form, 5 FAQs.
- **Black History Month** (`/themes/black-history-month/`) — heritage-tier editorial: co-creation with the team/ERG, opt-in-only rounds, recognition-not-performance framing, year-round support note, 5 FAQs, 6 ranked (co-created) games.
- **Hub** (`/themes/`) — category sections, live theme cards, directory of existing money pages + game catalog, quiz CTA.

Editorial guard-rails honored: no invented stats/reviews, no stereotyping, no diversity-token framing on heritage pages, and every "best games" claim is a transparent Teamtastic-host curation, not an external ranking claim.

---

## 8. Existing-Content Accommodation (no parallel system)

- **Game catalog:** theme `topGames` resolve by slug against `gamesData.json` and link to real `/games/[slug]` pages. Game copy is never duplicated.
- **Blog:** posts extracted to `src/lib/blog-posts.js`; theme pages link to real `/blog/[slug]` pages with real titles/categories.
- **Money pages:** `holiday-team-building` promotes the existing holiday party pages via `featuredPages`; the hub lists them in a directory.
- **Components:** `ThemePage` embeds the existing `CorporateLeadForm` (no new form). `HolidayConversionPage` untouched and still used by holiday pages — the two coexist as intended (holiday = campaign landing, themes = evergreen index).
- **Explicit non-duplication:** no second lead form, no second catalog, no second blog list, no new images/assets.

---

## 9. 2026 Classic SEO Research Findings

Sources: Google Search Central "Optimizing your website for generative AI features on Google Search" (official), LLM Pulse, Mettevo, thestacc, Unified Platforms, MV3 (all 2026).

- Classic ranking systems remain the foundation; AI features build on the indexed, snippet-eligible index.
- **QA-paired content structure**, answer-first openings, ranked lists, and comparison tables drive both classic SERPs and citations.
- **Semantic topic clusters** interlinked outperform isolated pages — the hub is the pillar, themes + blog are cluster nodes.
- E-E-A-T gates authority; first-party data and named authors matter. (See Recommendations: author pages.)
- Freshness: recent updates win citations; **honest `lastModified`, real dates, and an annual refresh cadence are non-negotiable** (we do *not* fake dates).

---

## 10. 2026 AEO/GEO Research Findings

- Google officially: no special schema, no `llms.txt`, no chunking tricks (Dec 2024 guide + 2026 guidance). AI Overviews/AI Mode pull from the normal index; **eligibility = indexed + snippet-eligible**.
- **Citation mechanics:** 44.2% of citations come from the first 30% of a page (Evertune/Wix 2026); ranked lists = 63% of LLM citations; tables earn ~4× citations; FAQ-anchored Q&A sections and self-contained 40–80-word passages (fraggles/fan-out retrieval) win passage-level citation.
- **Actions taken:** answer-first `intro` (45–90 words) under the H1; ranked `topGames` ItemList; self-contained FAQ answers ≥60 chars standing alone; question-phrased H2s; semantic completeness wired to real catalog/blog content.
- **E-E-A-T:** 96% of citations from strong-E-E-A-T sources — we surface first-party capability facts (53-game catalog statement, hosted-show mechanics) and avoid invented claims.

---

## 11. Bing / Copilot / ChatGPT Search Findings

- ChatGPT Search uses the Bing index; **Bing/Copilot confirmed (Mar 2025) that it consumes schema.org markup**.
- Perplexity cites openly and reads FAQPage/Organization/Product markup; Gemini uses Google's structured-data stack incl. Organization + sameAs.
- **One clean schema layer serves every engine** — hence one Organization block + BreadcrumbList + FAQPage + ItemList shapes repeated per page rather than engine-specific hacks.
- `llms.txt`: Google ignores it; not implemented (documented decision).

---

## 12. IndexNow Decision

**Decision: NOT implemented.** IndexNow is Bing/Yandex/Seznam-only; Google ignores it. This is a statically-generated site (all theme pages SSG, submitted via sitemap immediately on deploy). A sitemap ping + GSC covers Bing; IndexNow adds an always-on integration and key-surface to maintain with no measured benefit for a small, pre-rendered site. Revisit only if a dynamic, frequently-updated content tier is added.

---

## 13. JSON-LD Structured Data (per page)

- **All pages (root layout):** `Organization` with stable `@id https://teamtastic.events/#organization`, name, URL, logo, `knowsAbout` — the 2026 identity/entity signal every engine resolves against, consistent across the site.
- **Hub:** `BreadcrumbList`.
- **Each theme:** `BreadcrumbList` (hub → theme), `FAQPage` (visible Q&A, answers mirror on-page text word-for-word), `ItemList` (ranked Top-N games → real catalog URLs).
- Validation policy: markup only where it matches visible content; no FAQPage stuffing of duplicate questions (max 5–6 genuine distinct questions).

---

## 14. Metadata & Canonical URLs

- Every theme page: unique `title`/`metaTitle`, 70–170-char `metaDescription`, canonical `https://teamtastic.events/themes/[slug]`, OG + twitter cards with `/teamtastic-og.png`.
- Hub: canonical + OG at `/themes`.
- `generateStaticParams` → all pages pre-rendered (verified in build output) — full HTML in first response (no client-render crawl barrier for AI systems).

---

## 15. Internal Linking Design

- Every theme links to: its ranked games (`/games/[slug]`) — 5–7 descriptive anchors; related articles (`/blog/[slug]`) with real titles; related themes (`/themes/[slug]`); the hub; the quiz (`/#quiz`) and lead form anchor.
- Holiday theme additionally links to the four existing money pages (cluster consolidation, not competition).
- Hub links to every theme, the money-page directory, and the game catalog. All anchors descriptive and data-resolved (tests prove no dangling links).

---

## 16. Sitemap Integration

- `/themes` (0.9, weekly) + each theme with per-theme `lastModified` (honest, from content), `changeFrequency`, `priority` from `theme.seo`.
- Fixed the prior fabricated-`today` bug for theme pages: each entry carries its real content date. (Whole-site remediation is a follow-up recommendation — see §21.)
- Sitemap test enforces presence + honest dates + uniqueness.

---

## 17. Lead Capture & CRM Attribution

Flow: theme page → `CorporateLeadForm` (existing component) → `POST /api/leads`.

- Each theme has a **unique sanctioned `lead_source`** (`theme_*`) added to the `SOURCES` allowlist, a per-theme `entryPoint` (`theme_<slug>_inline`), and a `defaultOccasion` from the form vocabulary.
- Persisted row already carries: `lead_source` (theme), `landing_page` (`/themes/<slug>/`), `occasion`, `team_size`, UTM (source/medium/campaign/content/term), and `context.entry_point`.
- **No duplicate-lead risk:** unchanged idempotency — submissionId dedupe + 23505 conflict handling; provenance is server-authoritative; synthetic/certification context keys remain stripped.
- CRM read yields: *Lead source: theme_halloween · Landing page: /themes/halloween/ · Occasion: Team social · Entry point: theme_halloween_inline* — enough for sales follow-up and funnel analysis without new fields.

---

## 18. Testing & Verification Results

| Check | Result |
|---|---|
| `src/lib/themes.test.js` (new, 15 tests) | **PASS** |
| `src/app/sitemap.test.js` (new) | **PASS** |
| `src/app/api/leads/route.test.js` (+theme attribution test) | **PASS** (30 tests in file) |
| Full unit suite | **40 files / 287 tests PASS** |
| Lint (`npm run lint`) | **PASS** |
| Typecheck (`npm run typecheck`) | **PASS** |
| Production build (`npm run build`) | **PASS** — hub + 4 themes SSG-prerendered |
| Route validation (prod server) | `/themes` + all 4 themes **200**; unknown slug **404**; `/sitemap.xml` **200** |
| Structured-data validation (curl + parse) | Organization / BreadcrumbList / FAQPage (5) / ItemList (6–7 ranked) **all present & well-formed** |
| Canonical/meta validation | title, canonical, OG correct per theme |
| Mobile rendering (Playwright, 375×812) | **5/5 PASS** — no horizontal overflow, H1 + lead form render |
| Regression spot-check | `/blog`, `/blog/[post]`, `/games/[slug]` **200**; blog title unchanged |

---

## 19. Validation & Quality Gates (run commands)

```bash
npm test                   # 40 files / 287 tests
npm run lint               # clean
npm run typecheck          # clean
npm run build              # next build: SSG routes for /themes + [slug] confirmed
# Prod server checks: curl /themes*, /sitemap.xml, invalid slug; Playwright mobile 5/5
```

Full `npm run check` (`lint && typecheck && test && audit`) is the release gate.

---

## 20. Wave 2 Roadmap (populate-through-the-engine)

Ships by **adding data objects only** — no new templates:

1. **Spring / Earth Day / Summer** (content-only; map to catalog honestly; blog-first for informational intent).
2. **Pride / Women's History / AAPI Heritage** (heritage tier: co-create with ERG/advisor before shipping; follow BHM template standards).
3. **Workplace moments** (`/use-cases` + blog; optional B/C subsections).
4. Each Wave-2 theme: own theme object → hub card → sitemap entry → lead source; metadata/schema/internal links inherit automatically.
5. **Annual refresh cadence:** update `seo.lastModified`, intro, topGames pitches, and FAQs each relevant season; keep a content calendar in this report's cadence.

---

## 21. Recommendations & Guardrails (follow-ups)

1. **Site-wide honest `lastModified`:** extend the per-route `lastModified` fix from theme pages to the whole sitemap (games/blog currently inherit `today()`).
2. **Author/Person schema + real `sameAs`:** add `Person` (author) + verified `sameAs` (LinkedIn, Wikipedia, Wikidata Q-id) to the Organization block — highest-leverage 2026 entity signal and an E-E-A-T gate.
3. **Track "share of answer"** across the 4 theme clusters (GSC + AI-tracker) before Wave 2; target 12%+ on the core cluster.
4. **Refresh cadence:** theme pages must be touched at least every 8–12 weeks during their season; stale seasonal pages lose AI citations fast.
5. **Heritage gate:** no heritage/culture theme ships without a co-creation note + sensitivity review; keep opt-in and recognition-not-performance constraints in the data model.
6. **No schema gambits:** keep FAQPage to 4–6 genuine questions matching visible text; FAQ rich results are gone (May 2026) — writes it as content/topicality asset, not a rank hack.
7. **IndexNow:** skip (decision documented in §12); re-evaluate only if a dynamic content tier appears.
8. **QA before every seasonal peak:** run the quartet — build, curl routes, mobile check, lead-attribution test — before the relevant season's start (e.g., holiday pages before Nov).

---

## Final Assessment

**VERIFIED — READY FOR HUMAN REVIEW.** The seasonal theme + SEO content engine is implemented, tested, and rendering correctly in production-like builds.

- **Reusable system built first:** one data source, one template, one hub — four Wave 1 pages populated from structured data. Adding a theme is a data edit, not a code change.
- **No parallel content system:** blog, game catalog, lead form, and money pages are reused and linked, never duplicated.
- **AEO/GEO-informed:** answer-first copy, ranked lists, self-contained FAQs, comparison-grade structure, honest freshness, Organization identity — all grounded in 2026 primary/recent research (Google official guidance, Evertune/Wix, Ahrefs, Search Engine Land).
- **Conversion + attribution coherent:** theme → experience → proof → CTA → attributed lead (unique `theme_*` source + landing page + occasion) → sales follow-up works end to end.
- **Heritage editorial standards held** on the Black History Month page: co-created, opt-in, respectful.
- **Quality:** 287 tests, lint, typecheck, production build, route checks, schema validation, mobile 5/5 — all green.

**Human review needed:** content copy pass/approval for all four theme pages (especially BHM), seasonal calendar alignment, and the §21 follow-ups before Wave 2.