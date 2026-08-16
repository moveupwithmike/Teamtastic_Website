// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
const getSupabaseAdmin = vi.fn();
vi.mock("@/lib/server/supabase-admin", () => ({ getSupabaseAdmin: () => getSupabaseAdmin() }));

describe("office shared helpers", () => {
  it("cleans strings and validates non-negative money", async () => {
    const { clean, money } = await import("./shared");
    expect(clean("  example  ", 4)).toBe("exam");
    expect(money("12.50")).toBe(12.5);
    expect(money("invalid")).toBeNull();
    expect(money(-1)).toBeNull();
  });

  it("writes an attributed office audit record", async () => {
    const insert = vi.fn(() => Promise.resolve({ error: null }));
    getSupabaseAdmin.mockReturnValue({ from: vi.fn(() => ({ insert })) });
    const { audit } = await import("./shared");
    await audit("review", { email: "owner@example.com" }, { id: 1 }, "prospect_1", "failed", "problem");
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ action: "review", prospect_id: "prospect_1", decision: { id: 1, actor: "owner@example.com" }, error: "problem" }));
  });
});
