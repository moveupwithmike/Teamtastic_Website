// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AVAILABILITY_COOKIE, validAvailabilityAccess } from "@/lib/server/availability-access";

async function postAccess(body, headers = {}) {
  const { POST } = await import("./route.js");
  const request = new Request("https://teamtastic.com/api/bookings/availability-access", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  return POST(request);
}

describe("availability access", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.TURNSTILE_SECRET_KEY; // enables the development-bypass path
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("rejects when bot verification fails", async () => {
    const response = await postAccess(
      { turnstileToken: "not-the-bypass-token" },
      { "x-forwarded-for": "203.0.113.21" },
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.reason).toBe("bot_verification_failed");
  });

  it("rate-limits repeated attempts from the same IP", async () => {
    const ip = `203.0.113.${22 + Math.floor(Math.random() * 50)}`;
    let last;
    for (let i = 0; i < 6; i += 1) {
      last = await postAccess({ turnstileToken: "development-bypass" }, { "x-forwarded-for": ip });
    }
    expect(last.status).toBe(429);
  });

  it("issues a signed, httpOnly access cookie scoped to the availability endpoint", async () => {
    const response = await postAccess(
      { turnstileToken: "development-bypass" },
      { "x-forwarded-for": "203.0.113.30" },
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);

    const cookie = response.cookies.get(AVAILABILITY_COOKIE);
    expect(cookie).toBeTruthy();
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.sameSite).toBe("lax");
    expect(cookie.path).toBe("/api/bookings/availability");
    expect(cookie.maxAge).toBe(15 * 60);
    expect(validAvailabilityAccess(cookie.value)).toBe(true);
  });
});
