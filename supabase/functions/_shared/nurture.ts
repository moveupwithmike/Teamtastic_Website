import recommendations from "./recommendations.json" with { type: "json" };

export const NURTURE_STEPS = [
  { type: "nurture_day1", minAgeHours: 24 },
  { type: "nurture_day3", minAgeHours: 72 },
  { type: "nurture_day7", minAgeHours: 168 },
] as const;

const RECS: Record<string, { title: string; games: string[] }> = recommendations;

const escapeHtml = (value: unknown) => String(value ?? "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

export function nextNurtureStep(ageHours: number, sentTypes: Set<string>) {
  return NURTURE_STEPS.find((step, index) =>
    ageHours >= step.minAgeHours &&
    !sentTypes.has(step.type) &&
    NURTURE_STEPS.slice(0, index).every((prior) => sentTypes.has(prior.type))
  ) || null;
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
