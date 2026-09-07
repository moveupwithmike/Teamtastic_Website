function easternTimeParts(date) {
  return Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
}

function isEasternWindow(date, hour, minute) {
  const parts = easternTimeParts(date);
  return parts.hour === hour && parts.minute >= minute && parts.minute < minute + 10;
}

export function isEasternAutopilotWindow(date = new Date()) {
  return isEasternWindow(date, 7, 10);
}

export function isEasternMorningWindow(date = new Date()) {
  return isEasternWindow(date, 8, 10);
}
