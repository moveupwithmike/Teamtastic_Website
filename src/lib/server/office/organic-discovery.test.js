// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseAdminMock } from "@/test/supabase-admin-mock";

const { getSupabaseAdmin, redirect, revalidatePath } = vi.hoisted(() => ({
  getSupabaseAdmin: vi.fn(),
  redirect: vi.fn((path) => { throw new Error(`REDIRECT:${path}`); }),
  revalidatePath: vi.fn(),
}));
vi.mock("@/lib/server/supabase-admin", () => ({ getSupabaseAdmin: () => getSupabaseAdmin() }));
vi.mock("@/lib/server/office-auth", () => ({ requireOfficeUser: () => Promise.resolve({ email: "owner@example.com" }) }));
vi.mock("next/navigation", () => ({ redirect: (path) => redirect(path) }));
vi.mock("next/cache", () => ({ revalidatePath: (path) => revalidatePath(path) }));
vi.mock("server-only", () => ({}));

import { discoveryGateReason, runOrganicDiscovery, runOrganicDiscoveryAction } from "./organic-discovery";

function config(overrides = {}) {
  return {
    master_enabled: true,
    organic_reddit_commercial_approval_confirmed: true,
    organic_research_enabled: true,
    organic_scoring_enabled: true,
    ...overrides,
  };
}

function buildDb({ settings = config(), configError = null, invokeResult = { data: {}, error: null } } = {}) {
  const db = createSupabaseAdminMock({
    tables: {
      system_config: { data: settings, error: configError },
    },
  });
  db.functions = { invoke: vi.fn(async () => invokeResult) };
  return db;
}

describe("discovery safety gates", () => {
  it.each([
    [{ master_enabled: false }, "master_off"],
    [{ organic_reddit_commercial_approval_confirmed: false }, "reddit_commercial_approval_not_confirmed"],
    [{ organic_research_enabled: false }, "discovery_off"],
    [{ organic_scoring_enabled: false }, "scoring_off"],
  ])("stops before invoking Reddit when %o", async (override, reason) => {
    const db = buildDb({ settings: config(override) });
    expect(discoveryGateReason(config(override))).toBe(reason);
    await expect(runOrganicDiscovery({ db, trigger: "vercel_cron" })).resolves.toMatchObject({ enabled: false, reason, status: "skipped" });
    expect(db.functions.invoke).not.toHaveBeenCalled();
  });

  it("fails closed when configuration cannot be read", async () => {
    const db = buildDb({ settings: null, configError: { message: "unavailable" } });
    await expect(runOrganicDiscovery({ db })).resolves.toMatchObject({ enabled: false, reason: "discovery_config_unavailable" });
    expect(db.functions.invoke).not.toHaveBeenCalled();
  });
});

describe("authenticated collector delegation", () => {
  it("invokes the established Edge Function and normalizes its result", async () => {
    const db = buildDb({ invokeResult: { data: { scanned: 20, created: 3, duplicates: 2, filtered: 15 }, error: null } });
    await expect(runOrganicDiscovery({ db, trigger: "office" })).resolves.toEqual({
      enabled: true,
      status: "completed",
      records_scanned: 20,
      records_created: 3,
      duplicates: 2,
      filtered: 15,
    });
    expect(db.functions.invoke).toHaveBeenCalledWith("collect-organic-opportunities", {
      body: { trigger: "office", requested_by: "teamtastic-office" },
    });
  });

  it("surfaces a collector failure without falling back to anonymous Reddit", async () => {
    const db = buildDb({ invokeResult: { data: null, error: { message: "unauthorized" } } });
    await expect(runOrganicDiscovery({ db })).resolves.toMatchObject({ enabled: false, reason: "discovery_failed", status: "failed" });
    expect(db.functions.invoke).toHaveBeenCalledTimes(1);
  });

  it("preserves the Edge Function's protected skip result", async () => {
    const db = buildDb({ invokeResult: { data: { skipped: true, reason: "daily_cap_reached" }, error: null } });
    await expect(runOrganicDiscovery({ db })).resolves.toMatchObject({ enabled: false, reason: "daily_cap_reached", status: "skipped" });
  });
});

describe("runOrganicDiscoveryAction", () => {
  beforeEach(() => {
    getSupabaseAdmin.mockReset();
    redirect.mockClear();
    revalidatePath.mockClear();
  });

  it("explains when a safety gate is off", async () => {
    getSupabaseAdmin.mockReturnValue(buildDb({ settings: config({ organic_scoring_enabled: false }) }));
    await expect(runOrganicDiscoveryAction()).rejects.toThrow("REDIRECT:/office/organic?success=discovery:scoring_off");
  });

  it("lands on a count after the authenticated collector completes", async () => {
    getSupabaseAdmin.mockReturnValue(buildDb({ invokeResult: { data: { scanned: 9, created: 2 }, error: null } }));
    await expect(runOrganicDiscoveryAction()).rejects.toThrow("REDIRECT:/office/organic?success=discovery_completed:2");
  });
});
