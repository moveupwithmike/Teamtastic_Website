// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseAdminMock } from "@/test/supabase-admin-mock";

const getSupabaseAdmin = vi.fn();
const audit = vi.fn();
const redirect = vi.fn((path) => { throw new Error(`REDIRECT:${path}`); });
vi.mock("@/lib/server/supabase-admin", () => ({ getSupabaseAdmin: () => getSupabaseAdmin() }));
vi.mock("@/lib/server/office-auth", () => ({ requireOfficeUser: () => Promise.resolve({ email: "owner@example.com" }) }));
vi.mock("./shared", () => ({ audit: (...args) => audit(...args), clean: (value, limit) => String(value ?? "").trim().slice(0, limit) }));
vi.mock("next/navigation", () => ({ redirect: (path) => redirect(path) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const formData = (entries) => ({ get: (key) => entries[key] ?? null });

describe("configuration success paths", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("persists the system-wide prospecting switches and explicitly resumes sending", async () => {
    const updates = [];
    const db = createSupabaseAdminMock({
      tables: {
        system_config: ({ calls }) => {
          updates.push(calls.find((call) => call.method === "update")?.args[0]);
          return { data: null, error: null };
        },
      },
    });
    getSupabaseAdmin.mockReturnValue(db);
    const { updateSystemConfig } = await import("./configuration");

    await expect(updateSystemConfig(formData({
      settings_scope: "prospecting",
      prospecting_from_email: "sales@example.com",
      prospecting_enabled: "on",
      sequence_followups_enabled: "on",
      daily_prospecting_cap: "999",
      resume_sending: "on",
    }))).rejects.toThrow("/office/settings?success=1");

    expect(updates[0]).toEqual({
      prospecting_from_email: "sales@example.com",
      prospecting_enabled: true,
      daily_prospecting_cap: 500,
      sequence_followups_enabled: true,
      updated_by: "owner@example.com",
      outbound_auto_paused: false,
    });
    expect(audit).toHaveBeenCalledWith("update_system_config", expect.anything(), updates[0], null, "completed", undefined);
  });

  it("keeps Reddit research disabled until commercial approval is confirmed", async () => {
    const sourceUpdates = [];
    const db = createSupabaseAdminMock({
      tables: {
        system_config: () => ({ data: null, error: null }),
        organic_sources: ({ calls }) => {
          sourceUpdates.push(calls.find((call) => call.method === "update")?.args[0]);
          return { data: null, error: null };
        },
      },
    });
    getSupabaseAdmin.mockReturnValue(db);
    const { updateSystemConfig } = await import("./configuration");

    await expect(updateSystemConfig(formData({
      settings_scope: "organic",
      organic_research_enabled: "on",
      organic_scoring_enabled: "on",
      organic_daily_opportunity_cap: "25",
      organic_min_draft_score: "80",
    }))).rejects.toThrow("/office/settings?success=1");

    expect(sourceUpdates[0]).toMatchObject({ enabled: false });
  });
});
