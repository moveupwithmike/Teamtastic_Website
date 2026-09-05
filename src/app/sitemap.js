import gamesPool from "@/lib/gamesData.json";
import { THEMES } from "@/lib/themes";
import { POSTS } from "@/lib/blog-posts";

const BASE = "https://teamtastic.events";

// lastModified is only ever set when we track a genuine content-update date.
// Pages with no tracked date omit it entirely rather than fabricating "today"
// on every build — an honest lastModified (or none) beats a fake one for both
// classic SEO and AI-search crawlers.
function url(route, priority, changeFrequency = "monthly", lastModified) {
  const entry = { url: `${BASE}${route}`, changeFrequency, priority };
  if (lastModified) entry.lastModified = lastModified;
  return entry;
}

function isoDateFromLabel(label) {
  const parsed = new Date(label);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString().split("T")[0];
}

export default function sitemap() {
  const staticRoutes = [
    url("",                                  1.0, "daily"),
    url("/virtual-team-building",            0.95, "weekly"),
    url("/pricing",                          0.9,  "weekly"),
    url("/games",                            0.9,  "weekly"),
    url("/activities",                       0.7,  "monthly"),   // redirects → /games
    url("/team-experiences",                 0.85, "weekly"),
    url("/virtual-holiday-party",            0.95, "weekly"),
    url("/virtual-year-end-team-celebration", 0.92, "weekly"),
    url("/virtual-holiday-party-for-large-groups", 0.92, "weekly"),
    url("/virtual-family-game-night",        0.85, "weekly"),
    url("/virtual-family-reunion-game-show", 0.85, "weekly"),
    url("/virtual-birthday-game-show",       0.85, "weekly"),
    url("/long-distance-family-game-night",  0.85, "weekly"),
    url("/family-trivia-starter",            0.82, "monthly"),
    url("/why-teamtastic",                   0.85, "monthly"),
    url("/resources",                        0.8,  "weekly"),
    url("/resources/faq",                    0.75),
    url("/resources/how-it-works",           0.75),
    url("/resources/event-planning-guide",   0.7),
    url("/privacy",                          0.2,  "yearly", "2026-08-29"),
    url("/terms",                            0.2,  "yearly", "2026-08-29"),
    url("/cancellation-policy",              0.4,  "monthly", "2026-08-29"),
    url("/blog",                             0.85, "weekly"),
    url("/use-cases/hr-and-people-ops",      0.75),
    url("/use-cases/remote-engineering-teams", 0.75),
    url("/use-cases/virtual-intern-cohorts", 0.75),
    url("/use-cases/private-vip-socials",    0.75),
    url("/themes",                           0.9,  "weekly"),
    url("/games/lightning-feud",             0.85),   // featured
    url("/games/survey-showdown",            0.85),
    url("/games/online-office-games",        0.85),
    url("/games/tiny-campfire",              0.85),
  ];

  // Blog posts carry a real per-post date in src/lib/blog-posts.js — the
  // single source of truth for both the blog index and this sitemap, so a
  // post's lastModified only changes when its own tracked date changes.
  const blogRoutes = POSTS.map((post) =>
    url(`/blog/${post.slug}`, 0.8, "monthly", isoDateFromLabel(post.date))
  );

  // Themed event pages use each theme's real content-update date, never a
  // fabricated "today", so lastModified stays honest for every engine.
  const themeRoutes = THEMES.map((theme) =>
    url(`/themes/${theme.slug}`, theme.seo.priority, theme.seo.changeFrequency, theme.seo.lastModified)
  );

  // Generate entries for all games from the authoritative data source.
  // This prevents sitemap 404s when games are added or removed. No per-game
  // update date is tracked, so lastModified is intentionally omitted rather
  // than guessed.
  const gameRoutes = gamesPool.map((g) =>
    url(`/games/${g.slug}`, 0.75)
  );

  // De-duplicate: static featured entries take precedence over generated ones.
  const staticGameSlugs = new Set(
    staticRoutes.filter((r) => r.url.includes("/games/")).map((r) => r.url)
  );
  const uniqueGameRoutes = gameRoutes.filter(
    (r) => !staticGameSlugs.has(r.url)
  );

  return [...staticRoutes, ...blogRoutes, ...themeRoutes, ...uniqueGameRoutes];
}
