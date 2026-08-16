import { buildReminderEmail, REMINDER_WINDOWS } from "../functions/_shared/booking-reminders.ts";

function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }

Deno.test("booking reminder windows overlap a fifteen-minute cron cadence", () => {
  assert(REMINDER_WINDOWS.every((window) => window.maxHours - window.minHours >= 0.5), "expected at least a thirty-minute window");
});

Deno.test("24-hour reminder includes localized time and join link", () => {
  const email = buildReminderEmail("24h", {
    name: "Alex", visitor_timezone: "America/New_York", starts_at: "2026-12-10T19:00:00.000Z", zoom_join_url: "https://zoom.example/join",
  }, "planning call");
  const body = email.bodyLines.filter((line) => line !== null).join("\n");
  assert(email.subject.startsWith("Tomorrow:"), "expected the 24-hour subject");
  assert(body.includes("Join link: https://zoom.example/join"), "expected the join link");
  assert(body.includes("America/New York"), "expected a readable timezone");
});

Deno.test("one-hour reminder omits a missing join link", () => {
  const email = buildReminderEmail("1h", {
    name: "Alex", visitor_timezone: "UTC", starts_at: "2026-12-10T19:00:00.000Z",
  }, "planning call");
  assert(!email.bodyLines.some((line) => String(line).startsWith("Join link:")), "did not expect a join link");
});
