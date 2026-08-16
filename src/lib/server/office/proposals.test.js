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

  it("records a successful post-call outcome", async () => {
    const db = createSupabaseAdminMock({
      tables: { agent_log: () => ({ data: null, error: null }) },
      rpc: { apply_post_call_outcome: () => ({ data: { updated: true }, error: null }) },
    });
    getSupabaseAdmin.mockReturnValue(db);
    const { recordCallOutcome } = await import("./proposals");

    await expect(recordCallOutcome(formData({ booking_id: "book_1", outcome: "qualified", budget: "2500", package_name: "Hosted" })))
      .rejects.toThrow("REDIRECT:/office?success=outcome_saved");
    expect(db.rpc).toHaveBeenCalledWith("apply_post_call_outcome", expect.objectContaining({ p_booking_id: "book_1", p_budget_amount: 2500 }));
  });

  it("creates a proposal and its tokenized payment request", async () => {
    const inserts = {};
    const db = createSupabaseAdminMock({ tables: {
      deals: () => ({ data: { id: "deal_1", prospect_id: "prospect_1", prospects: { email: "buyer@example.com", full_name: "Jamie Buyer" } }, error: null }),
      leads: () => ({ data: null, error: null }),
      event_capacity_holds: () => ({ data: null, error: null }),
      proposals: ({ calls }) => { const insert = calls.find(c => c.method === "insert"); if (insert) inserts.proposal = insert.args[0]; return { data: { id: "proposal_1" }, error: null }; },
      payment_requests: ({ calls }) => { inserts.payment = calls.find(c => c.method === "insert")?.args[0]; return { data: null, error: null }; },
      agent_log: () => ({ data: null, error: null }),
    } });
    getSupabaseAdmin.mockReturnValue(db);
    const { createProposal } = await import("./proposals");

    await expect(createProposal(formData({ deal_id: "deal_1", package_name: "Holiday Party", price: "1250", expires_on: "2026-12-01" })))
      .rejects.toThrow("REDIRECT:/office?success=proposal_drafted");
    expect(inserts.proposal).toMatchObject({ recipient_email: "buyer@example.com", price: 1250 });
    expect(inserts.payment).toMatchObject({ proposal_id: "proposal_1", amount_due_now_cents: 125000, status: "active" });
    expect(inserts.payment.public_token_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("allows a dated holiday proposal when an active capacity hold exists", async () => {
    const proposals = [];
    const db = createSupabaseAdminMock({ tables: {
      deals: () => ({ data: { id: "deal_1", prospect_id: "prospect_1", prospects: { email: "buyer@example.com", full_name: "Jamie Buyer" } }, error: null }),
      leads: () => ({ data: { id: "lead_1", preferred_event_date: "2026-12-10" }, error: null }),
      event_capacity_holds: () => ({ data: { id: "hold_1" }, error: null }),
      proposals: ({ calls }) => {
        const insert = calls.find((call) => call.method === "insert");
        if (insert) proposals.push(insert.args[0]);
        return { data: { id: "proposal_1" }, error: null };
      },
      payment_requests: () => ({ data: null, error: null }),
      agent_log: () => ({ data: null, error: null }),
    } });
    getSupabaseAdmin.mockReturnValue(db);
    const { createProposal } = await import("./proposals");

    await expect(createProposal(formData({
      deal_id: "deal_1",
      package_name: "Holiday Party",
      price: "1250",
      expires_on: "2026-12-01",
      subject: "Custom holiday proposal",
      body_text: "Custom approved terms",
    }))).rejects.toThrow("REDIRECT:/office?success=proposal_drafted");
    expect(proposals[0]).toMatchObject({
      subject: "Custom holiday proposal",
      body_text: "Custom approved terms",
      metadata: expect.objectContaining({ template_version: "office-custom-v1" }),
    });
  });

  it("reconciles a provider-accepted proposal send", async () => {
    const db = createSupabaseAdminMock({
      tables: {
        proposals: () => ({ data: { id: "proposal_1", prospect_id: "prospect_1", status: "reconcile_required", provider_message_id: "msg_1", subject: "Proposal", body_text: "Details", send_attempted_at: "2026-01-01T00:00:00Z" }, error: null }),
        agent_log: () => ({ data: null, error: null }),
      },
      rpc: { finalize_proposal_send: () => ({ data: { finalized: true }, error: null }) },
    });
    getSupabaseAdmin.mockReturnValue(db);
    process.env.RESEND_FROM_EMAIL = "hello@example.com";
    const { reconcileProposalSend } = await import("./proposals");

    await expect(reconcileProposalSend(formData({ id: "proposal_1" })))
      .rejects.toThrow("REDIRECT:/office?success=proposal_reconciled");
  });
});
