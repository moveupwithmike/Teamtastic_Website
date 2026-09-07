// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseAdminMock } from "@/test/supabase-admin-mock";

const { getSupabaseAdmin, redirect, revalidatePath, buildMorningProposals, runOrganicDiscovery, rollSocialMeasurementSnapshot } = vi.hoisted(() => ({
  getSupabaseAdmin: vi.fn(),
  redirect: vi.fn((path) => { throw new Error(`REDIRECT:${path}`); }),
  revalidatePath: vi.fn(),
  buildMorningProposals: vi.fn(),
  runOrganicDiscovery: vi.fn(),
  rollSocialMeasurementSnapshot: vi.fn(),
}));
vi.mock("@/lib/server/supabase-admin", () => ({ getSupabaseAdmin: () => getSupabaseAdmin() }));
vi.mock("@/lib/server/office-auth", () => ({ requireOfficeUser: () => Promise.resolve({ email: "owner@example.com" }) }));
vi.mock("next/navigation", () => ({ redirect: (path) => redirect(path) }));
vi.mock("next/cache", () => ({ revalidatePath: (path) => revalidatePath(path) }));
vi.mock("server-only", () => ({}));
vi.mock("./social-generator", () => ({
  buildMorningProposals: (...args) => buildMorningProposals(...args),
  easternGenerationDate: () => "2026-09-07",
}));
vi.mock("./organic-discovery", () => ({ runOrganicDiscovery: (...args) => runOrganicDiscovery(...args) }));
vi.mock("./social-measurement", () => ({ rollSocialMeasurementSnapshot: (...args) => rollSocialMeasurementSnapshot(...args) }));

import { runDailyAutopilot, toggleOfficeAutopilot, runOfficeAutopilot } from "./autopilot";

function buildAutopilotDb({ enabled = true, masterEnabled = true, existingRun = null, configError = false } = {}) {
  const runInserts = [];
  const runUpdates = [];
  const systemUpdates = [];
  const db = createSupabaseAdminMock({
    tables: {
      system_config: ({ calls }) => {
        if (configError) return { data: null, error: { message: "gone" } };
        if (calls.some((c) => c.method === "update")) {
          systemUpdates.push(calls.find((c) => c.method === "update").args[0]);
          return { data: {}, error: null };
        }
        return { data: { master_enabled: masterEnabled, desk_autopilot_enabled: enabled }, error: null };
      },
      autopilot_runs: ({ calls }) => {
        const insertCall = calls.find((c) => c.method === "insert");
        if (insertCall) {
          runInserts.push(insertCall.args[0]);
          return { data: { id: "ap-1", generation_date: "2026-09-07" }, error: null };
        }
        if (calls.some((c) => c.method === "update")) {
          runUpdates.push(calls.find((c) => c.method === "update").args[0]);
          return { data: {}, error: null };
        }
        if (calls.some((c) => c.method === "eq")) return { data: existingRun, error: null };
        return { data: null, error: null };
      },
    },
  });
  return { db, runInserts, runUpdates, systemUpdates };
}

function stepResults() {
  return {
    generator: { enabled: true, created: 2, generation_date: "2026-09-07" },
    discovery: { enabled: true, status: "completed", records_scanned: 7, records_created: 1 },
    measurement: { ok: true, date: "2026-09-07", snapshots: 3, items_updated: 2 },
  };
}

