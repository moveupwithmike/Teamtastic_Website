import recommendationData from "../../supabase/functions/_shared/recommendations.json";

/** Canonical recommendation data is shared with Supabase Edge Functions. */
export const recommendations = recommendationData;

export function getRecommendation(vibe = "competitive") {
  return recommendations[vibe] || recommendations.competitive;
}

/**
 * Returns 2-3 concierge recommendations for the corporate event concierge
 * based on preferences and vibe strings (from TalkToMichaelModal).
 * All slugs verified against gamesData.json.
 */
export function getCorporateConciergeRecs(pref = "", vibe = "") {
  const p = pref.toLowerCase();
  const v = vibe.toLowerCase();

  if (p.includes("trivia") || v.includes("competition")) {
    return [
      { title: "Lightning Feud", slug: "lightning-feud", desc: "A high-octane buzzer survey battle custom-themed for your brand and culture.", badge: "Most Popular" },
      { title: "Game Masters", slug: "game-masters", desc: "Classic TV-style game show format with live scoreboards, buzzers, and friendly banter.", badge: "High Energy" },
    ];
  }
  if (p.includes("escape") || v.includes("solving") || v.includes("collaborat")) {
    return [
      { title: "Mystery Box", slug: "mystery-box", desc: "Cooperative team-based logic puzzles, secret codes, and escape-room-style challenges.", badge: "Cooperative" },
      { title: "Mystery Mosaic", slug: "mystery-mosaic", desc: "Solve collaborative clues to unlock puzzle tiles and unveil your custom team moment.", badge: "Collaboration" },
    ];
  }
  if (p.includes("bingo") || p.includes("music")) {
    return [
      { title: "Name That Tune", slug: "name-that-tune", desc: "High-energy sound riffs, song clips, custom boards, and dancing in your seats.", badge: "Fun &amp; Social" },
      { title: "Finish the Lyric", slug: "finish-the-lyric", desc: "Guess song lyrics in a fast-paced audio battle across decades and genres.", badge: "Music &amp; Audio" },
    ];
  }
  // default
  return [
    { title: "Lightning Feud", slug: "lightning-feud", desc: "Our most popular corporate team-building experience featuring custom company trivia.", badge: "Most Popular" },
    { title: "Online Office Games", slug: "online-office-games", desc: "Tv-style mini games, buzzer battle, and interactive team-vs-team modes.", badge: "High Energy" },
    { title: "The Hot Seat", slug: "the-hot-seat", desc: "A hand-crafted mix of hot-takes, superlatives, and team awards.", badge: "100% Tailored" },
  ];
}

/**
 * Returns 2-3 concierge recommendations for the family game-night concierge.
 * All slugs verified against gamesData.json.
 */
export function getFamilyConciergeRecs(pref = "", vibe = "") {
  const p = pref.toLowerCase();
  const v = vibe.toLowerCase();

  if (p.includes("trivia") || v.includes("competition")) {
    return [
      { title: "Lightning Feud", slug: "lightning-feud", desc: "Fun, fast-paced survey trivia custom-written about your family stories and memories.", badge: "Most Popular" },
      { title: "Game Masters", slug: "game-masters", desc: "Kids vs. adults in a high-energy showdown of trivia, memory cues, and pop culture.", badge: "High Energy" },
    ];
  }
  if (p.includes("bingo") || v.includes("casual")) {
    return [
      { title: "Bingo", slug: "bingo", desc: "Classic family bingo with interactive twists, live boards, and silly callouts.", badge: "Fun &amp; Social" },
      { title: "Name That Tune", slug: "name-that-tune", desc: "Name that tune, audio decades, and music bingo cards for all generations.", badge: "Cooperative" },
    ];
  }
  // default
  return [
    { title: "Lightning Feud", slug: "lightning-feud", desc: "Our most popular live-hosted family game show with personalized family trivia.", badge: "Most Popular" },
    { title: "Superlatives", slug: "superlatives", desc: "A fun-filled showdown for the family — who is the funniest, the quirkiest, the most likely?", badge: "High Energy" },
    { title: "The Spotlight", slug: "the-spotlight", desc: "Share live photos, family stories, and emoji highlights on a gorgeous presentation feed.", badge: "100% Tailored" },
  ];
}
