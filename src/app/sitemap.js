export default function sitemap() {
  const baseUrl = "https://teamtastic.events";

  const staticPaths = [
    { route: "", priority: 1.0, changeFrequency: "daily" },
    { route: "/virtual-team-building", priority: 0.95, changeFrequency: "weekly" },
    { route: "/why-teamtastic", priority: 0.85, changeFrequency: "monthly" },
    { route: "/pricing", priority: 0.9, changeFrequency: "weekly" },
    { route: "/resources", priority: 0.8, changeFrequency: "weekly" },
    { route: "/resources/faq", priority: 0.75, changeFrequency: "monthly" },
    { route: "/resources/how-it-works", priority: 0.75, changeFrequency: "monthly" },
    { route: "/resources/event-planning-guide", priority: 0.7, changeFrequency: "monthly" },
    { route: "/blog", priority: 0.85, changeFrequency: "weekly" },
    { route: "/blog/virtual-team-building-ideas", priority: 0.8, changeFrequency: "monthly" },
    { route: "/blog/remote-team-engagement-tips", priority: 0.8, changeFrequency: "monthly" },
    { route: "/blog/virtual-icebreaker-games", priority: 0.8, changeFrequency: "monthly" },
    { route: "/blog/corporate-game-show-activities", priority: 0.8, changeFrequency: "monthly" },
    { route: "/games/survey-showdown", priority: 0.8, changeFrequency: "monthly" },
    { route: "/games/lightning-feud", priority: 0.8, changeFrequency: "monthly" },
    { route: "/games/meme-battle", priority: 0.8, changeFrequency: "monthly" },
    { route: "/games/sound-bite-trivia", priority: 0.8, changeFrequency: "monthly" },
    { route: "/use-cases/hr-and-people-ops", priority: 0.75, changeFrequency: "monthly" },
    { route: "/use-cases/remote-engineering-teams", priority: 0.75, changeFrequency: "monthly" },
    { route: "/use-cases/virtual-intern-cohorts", priority: 0.75, changeFrequency: "monthly" },
    { route: "/use-cases/private-vip-socials", priority: 0.75, changeFrequency: "monthly" },
  ];

  const paths = staticPaths.map(({ route, priority, changeFrequency }) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date().toISOString().split("T")[0],
    changeFrequency,
    priority,
  }));

  return paths;
}
