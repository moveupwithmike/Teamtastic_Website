// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const runDailyAutopilot = vi.fn();
const db = { private: true };
vi.mock("@/lib/server/supabase-admin", () => ({ getSupabaseAdmin: () => db }));
vi.mock("@/lib/server/office/autopilot", () => ({
  runDailyAutopilot: (...args) => runDailyAutopilot(...args),
}));

function request(secret = "test-secret") {
  return new Request("https://www.teamtastic.events/api/cron/autopilot", {
    headers: { authorization: `Bearer ${secret}` },
  });
}

describe("daily autopilot Cron", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.stubEnv("CRON_SECRET", "test-secret");
    runDailyAutopilot.mockReset();
  });

  it("recognizes 7:10 Eastern across daylight-saving time", async () => {
    const { isEasternAutopilotWindow } = await import("@/lib/server/office/cron-windows");
    expect(isEasternAutopilotWindow(new Date("2026-07-10T11:10:00Z"))).toBe(true);
    expect(isEasternAutopilotWindow(new Date("2026-01-10T12:10:00Z"))).toBe(true);
    expect(isEasternAutopilotWindow(new Date("2026-07-10T12:10:00Z"))).toBe(false);
  });

  it("requires Vercel's protected bearer secret", async () => {
    const { GET } = await import("./route");
    const response = await GET(request("wrong"));
    expect(response.status).toBe(401);
    expect(runDailyAutopilot).not.toHaveBeenCalled();
  });

  it("skips the extra daylight-saving invocation", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-10T12:10:00Z"));
    const { GET } = await import("./route");
    const response = await GET(request());
    expect(await response.json()).toMatchObject({ success: true, skipped: true });
    expect(runDailyAutopilot).not.toHaveBeenCalled();
  });

  it("runs the review-only loop at 7:10 Eastern when the switch is on", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-10T12:10:00Z"));
    runDailyAutopilot.mockResolvedValue({ enabled: true, status: "completed", generation_date: "2026-01-10" });
    const { GET } = await import("./route");
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, status: "completed" });
    expect(runDailyAutopilot).toHaveBeenCalledWith({ db, now: expect.any(Date), trigger: "vercel_cron" });
  });
});