describe("runDailyAutopilot", () => {
  beforeEach(() => {
    buildMorningProposals.mockReset();
    runOrganicDiscovery.mockReset();
    rollSocialMeasurementSnapshot.mockReset();
    redirect.mockClear();
    revalidatePath.mockClear();
  });

  it("gates the scheduled trigger when the desk autopilot switch is off", async () => {
    const { db } = buildAutopilotDb({ enabled: false });
    const result = await runDailyAutopilot({ db, now: new Date("2026-09-07T12:00:00Z"), trigger: "vercel_cron" });
    expect(result).toMatchObject({ enabled: false, reason: "autopilot_off" });
    expect(buildMorningProposals).not.toHaveBeenCalled();
  });

  it("stops every trigger when the global master switch is off", async () => {
    const { db } = buildAutopilotDb({ enabled: true, masterEnabled: false });
    const result = await runDailyAutopilot({ db, now: new Date("2026-09-07T12:00:00Z"), trigger: "office" });
    expect(result).toMatchObject({ enabled: false, reason: "master_off" });
    expect(buildMorningProposals).not.toHaveBeenCalled();
    expect(runOrganicDiscovery).not.toHaveBeenCalled();
    expect(rollSocialMeasurementSnapshot).not.toHaveBeenCalled();
  });

  it("skips when today's loop already ran", async () => {
    const { db } = buildAutopilotDb({ enabled: true, existingRun: { id: "ap-9", status: "completed" } });
    const result = await runDailyAutopilot({ db, now: new Date("2026-09-07T12:00:00Z"), trigger: "vercel_cron" });
    expect(result).toMatchObject({ enabled: true, skipped: true, reason: "already_ran", status: "completed" });
    expect(buildMorningProposals).not.toHaveBeenCalled();
  });

  it("retries after a failed run instead of skipping the rest of the day", async () => {
    buildMorningProposals.mockResolvedValue(stepResults().generator);
    runOrganicDiscovery.mockResolvedValue(stepResults().discovery);
    rollSocialMeasurementSnapshot.mockResolvedValue(stepResults().measurement);
    const { db, runInserts } = buildAutopilotDb({ enabled: true, existingRun: { id: "ap-5", status: "failed" } });
    const result = await runDailyAutopilot({ db, now: new Date("2026-09-07T12:00:00Z"), trigger: "vercel_cron" });
    expect(result).toMatchObject({ enabled: true, status: "completed" });
    expect(result.skipped).toBeUndefined();
    expect(runInserts.length).toBe(1);
  });

  it("runs the generator, discovery, and measurement and records the loop", async () => {
    buildMorningProposals.mockResolvedValue(stepResults().generator);
    runOrganicDiscovery.mockResolvedValue(stepResults().discovery);
    rollSocialMeasurementSnapshot.mockResolvedValue(stepResults().measurement);
    const { db, runInserts, runUpdates } = buildAutopilotDb({ enabled: true });
    const now = new Date("2026-09-07T12:00:00Z");
    const result = await runDailyAutopilot({ db, now, trigger: "vercel_cron" });
    expect(result).toMatchObject({ enabled: true, generation_date: "2026-09-07", status: "completed", gated: [] });
    expect(result.steps.map((step) => step.step)).toEqual(["morning_generator", "discovery", "measurement"]);
    expect(result.steps[0]).toMatchObject({ step: "morning_generator", created: 2 });
    expect(result.steps[1]).toMatchObject({ step: "discovery", records_created: 1 });
    expect(result.steps[2]).toMatchObject({ step: "measurement", snapshots: 3 });
    expect(runInserts[0]).toMatchObject({ trigger: "vercel_cron", generation_date: "2026-09-07", status: "running" });
    expect(runUpdates[0].status).toBe("completed");
    expect(runUpdates[0].steps).toEqual(result.steps);
    expect(buildMorningProposals).toHaveBeenCalledWith({ db, now, trigger: "vercel_cron" });
    expect(runOrganicDiscovery).toHaveBeenCalledWith({ db, trigger: "vercel_cron" });
    expect(rollSocialMeasurementSnapshot).toHaveBeenCalledWith({ db, date: "2026-09-07" });
  });

  it("marks the loop failed and surfaces the step error", async () => {
    buildMorningProposals.mockResolvedValue(stepResults().generator);
    runOrganicDiscovery.mockRejectedValue(new Error("boom"));
    rollSocialMeasurementSnapshot.mockResolvedValue(stepResults().measurement);
    const { db, runUpdates } = buildAutopilotDb({ enabled: true });
    const result = await runDailyAutopilot({ db, now: new Date("2026-09-07T12:00:00Z"), trigger: "vercel_cron" });
    expect(result.status).toBe("failed");
    expect(result.steps[1]).toMatchObject({ step: "discovery", error: "boom" });
    expect(runUpdates[0].status).toBe("failed");
  });
});

describe("autopilot office actions", () => {
  beforeEach(() => {
    getSupabaseAdmin.mockReset();
    buildMorningProposals.mockReset();
    runOrganicDiscovery.mockReset();
    rollSocialMeasurementSnapshot.mockReset();
    redirect.mockClear();
    revalidatePath.mockClear();
  });

  it("turns the master switch on and redirects to the distribution flash", async () => {
    const { db, systemUpdates } = buildAutopilotDb({ enabled: false });
    getSupabaseAdmin.mockReturnValue(db);
    await expect(toggleOfficeAutopilot({ get: (key) => (key === "enabled" ? "on" : "") })).rejects.toThrow("REDIRECT:/office/distribution?success=autopilot_on");
    expect(redirect).toHaveBeenCalledWith("/office/distribution?success=autopilot_on");
    expect(systemUpdates[0]).toMatchObject({ desk_autopilot_enabled: true });
  });

  it("runs all steps as the owner regardless of the switch", async () => {
    buildMorningProposals.mockResolvedValue(stepResults().generator);
    runOrganicDiscovery.mockResolvedValue(stepResults().discovery);
    rollSocialMeasurementSnapshot.mockResolvedValue(stepResults().measurement);
    const { db } = buildAutopilotDb({ enabled: false });
    getSupabaseAdmin.mockReturnValue(db);
    await expect(runOfficeAutopilot()).rejects.toThrow("REDIRECT:/office/distribution?success=autopilot:completed");
    expect(buildMorningProposals).toHaveBeenCalledWith({ db: expect.any(Object), now: expect.any(Date), trigger: "office" });
  });

  it("redirects to the autopilot failure error when the loop can't start", async () => {
    const { db } = buildAutopilotDb({ enabled: true, configError: true });
    getSupabaseAdmin.mockReturnValue(db);
    await expect(runOfficeAutopilot()).rejects.toThrow("REDIRECT:/office/distribution?error=autopilot_failed");
  });
});
