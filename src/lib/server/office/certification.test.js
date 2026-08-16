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

describe("certification success paths", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("starts a certification run with three isolated synthetic leads", async () => {
    const leadRows = [];
    const runUpdates = [];
    const db = createSupabaseAdminMock({
      tables: {
        b2b_certification_runs: ({ calls }) => {
          const update = calls.find((call) => call.method === "update");
          if (update) runUpdates.push(update.args[0]);
          return calls.some((call) => call.method === "insert")
            ? { data: { id: "12345678-abcd-4000-8000-123456789abc" }, error: null }
            : { data: null, error: null };
        },
        leads: ({ calls }) => {
          const insert = calls.find((call) => call.method === "insert");
          if (insert) leadRows.push(...insert.args[0]);
          return { data: [{ id: "lead_1" }, { id: "lead_2" }, { id: "lead_3" }], error: null };
        },
      },
    });
    getSupabaseAdmin.mockReturnValue(db);
    const { startB2bCertification } = await import("./certification");

    await expect(startB2bCertification()).rejects.toThrow("success=started");
    expect(leadRows).toHaveLength(3);
    expect(new Set(leadRows.map((lead) => lead.submission_id)).size).toBe(3);
    expect(leadRows.every((lead) => lead.context.external_send === false)).toBe(true);
    expect(runUpdates).toContainEqual({ lead_ids: ["lead_1", "lead_2", "lead_3"] });
    expect(audit).toHaveBeenCalledWith("start_b2b_certification", expect.anything(), expect.objectContaining({ synthetic_test: true, external_send: false }));
  });

  it("records a successful compliance attestation with the acting user", async () => {
    const db = createSupabaseAdminMock({
      rpc: { record_final_certification_attestation: () => ({ data: { recorded: true }, error: null }) },
    });
    getSupabaseAdmin.mockReturnValue(db);
    const { recordFinalCertificationAttestation } = await import("./certification");
    const formData = { get: (key) => ({ id: "cert_1", evidence_key: "payments", notes: "Verified", passed: "on" })[key] ?? null };

    await expect(recordFinalCertificationAttestation(formData)).rejects.toThrow("success=attestation_recorded");
    expect(db.rpc).toHaveBeenCalledWith("record_final_certification_attestation", {
      p_certification_id: "cert_1",
      p_evidence_key: "payments",
      p_passed: true,
      p_notes: "Verified",
      p_actor: "owner@example.com",
    });
  });
});
