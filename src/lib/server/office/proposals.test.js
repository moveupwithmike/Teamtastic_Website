// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseAdminMock } from "@/test/supabase-admin-mock";

const getSupabaseAdmin = vi.fn();
const sendViaResend = vi.fn();
const redirect = vi.fn((path) => { throw new Error(`REDIRECT:${path}`); });

vi.mock("@/lib/server/supabase-admin", () => ({ getSupabaseAdmin: () => getSupabaseAdmin() }));
vi.mock("@/lib/server/office-auth", () => ({ requireOfficeUser: () => Promise.resolve({ email: "owner@example.com" }) }));
vi.mock("@/lib/server/email", () => ({ sendViaResend: (...args) => sendViaResend(...args) }));
vi.mock("next/navigation", () => ({ redirect: (path) => redirect(path) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const formData = (entries) => ({ get: (key) => entries[key] ?? null });

describe("approveAndSendProposal", () => {
  beforeEach(() => {
    vi.resetModules();
    getSupabaseAdmin.mockReset();
    sendViaResend.mockReset();
    redirect.mockClear();
    process.env.RESEND_API_KEY = "test-key";
    process.env.RESEND_FROM_EMAIL = "hello@example.com";
  });

  it("uses the shared email helper with a stable proposal idempotency key", async () => {
    const proposal = { id: "proposal_1", prospect_id: "prospect_1", recipient_email: "buyer@example.com", status: "draft" };
    const db = createSupabaseAdminMock({
      tables: {
        proposals: ({ calls }) => calls.some((call) => call.method === "select" && call.args[0] === "id")
          ? { data: { id: "proposal_1" }, error: null }
          : calls.some((call) => call.method === "update")
          ? { data: null, error: null }
          : { data: proposal, error: null },
        agent_log: () => ({ data: null, error: null }),
      },
      rpc: { finalize_proposal_send: () => ({ data: { finalized: true }, error: null }) },
    });
    getSupabaseAdmin.mockReturnValue(db);
    sendViaResend.mockResolvedValue({ reserved: true, sent: true, providerMessageId: "msg_1", reason: null });
    const { approveAndSendProposal } = await import("./proposals");

    await expect(approveAndSendProposal(formData({ id: "proposal_1", subject: "Proposal", body_text: "Details" })))
      .rejects.toThrow("REDIRECT:/office?success=proposal_sent");
    expect(sendViaResend).toHaveBeenCalledWith(db, expect.objectContaining({
      messageType: "proposal",
      recipient: "buyer@example.com",
      idempotencyKey: "proposal/proposal_1",
    }));
    expect(db.rpc).toHaveBeenCalledWith("finalize_proposal_send", expect.objectContaining({ p_provider_message_id: "msg_1" }));
  });

  it("restores the proposal to draft when reservation is blocked", async () => {
    const updates = [];
    const db = createSupabaseAdminMock({
      tables: {
        proposals: ({ calls }) => {
          const update = calls.find((call) => call.method === "update");
          if (update) {
            updates.push(update.args[0]);
            return calls.some((call) => call.method === "select") ? { data: { id: "proposal_1" }, error: null } : { data: null, error: null };
          }
          return { data: { id: "proposal_1", prospect_id: "p1", recipient_email: "buyer@example.com", status: "draft" }, error: null };
        },
        agent_log: () => ({ data: null, error: null }),
      },
    });
    getSupabaseAdmin.mockReturnValue(db);
    sendViaResend.mockResolvedValue({ reserved: false, sent: false, providerMessageId: null, reason: "daily_cap" });
    const { approveAndSendProposal } = await import("./proposals");

    await expect(approveAndSendProposal(formData({ id: "proposal_1", subject: "Proposal", body_text: "Details" })))
      .rejects.toThrow("REDIRECT:/office?error=proposal_send_blocked");
    expect(updates).toContainEqual({ status: "draft", last_error: "daily_cap" });
  });
});
