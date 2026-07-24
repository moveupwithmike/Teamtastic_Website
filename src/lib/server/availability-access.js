import { createHmac, timingSafeEqual } from "node:crypto";

export const AVAILABILITY_COOKIE = "teamtastic_availability_access";

function secret() {
  return process.env.AVAILABILITY_ACCESS_SECRET
    || process.env.TURNSTILE_SECRET_KEY
    || (process.env.NODE_ENV !== "production" ? "teamtastic-development-availability" : "");
}

export function createAvailabilityAccess() {
  const issuedAt = Date.now().toString();
  const signature = createHmac("sha256", secret()).update(issuedAt).digest("hex");
  return `${issuedAt}.${signature}`;
}

export function validAvailabilityAccess(value, maxAgeMs = 15 * 60 * 1000) {
  if (!value || !secret()) return false;
  const [issuedAt, supplied] = String(value).split(".");
  if (!issuedAt || !supplied || !/^\d+$/.test(issuedAt) || Date.now() - Number(issuedAt) > maxAgeMs) return false;
  const expected = createHmac("sha256", secret()).update(issuedAt).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(supplied);
  return a.length === b.length && timingSafeEqual(a, b);
}
