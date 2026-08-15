const DEFAULT_DEADLINE = "2026-09-30";

export const HOLIDAY_CAMPAIGN = {
  deadline: process.env.HOLIDAY_EARLY_BIRD_DEADLINE || DEFAULT_DEADLINE,
  bonus: "a free custom company-trivia round",
  availabilityMessage: "December prime-time dates are limited",
};

export function holidayDeadlineLabel() {
  const date = new Date(`${HOLIDAY_CAMPAIGN.deadline}T12:00:00Z`);
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", timeZone: "UTC" }).format(date);
}

export function holidayOfferCopy(now = new Date()) {
  const cutoff = new Date(`${HOLIDAY_CAMPAIGN.deadline}T23:59:59-04:00`);
  if (now <= cutoff) {
    return {
      active: true,
      deadlineLabel: holidayDeadlineLabel(),
      short: `Book by ${holidayDeadlineLabel()} for ${HOLIDAY_CAMPAIGN.bonus}`,
      reason: `Early-bird bonus: book by ${holidayDeadlineLabel()} for ${HOLIDAY_CAMPAIGN.bonus}`,
    };
  }
  return {
    active: false,
    deadlineLabel: null,
    short: "Ask about current holiday availability and booking bonuses",
    reason: "Ask about current holiday availability and seasonal customization bonuses",
  };
}
