const OCCASION_LABELS = {
  birthday: "birthday",
  reunion: "family reunion",
  anniversary: "anniversary",
  graduation: "graduation",
  holiday: "holiday gathering",
  "just-because": "family game night",
};

function cleanText(value, max = 120) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

/**
 * @param {{occasion?: string, ageRange?: string, playerCount?: string, interests?: string, memory?: string}} details
 */
export function buildFamilyTrivia({ occasion, ageRange, playerCount, interests, memory } = {}) {
  const event = OCCASION_LABELS[occasion] || "family game night";
  const ages = cleanText(ageRange, 60) || "mixed ages";
  const players = cleanText(playerCount, 40) || "the whole family";
  const interestList = cleanText(interests, 160)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 3);
  const favorite = interestList[0] || "movies and music";
  const second = interestList[1] || "favorite foods";
  const third = interestList[2] || "family traditions";
  const sharedMemory = cleanText(memory, 180);

  return [
    `What is one ${favorite} question that every generation at this ${event} could attempt?`,
    `Which family member would be the strongest teammate in a challenge about ${second}?`,
    `What is the family’s most-debated opinion about ${third}?`,
    `For a group of ${players}, which two relatives would make the funniest team captains?`,
    `What song would get guests in the ${ages} age range singing first?`,
    `Which family tradition deserves its own game-show category?`,
    `Who is most likely to turn a friendly ${event} into a serious competition?`,
    `What family recipe, snack, or restaurant order would everyone recognize from one clue?`,
    `Which destination or hometown should appear in a family geography round?`,
    `What harmless phrase or saying is repeated so often that the whole family can finish it?`,
    sharedMemory
      ? `Who remembers this moment best: “${sharedMemory}”? Ask them for one surprising detail.`
      : "Which shared family memory still makes everyone laugh?",
    `What should the winning team at this ${event} be called?`,
  ];
}
