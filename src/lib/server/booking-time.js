const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

export function validTimeZone(timeZone) {
  try { new Intl.DateTimeFormat("en-US", { timeZone }).format(); return true; }
  catch { return false; }
}

function wallParts(date, time) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  return { year, month, day, hour, minute };
}

export function zonedWallTimeToUtc(date, time, timeZone) {
  const wanted = wallParts(date, time);
  let result = new Date(Date.UTC(wanted.year, wanted.month - 1, wanted.day, wanted.hour, wanted.minute));
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parts = Object.fromEntries(formatter.formatToParts(result).filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
    const observed = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour === 24 ? 0 : parts.hour, parts.minute);
    const desired = Date.UTC(wanted.year, wanted.month - 1, wanted.day, wanted.hour, wanted.minute);
    result = new Date(result.getTime() + desired - observed);
  }
  return result;
}

export function dateInTimeZone(date, timeZone) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function zonedDayRangeUtc(date, timeZone) {
  const [year, month, day] = date.split("-").map(Number);
  const nextDate = new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
  return [
    zonedWallTimeToUtc(date, "00:00", timeZone),
    zonedWallTimeToUtc(nextDate, "00:00", timeZone),
  ];
}

export function weekdayForDate(date) {
  const [year, month, day] = date.split("-").map(Number);
  return WEEKDAYS[new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay()];
}

export function addWallMinutes(time, minutes) {
  const [hour, minute] = time.split(":").map(Number);
  const total = hour * 60 + minute + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function wallMinutes(time) {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

export function overlaps(startA, endA, startB, endB) {
  return startA < endB && endA > startB;
}
