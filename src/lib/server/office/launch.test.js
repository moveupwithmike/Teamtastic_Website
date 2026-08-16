// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseAdminMock } from "@/test/supabase-admin-mock";

const getSupabaseAdmin = vi.fn();
const redirect = vi.fn((path) => { throw new Error(`REDIRECT:${path}`); });
vi.mock("@/lib/server/supabase-admin", () => ({ getSupabaseAdmin: () => getSupabaseAdmin() }));
vi.mock("@/lib/server/office-auth", () => ({ requireOfficeUser: () => Promise.resolve({ email: "owner@example.com" }) }));
vi.mock("next/navigation", () => ({ redirect: (path) => redirect(path) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const formData = (entries) => ({ get: (key) => entries[key] ?? null });

describe("transitionB2bLaunch", () => {
  beforeEach(() => { vi.resetModules(); getSupabaseAdmin.mockReset(); });

  it("rejects unknown launch transitions before a database mutation", async () => {
    const db = createSupabaseAdminMock({});
    getSupabaseAdmin.mockReturnValue(db);
    const { transitionB2bLaunch } = await import("./launch");
    await expect(transitionB2bLaunch(formData({ launch_action: "destroy" }))).rejects.toThrow("invalid_action");
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it("caps the outbound daily limit before calling the transition RPC", async () => {
    const db = createSupabaseAdminMock({
      tables: { agent_log: () => ({ data: null, error: null }) },
      rpc: { transition_b2b_launch: () => ({ data: { changed: true }, error: null }) },
    });
    getSupabaseAdmin.mockReturnValue(db);
    const { transitionB2bLaunch } = await import("./launch");
    await expect(transitionB2bLaunch(formData({ launch_action: "enable_outbound", daily_cap: "999" }))).rejects.toThrow("success=enable_outbound");
    expect(db.rpc).toHaveBeenCalledWith("transition_b2b_launch", expect.objectContaining({ p_daily_cap: 10 }));
  });
});
