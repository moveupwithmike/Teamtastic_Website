// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseAdminMock } from "@/test/supabase-admin-mock";

const getSupabaseAdmin = vi.fn();
vi.mock("@/lib/server/supabase-admin", () => ({
  getSupabaseAdmin: () => getSupabaseAdmin(),
}));

const USER = { email: "michael@teamtastic.com" };

function formData(entries) {
  const map = new Map(Object.entries(entries));
  return { get: (key) => map.get(key) ?? null };
}

describe("growth-experiments", () => {
  beforeEach(() => {
    vi.resetModules();
    getSupabaseAdmin.mockReset();
  });

  describe("refreshGrowthBrief", () => {
    it("returns ok on success and audits the outcome", async () => {
      const agentLogInserts = [];
      const supabase = createSupabaseAdminMock({
        tables: { agent_log: ({ calls }) => { agentLogInserts.push(calls[0].args[0]); return { data: null, error: null }; } },
        rpc: { prepare_growth_brief: () => ({ data: { brief_id: "b1" }, error: null }) },
      });
      getSupabaseAdmin.mockReturnValue(supabase);
      const { refreshGrowthBrief } = await import("./growth-experiments");

      const result = await refreshGrowthBrief(USER);
      expect(result).toEqual({ ok: true, errorCode: undefined });
      expect(agentLogInserts[0]).toMatchObject({ action: "refresh_growth_brief", outcome: "completed" });
    });

    it("returns refresh_failed when the RPC errors", async () => {
      const supabase = createSupabaseAdminMock({
        tables: { agent_log: () => ({ data: null, error: null }) },
        rpc: { prepare_growth_brief: () => ({ data: null, error: { message: "db down" } }) },
      });
      getSupabaseAdmin.mockReturnValue(supabase);
      const { refreshGrowthBrief } = await import("./growth-experiments");

      const result = await refreshGrowthBrief(USER);
      expect(result).toEqual({ ok: false, errorCode: "refresh_failed" });
    });
  });

  describe("updateGrowthExperiment", () => {
    it("returns experiment_missing without touching the database when id is absent", async () => {
      const supabase = createSupabaseAdminMock({});
      getSupabaseAdmin.mockReturnValue(supabase);
      const { updateGrowthExperiment } = await import("./growth-experiments");

      const result = await updateGrowthExperiment(USER, formData({}));
      expect(result).toEqual({ ok: false, errorCode: "experiment_missing" });
      expect(supabase.rpc).not.toHaveBeenCalled();
    });

    it("calls complete_growth_experiment for a terminal decision", async () => {
      const supabase = createSupabaseAdminMock({
        tables: { agent_log: () => ({ data: null, error: null }) },
        rpc: { complete_growth_experiment: () => ({ data: { ok: true }, error: null }) },
      });
      getSupabaseAdmin.mockReturnValue(supabase);
      const { updateGrowthExperiment } = await import("./growth-experiments");

      const result = await updateGrowthExperiment(USER, formData({ id: "exp_1", decision: "adopt" }));
      expect(result).toEqual({ ok: true, errorCode: undefined });
      expect(supabase.rpc).toHaveBeenCalledWith("complete_growth_experiment", expect.objectContaining({ p_experiment_id: "exp_1", p_decision: "adopt" }));
    });

    it("calls record_growth_experiment_transition for a non-terminal decision", async () => {
      const supabase = createSupabaseAdminMock({
        tables: { agent_log: () => ({ data: null, error: null }) },
        rpc: { record_growth_experiment_transition: () => ({ data: { ok: true }, error: null }) },
      });
      getSupabaseAdmin.mockReturnValue(supabase);
      const { updateGrowthExperiment } = await import("./growth-experiments");

      const result = await updateGrowthExperiment(USER, formData({ id: "exp_1", decision: "approve" }));
      expect(result).toEqual({ ok: true, errorCode: undefined });
      expect(supabase.rpc).toHaveBeenCalledWith("record_growth_experiment_transition", expect.objectContaining({ p_experiment_id: "exp_1", p_decision: "approve" }));
    });

    it("returns experiment_update_failed when the RPC errors", async () => {
      const supabase = createSupabaseAdminMock({
        tables: { agent_log: () => ({ data: null, error: null }) },
        rpc: { complete_growth_experiment: () => ({ data: null, error: { message: "conflict" } }) },
      });
      getSupabaseAdmin.mockReturnValue(supabase);
      const { updateGrowthExperiment } = await import("./growth-experiments");

      const result = await updateGrowthExperiment(USER, formData({ id: "exp_1", decision: "stop" }));
      expect(result).toEqual({ ok: false, errorCode: "experiment_update_failed" });
    });
  });
});
