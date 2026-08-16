export function easternSendingTime(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", weekday: "short", hour: "2-digit", hour12: false,
  }).formatToParts(now).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return { weekday: parts.weekday, hour: Number(parts.hour) % 24 };
}

export function withinSendingWindow(now = new Date()) {
  const { weekday, hour } = easternSendingTime(now);
  return !["Sat", "Sun"].includes(weekday) && hour >= 9 && hour < 17;
}

export function emailDomain(email: string) {
  return String(email || "").split("@")[1]?.toLowerCase() || null;
}
