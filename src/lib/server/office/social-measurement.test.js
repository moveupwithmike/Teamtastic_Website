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

import { refreshSocialMeasurement } from "./social-measurement";

describe("refreshSocialMeasurement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSupabaseAdmin.mockReset();
  });

  function dbWith({ rpcResult, agentLogInserts }) {
    return createSupabaseAdminMock({
      rpc: {
        refresh_social_measurement: (args) => {
          rpcResult.args = args;
          return rpcResult.value;
        },
      },
      tables: {
        agent_log: ({ calls }) => {
          agentLogInserts.push(...calls.filter((c) => c.method === "insert").map((c) => c.args[0]));
          return { data: null, error: null };
        },
      },
    });
  }

  it("calls the rollup RPC for the current Eastern date and redirects to success", async () => {
    const agentLogInserts = [];
    const rpcResult = { value: { data: { snapshots: 4, items_updated: 3 }, error: null } };
    const db = dbWith({ rpcResult, agentLogInserts });
    getSupabaseAdmin.mockReturnValue(db);

    await expect(refreshSocialMeasurement()).rejects.toThrow("REDIRECT:/office/distribution?success=measured");
    expect(rpcResult.args).toMatchObject({ p_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) });
    expect(agentLogInserts).toEqual([expect.objectContaining({ action: "refresh_social_measurement", outcome: "completed" })]);
    expect(revalidatePath).toHaveBeenCalledWith("/office/distribution");
  });

  it("redirects to an error and audits a failed run when the RPC fails", async () => {
    const agentLogInserts = [];
    const rpcResult = { value: { data: null, error: { message: "down" } } };
    const db = dbWith({ rpcResult, agentLogInserts });
    getSupabaseAdmin.mockReturnValue(db);

    await expect(refreshSocialMeasurement()).rejects.toThrow("REDIRECT:/office/distribution?error=measurement_failed");
    expect(agentLogInserts).toEqual([expect.objectContaining({ action: "refresh_social_measurement", outcome: "failed", error: "measurement_failed" })]);
  });
});
