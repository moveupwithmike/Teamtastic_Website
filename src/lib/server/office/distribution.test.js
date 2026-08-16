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

describe("reviewDistributionItem", () => {
  beforeEach(() => { vi.resetModules(); getSupabaseAdmin.mockReset(); });

  it("requires a date before scheduling an approved item", async () => {
    const db = createSupabaseAdminMock({ tables: { distribution_items: () => ({ data: { id: "item_1", status: "approved" }, error: null }) } });
    getSupabaseAdmin.mockReturnValue(db);
    const { reviewDistributionItem } = await import("./distribution");
    await expect(reviewDistributionItem(formData({ id: "item_1", decision: "schedule" }))).rejects.toThrow("schedule_required");
  });

  it("prepares a queue without enabling automatic publishing", async () => {
    const logs = [];
    const db = createSupabaseAdminMock({
      tables: { agent_log: ({ calls }) => { logs.push(calls[0].args[0]); return { data: null, error: null }; } },
      rpc: { prepare_distribution_queue: () => ({ data: { count: 2 }, error: null }) },
    });
    getSupabaseAdmin.mockReturnValue(db);
    const { prepareDistributionQueue } = await import("./distribution");
    await expect(prepareDistributionQueue()).rejects.toThrow("success=prepared");
    expect(logs[0].decision).toMatchObject({ automatic_publishing: false });
  });

  it.each([
    ["approve", "draft", { body_text: "Approved copy" }, "approved"],
    ["reject", "draft", {}, "rejected"],
    ["published", "scheduled", { published_url: "https://example.com/post" }, "published"],
  ])("applies the %s transition", async (decision, status, extra, expectedStatus) => {
    let update;
    const db = createSupabaseAdminMock({ tables: {
      distribution_items: ({ calls }) => {
        const call = calls.find(c => c.method === "update");
        if (call) update = call.args[0];
        return { data: { id: "item_1", status }, error: null };
      },
      agent_log: () => ({ data: null, error: null }),
    } });
    getSupabaseAdmin.mockReturnValue(db);
    const { reviewDistributionItem } = await import("./distribution");
    await expect(reviewDistributionItem(formData({ id: "item_1", decision, ...extra }))).rejects.toThrow("success=updated");
    expect(update).toMatchObject({ status: expectedStatus });
  });

  it("rejects invalid transitions and missing items", async () => {
    getSupabaseAdmin.mockReturnValue(createSupabaseAdminMock({ tables: { distribution_items: { data: null, error: null } } }));
    const { reviewDistributionItem } = await import("./distribution");
    await expect(reviewDistributionItem(formData({ id: "missing", decision: "approve" }))).rejects.toThrow("error=missing");
  });
});
