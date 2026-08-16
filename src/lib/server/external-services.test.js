// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createClient = vi.fn();
const createServerClient = vi.fn();
const cookieStore = { getAll: vi.fn(() => []), set: vi.fn() };
vi.mock("@supabase/supabase-js", () => ({ createClient: (...args) => createClient(...args) }));
vi.mock("@supabase/ssr", () => ({ createServerClient: (...args) => createServerClient(...args) }));
vi.mock("next/headers", () => ({ cookies: () => Promise.resolve(cookieStore) }));

describe("external service adapters", () => {
  const originalEnv = { ...process.env };
  beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); });
  afterEach(() => { process.env = { ...originalEnv }; vi.unstubAllGlobals(); });

  it("creates privileged and cookie-aware Supabase clients", async () => {
    Object.assign(process.env, { NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "service", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable" });
    createClient.mockReturnValue({ admin: true });
    createServerClient.mockReturnValue({ server: true });
    const { getSupabaseAdmin } = await import("./supabase-admin");
    const { createSupabaseServerClient } = await import("../supabase/server");
    expect(getSupabaseAdmin()).toEqual({ admin: true });
    expect(await createSupabaseServerClient()).toEqual({ server: true });
    const options = createServerClient.mock.calls[0][2];
    options.cookies.setAll([{ name: "session", value: "x", options: { secure: true } }]);
    expect(cookieStore.set).toHaveBeenCalled();
  });

  it("rejects missing Supabase credentials", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const { getSupabaseAdmin } = await import("./supabase-admin");
    expect(() => getSupabaseAdmin()).toThrow("not configured");
  });

  it("exchanges Google credentials and maps busy ranges", async () => {
    Object.assign(process.env, { GOOGLE_CALENDAR_CLIENT_ID: "id", GOOGLE_CALENDAR_CLIENT_SECRET: "secret", GOOGLE_CALENDAR_REFRESH_TOKEN: "refresh" });
    const fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "token" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ calendars: { primary: { busy: [{ start: "2026-12-01T10:00:00Z", end: "2026-12-01T11:00:00Z" }] } } }) });
    vi.stubGlobal("fetch", fetch);
    const { getCalendarBusyRanges } = await import("./google-calendar");
    const ranges = await getCalendarBusyRanges({ calendarId: "primary", timeMin: "a", timeMax: "b", timeZone: "UTC" });
    expect(ranges[0].start).toBeInstanceOf(Date);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("creates and cancels Zoom meetings", async () => {
    Object.assign(process.env, { ZOOM_ACCOUNT_ID: "acct", ZOOM_CLIENT_ID: "id", ZOOM_CLIENT_SECRET: "secret" });
    const fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "token" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 42, join_url: "https://zoom.test/join" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "token" }) })
      .mockResolvedValueOnce({ ok: true });
    vi.stubGlobal("fetch", fetch);
    const { createZoomMeeting, cancelZoomMeeting } = await import("./zoom");
    expect(await createZoomMeeting({ topic: "Planning", startsAt: "2026-12-01T10:00:00Z", durationMinutes: 60, timezone: "UTC", hostEmail: "host@example.com" })).toEqual({ meetingId: "42", joinUrl: "https://zoom.test/join" });
    await expect(cancelZoomMeeting("42")).resolves.toBeUndefined();
  });

  it("scores intent, creates stable fingerprints, and drafts tracked help", async () => {
    const { scoreOrganicIntent, organicFingerprint, createHelpfulDraft } = await import("./organic-intent");
    expect(scoreOrganicIntent("Virtual holiday event", "Need a vendor for 100 people in December").score).toBeGreaterThan(50);
    expect(organicFingerprint(" HTTPS://EXAMPLE.COM ", " Hello ")).toBe(organicFingerprint("https://example.com", "hello"));
    expect(createHelpfulDraft({ excerpt: "holiday team", recommendedPage: "/party", trackingToken: "abc" }).trackedUrl).toContain("/party?");
  });

  it("verifies Turnstile responses and local bypass", async () => {
    delete process.env.TURNSTILE_SECRET_KEY;
    Object.defineProperty(process.env, "NODE_ENV", { configurable: true, value: "test" });
    const { verifyTurnstile } = await import("./turnstile");
    expect(await verifyTurnstile("development-bypass")).toBe(true);
    process.env.TURNSTILE_SECRET_KEY = "secret";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => ({ success: true }) }));
    expect(await verifyTurnstile("token", "127.0.0.1")).toBe(true);
  });

  it("captures PostHog server events only when configured", async () => {
    const capture = vi.fn(), flush = vi.fn();
    vi.doMock("posthog-node", () => ({ PostHog: vi.fn().mockImplementation(function PostHogMock() { return { capture, flush }; }) }));
    process.env.NEXT_PUBLIC_POSTHOG_KEY = "ph_test";
    const { captureServerEvent } = await import("./posthog");
    await captureServerEvent("saved", 123, { safe: true });
    expect(capture).toHaveBeenCalledWith({ distinctId: "123", event: "saved", properties: { safe: true } });
    expect(flush).toHaveBeenCalled();
  });
});
