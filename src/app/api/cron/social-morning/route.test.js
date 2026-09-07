// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const buildMorningProposals = vi.fn();
const db = { private: true };
vi.mock("@/lib/server/supabase-admin", () => ({ getSupabaseAdmin: () => db }));
vi.mock("@/lib/server/office/social-generator", () => ({
  buildMorningProposals: (...args) => buildMorningProposals(...args),
}));

function request(secret = "test-secret") {
  return new Request("https://www.teamtastic.events/api/cron/social-morning", {
    headers: { authorization: `Bearer ${secret}` },
  });
}

describe("morning social Cron", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.stubEnv("CRON_SECRET", "test-secret");
    buildMorningProposals.mockReset();
  });

  it("recognizes 8:10 Eastern across daylight-saving time", async () => {
    const { isEasternMorningWindow } = await import("@/lib/server/office/cron-windows");
    expect(isEasternMorningWindow(new Date("2026-07-10T12:10:00Z"))).toBe(true);
    expect(isEasternMorningWindow(new Date("2026-01-10T13:10:00Z"))).toBe(true);
    expect(isEasternMorningWindow(new Date("2026-07-10T13:10:00Z"))).toBe(false);
  });

  it("requires Vercel's protected bearer secret", async () => {
    const { GET } = await import("./route");
    const response = await GET(request("wrong"));
    expect(response.status).toBe(401);
    expect(buildMorningProposals).not.toHaveBeenCalled();
  });

  it("skips the extra daylight-saving invocation", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-10T13:10:00Z"));
    const { GET } = await import("./route");
    const response = await GET(request());
    expect(await response.json()).toMatchObject({ success: true, skipped: true });
    expect(buildMorningProposals).not.toHaveBeenCalled();
  });

  it("creates review-only proposals at 8:10 Eastern", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-10T12:10:00Z"));
    buildMorningProposals.mockResolvedValue({ enabled: true, created: 3, generation_date: "2026-07-10" });
    const { GET } = await import("./route");
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, created: 3 });
    expect(buildMorningProposals).toHaveBeenCalledWith({ db, now: expect.any(Date), trigger: "vercel_cron" });
  });
});
