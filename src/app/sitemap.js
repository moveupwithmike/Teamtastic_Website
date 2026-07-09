import gamesPool from "@/lib/gamesData.json";

const BASE = "https://teamtastic.events";
const TODAY = new Date().toISOString().split("T")[0];

function url(route, priority, changeFrequency = "monthly") {
  return { url: `${BASE}${route}`, lastModified: TODAY, changeFrequency, priority };
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
    url("/virtual-family-game-night",        0.85, "weekly"),
    url("/why-teamtastic",                   0.85, "monthly"),
    url("/resources",                        0.8,  "weekly"),
    url("/resources/faq",                    0.75),
    url("/resources/how-it-works",           0.75),
    url("/resources/event-planning-guide",   0.7),
    url("/blog",                             0.85, "weekly"),
    url("/blog/best-virtual-team-building-companies", 0.82),
    url("/blog/virtual-christmas-party-ideas-for-work", 0.84),
    url("/blog/how-to-plan-a-remote-office-holiday-party", 0.84),
    url("/blog/virtual-holiday-party-ideas-for-large-teams", 0.84),
    url("/blog/virtual-trivia-for-work",     0.82),
    url("/blog/corporate-game-show-ideas-for-work", 0.82),
    url("/blog/team-building-for-remote-engineering-teams", 0.82),
    url("/blog/zoom-team-building-games",    0.82),
    url("/blog/virtual-holiday-party-games", 0.82),
    url("/blog/employee-engagement-activities-remote-teams", 0.82),
    url("/blog/virtual-team-building-ideas", 0.8),
    url("/blog/remote-team-engagement-tips", 0.8),
    url("/blog/virtual-icebreaker-games",    0.8),
    url("/blog/corporate-game-show-activities", 0.8),
    url("/use-cases/hr-and-people-ops",      0.75),
    url("/use-cases/remote-engineering-teams", 0.75),
    url("/use-cases/virtual-intern-cohorts", 0.75),
    url("/use-cases/private-vip-socials",    0.75),
    url("/games/lightning-feud",             0.85),   // featured
    url("/games/survey-showdown",            0.85),
    url("/games/online-office-games",        0.85),
    url("/games/tiny-campfire",              0.85),
  ];

  // Generate entries for all games from the authoritative data source.
  // This prevents sitemap 404s when games are added or removed.
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

  return [...staticRoutes, ...uniqueGameRoutes];
}
