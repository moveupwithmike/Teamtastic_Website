import recommendations from "./recommendations.json" with { type: "json" };

export const NURTURE_STEPS = [
  { type: "nurture_day1", minAgeHours: 24 },
  { type: "nurture_day3", minAgeHours: 72 },
  { type: "nurture_day7", minAgeHours: 168 },
] as const;

export const FAMILY_NURTURE_STEPS = [
  { type: "family_nurture_day2", minAgeHours: 48 },
  { type: "family_nurture_day5", minAgeHours: 120 },
  { type: "family_nurture_day10", minAgeHours: 240 },
] as const;

const RECS: Record<string, { title: string; games: string[] }> = recommendations;

const escapeHtml = (value: unknown) => String(value ?? "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

function nextStep<T extends readonly { type: string; minAgeHours: number }[]>(ageHours: number, sentTypes: Set<string>, steps: T) {
  return steps.find((step, index) =>
    ageHours >= step.minAgeHours &&
    !sentTypes.has(step.type) &&
    steps.slice(0, index).every((prior) => sentTypes.has(prior.type))
  ) || null;
}

export function nextNurtureStep(ageHours: number, sentTypes: Set<string>) {
  return nextStep(ageHours, sentTypes, NURTURE_STEPS);
}

export function nextFamilyNurtureStep(ageHours: number, sentTypes: Set<string>) {
  return nextStep(ageHours, sentTypes, FAMILY_NURTURE_STEPS);
}

export function buildNurtureEmail(step: string, lead: Record<string, unknown>, depositBase?: string | null) {
  const name = escapeHtml(lead.name);
  const link = depositBase ? `${depositBase}?${new URLSearchParams({
    prefilled_email: String(lead.email ?? ""),
    client_reference_id: String(lead.submission_id ?? ""),
  })}` : null;
  const cta = link ? `<p><a href="${link}">Reserve your event — $200 deposit</a></p>` : "";
  if (step === "nurture_day1") {
    const rec = RECS[String(lead.recommendation_key)] || RECS.competitive;
    return {
      subject: `Your Teamtastic package: ${rec.title}`,
      html: `<h1>Hey ${name},</h1><p>Here's the package we put together for your team: <strong>${escapeHtml(rec.title)}</strong> (${rec.games.map(escapeHtml).join(", ")}). Built to get everyone involved &mdash; not just the loud ones.</p><p>Want to lock in a date? Michael handles the rest.</p>${cta}`,
    };
  }
  if (step === "nurture_day3") return {
    subject: "More than another virtual trivia event",
    html: `<h1>Hey ${name},</h1><p>Most virtual team events feel like another meeting with trivia added. Yours won't: a Master Emcee turns the screen into a live game show, and the format is built so everyone plays &mdash; you never have to rescue the event.</p><p>Still deciding? Just reply &mdash; happy to answer questions before you book.</p>${cta}`,
  };
  return {
    subject: "Should I hold your game show idea?",
    html: `<h1>Hey ${name},</h1><p>I know event planning has a way of sliding down the to-do list. If your team gathering is still taking shape, the package we mapped out is a $200 deposit away from a locked-in date &mdash; and if the timing isn't right, just reply and tell me. No hard feelings, no follow-up avalanche.</p>${cta}`,
  };
}

export function buildFamilyNurtureEmail(step: string, lead: Record<string, unknown>, depositBase?: string | null) {
  const name = escapeHtml(lead.name);
  const occasion = escapeHtml(lead.occasion || "family get-together");
  const groupName = escapeHtml(lead.group_name || "your group");
  const link = depositBase ? `${depositBase}?${new URLSearchParams({
    prefilled_email: String(lead.email ?? ""),
    client_reference_id: String(lead.submission_id ?? ""),
  })}` : null;
  const cta = link ? `<p><a href="${link}">Reserve your date — $100 deposit</a></p>` : "";

  if (step === "family_nurture_day2") return {
    subject: `A game-show idea for ${groupName}`,
    html: `<h1>Hey ${name},</h1><p>For your ${occasion}, Michael can host a live online game show where every age group can join from home. We handle the games, pacing, and laughs, so nobody in the family has to run the event.</p><p>Reply with any ages, inside jokes, or accessibility needs and we'll shape the experience around your group.</p>${cta}`,
  };
  if (step === "family_nurture_day5") return {
    subject: "How a Teamtastic family party works",
    html: `<h1>Hey ${name},</h1><p>Everyone joins one video call, Michael welcomes the group, and then guides everyone through a mix of fast, funny games. There is nothing for guests to install and no relative gets stuck playing tech support or host.</p><p>If you have a date in mind, reply and we'll check it.</p>${cta}`,
  };
  return {
    subject: "Should I keep your family game-show idea open?",
    html: `<h1>Hey ${name},</h1><p>If your ${occasion} is still taking shape, you can reserve the date with a $100 deposit. If the timing is not right, just reply and say so—we'll close the loop and won't keep filling your inbox.</p>${cta}`,
  };
}
