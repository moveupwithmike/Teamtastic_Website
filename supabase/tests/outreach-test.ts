import { easternSendingTime, emailDomain, withinSendingWindow } from "../functions/_shared/outreach.ts";

function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }

Deno.test("outreach sending window follows Eastern business hours", () => {
  assert(withinSendingWindow(new Date("2026-08-17T14:00:00.000Z")), "Monday at 10am ET should be allowed");
  assert(!withinSendingWindow(new Date("2026-08-17T22:00:00.000Z")), "Monday at 6pm ET should be blocked");
  assert(!withinSendingWindow(new Date("2026-08-16T14:00:00.000Z")), "Sunday should be blocked");
  assert(easternSendingTime(new Date("2026-08-17T04:00:00.000Z")).hour === 0, "midnight should normalize to zero");
});

Deno.test("emailDomain normalizes valid domains and rejects malformed addresses", () => {
  assert(emailDomain("Person@Example.COM") === "example.com", "expected a lowercase domain");
  assert(emailDomain("invalid") === null, "expected malformed email to return null");
});
