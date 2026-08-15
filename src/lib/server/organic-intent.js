import { createHash } from "node:crypto";

/** @type {Array<[RegExp, number, string]>} */
const signals = [
  [/holiday|year[- ]end|christmas|winter/i, 22, "Seasonal event request"],
  [/virtual|remote|distributed|global team/i, 18, "Virtual or distributed team"],
  [/team building|company event|corporate event|employee engagement/i, 18, "Corporate team-event intent"],
  [/looking for|recommend|need|planning|ideas|vendor/i, 16, "Active research language"],
  [/\b(75|[89]\d|[1-9]\d{2,})\+?\b|large group/i, 12, "Large-group signal"],
  [/december|november|next week|this month|date/i, 8, "Timing signal"],
  [/budget|price|cost|quote|procurement/i, 6, "Commercial signal"],
];

export function scoreOrganicIntent(title, excerpt) {
  const text = `${title || ""} ${excerpt || ""}`;
  let score = 5;
  const reasons = [];
  for (const [pattern, points, reason] of signals) {
    if (pattern.test(text)) { score += points; reasons.push(reason); }
  }
  score = Math.min(100, score);
  return { score, reasons, confidence: Math.min(0.95, 0.35 + reasons.length * 0.1) };
}

export function organicFingerprint(sourceUrl, excerpt) {
  return createHash("sha256").update(`${sourceUrl.trim().toLowerCase()}|${excerpt.trim().toLowerCase()}`).digest("hex");
}

export function createHelpfulDraft({ excerpt, recommendedPage, trackingToken }) {
  const site = "https://www.teamtastic.events";
  const path = recommendedPage || "/virtual-holiday-party";
  const trackedUrl = `${site}${path}?utm_source=organic_intent&utm_medium=helpful_response&utm_campaign=organic_intent_radar&utm_content=${trackingToken}`;
  const holiday = /holiday|christmas|winter|year[- ]end/i.test(excerpt);
  const bodyText = holiday
    ? `A useful way to narrow this down is to choose the date/time zone first, then confirm group size and whether you want one shared game or team-based scoring. For a 60-minute event, I’d allow 5 minutes for arrival, 45–50 minutes for hosted play, and 5 minutes for awards. We run these at Teamtastic; this planning page may help: ${trackedUrl}`
    : `I’d start by confirming the date, time zone, group size, and whether the goal is social connection, friendly competition, or recognition. Those four details usually make vendor comparisons much easier. We run hosted virtual team events at Teamtastic; this page may help: ${trackedUrl}`;
  return { bodyText, trackedUrl };
}
