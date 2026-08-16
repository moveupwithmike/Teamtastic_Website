// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseAdminMock } from "@/test/supabase-admin-mock";

const getSupabaseAdmin = vi.fn();
vi.mock("@/lib/server/supabase-admin", () => ({
  getSupabaseAdmin: () => getSupabaseAdmin(),
}));

const sendViaResend = vi.fn();
vi.mock("@/lib/server/email", () => ({
  sendViaResend: (...args) => sendViaResend(...args),
}));

const USER = { email: "michael@teamtastic.com" };

function formData(entries) {
  const map = new Map(Object.entries(entries));
  return { get: (key) => map.get(key) ?? null };
}

describe("createSalesResponseDraft", () => {
  beforeEach(() => {
    vi.resetModules();
    getSupabaseAdmin.mockReset();
  });

  it("rejects an invalid response type without touching the database", async () => {
    const supabase = createSupabaseAdminMock({});
    getSupabaseAdmin.mockReturnValue(supabase);
    const { createSalesResponseDraft } = await import("./sales-response");

    const result = await createSalesResponseDraft(USER, formData({ lead_id: "lead_1", response_type: "bogus" }));
    expect(result).toEqual({ ok: false, errorCode: "invalid_draft" });
  });

  it("returns lead_missing when the lead has no email on file", async () => {
    const supabase = createSupabaseAdminMock({
      tables: { leads: () => ({ data: { id: "lead_1", email: null }, error: null }) },
    });
    getSupabaseAdmin.mockReturnValue(supabase);
    const { createSalesResponseDraft } = await import("./sales-response");

    const result = await createSalesResponseDraft(USER, formData({ lead_id: "lead_1", response_type: "availability" }));
    expect(result).toEqual({ ok: false, errorCode: "lead_missing" });
  });

  it("creates a draft and its generation revision on success", async () => {
    const revisionInserts = [];
    const supabase = createSupabaseAdminMock({
      tables: {
        leads: () => ({ data: { id: "lead_1", prospect_id: "p1", email: "jordan@example.com", name: "Jordan Rivera", team_size: "25-50" }, error: null }),
        deals: () => ({ data: null, error: null }),
        event_capacity_holds: () => ({ data: null, error: null }),
        sales_response_drafts: ({ calls }) => {
          if (calls.some((c) => c.method === "insert")) return { data: { id: "draft_1" }, error: null };
          return { data: null, error: null };
        },
        sales_response_revisions: ({ calls }) => { revisionInserts.push(calls[0].args[0]); return { data: null, error: null }; },
        agent_log: () => ({ data: null, error: null }),
      },
    });
    getSupabaseAdmin.mockReturnValue(supabase);
    const { createSalesResponseDraft } = await import("./sales-response");

    const result = await createSalesResponseDraft(USER, formData({ lead_id: "lead_1", response_type: "availability" }));
    expect(result).toEqual({ ok: true, errorCode: undefined });
    expect(revisionInserts[0]).toMatchObject({ response_id: "draft_1", revision_type: "generated" });
  });
});

describe("approveAndSendSalesResponse", () => {
  beforeEach(() => {
    vi.resetModules();
    getSupabaseAdmin.mockReset();
    sendViaResend.mockReset();
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM_EMAIL;
    delete process.env.INTERNAL_NOTIFICATION_EMAIL;
  });

  it("rejects an incomplete submission before touching the database", async () => {
    const supabase = createSupabaseAdminMock({});
    getSupabaseAdmin.mockReturnValue(supabase);
    const { approveAndSendSalesResponse } = await import("./sales-response");

    const result = await approveAndSendSalesResponse(USER, formData({ id: "", subject: "", body_text: "" }));
    expect(result).toEqual({ ok: false, errorCode: "response_incomplete" });
  });

  it("returns response_unavailable when the draft isn't in a sendable status", async () => {
    const supabase = createSupabaseAdminMock({
      tables: { sales_response_drafts: () => ({ data: null, error: null }) },
    });
    getSupabaseAdmin.mockReturnValue(supabase);
    const { approveAndSendSalesResponse } = await import("./sales-response");

    const result = await approveAndSendSalesResponse(USER, formData({ id: "resp_1", subject: "Hi", body_text: "Body" }));
    expect(result).toEqual({ ok: false, errorCode: "response_unavailable" });
  });

  it("returns email_not_configured without calling sendViaResend when Resend isn't set up", async () => {
    const supabase = createSupabaseAdminMock({
      tables: {
        sales_response_drafts: ({ calls }) => {
          if (calls.some((c) => c.method === "update")) return { data: { id: "resp_1" }, error: null };
          return { data: { id: "resp_1", recipient_email: "lead@example.com", subject: "Old", generated_body: "Old body" }, error: null };
        },
        sales_response_revisions: () => ({ data: null, error: null }),
      },
    });
    getSupabaseAdmin.mockReturnValue(supabase);
    const { approveAndSendSalesResponse } = await import("./sales-response");

    const result = await approveAndSendSalesResponse(USER, formData({ id: "resp_1", subject: "Hi", body_text: "Body" }));
    expect(result).toEqual({ ok: false, errorCode: "email_not_configured" });
    expect(sendViaResend).not.toHaveBeenCalled();
  });

  it("sends via the shared helper with an idempotency key and reports success", async () => {
    process.env.RESEND_API_KEY = "key";
    process.env.RESEND_FROM_EMAIL = "alerts@teamtastic.com";
    sendViaResend.mockResolvedValue({ reserved: true, sent: true, providerMessageId: "msg_1", reason: null });

    const messageInserts = [];
    const supabase = createSupabaseAdminMock({
      tables: {
        sales_response_drafts: ({ calls }) => {
          if (calls.some((c) => c.method === "update")) return { data: { id: "resp_1" }, error: null };
          return { data: { id: "resp_1", prospect_id: "p1", recipient_email: "lead@example.com", subject: "Old", generated_body: "Old body", response_type: "availability" }, error: null };
        },
        sales_response_revisions: () => ({ data: null, error: null }),
        messages: ({ calls }) => { messageInserts.push(calls[0].args[0]); return { data: null, error: null }; },
        agent_log: () => ({ data: null, error: null }),
      },
    });
    getSupabaseAdmin.mockReturnValue(supabase);
    const { approveAndSendSalesResponse } = await import("./sales-response");

    const result = await approveAndSendSalesResponse(USER, formData({ id: "resp_1", subject: "Hi", body_text: "Body" }));
    expect(result).toEqual({ ok: true });
    expect(sendViaResend).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      idempotencyKey: "sales-response/resp_1", timeoutMs: 10000,
    }));
    expect(messageInserts[0]).toMatchObject({ status: "sent", provider_message_id: "msg_1" });
  });

  it("returns the encoded reservation reason when sending is blocked", async () => {
    process.env.RESEND_API_KEY = "key";
    process.env.RESEND_FROM_EMAIL = "alerts@teamtastic.com";
    sendViaResend.mockResolvedValue({ reserved: false, sent: false, providerMessageId: null, reason: "daily proposal cap reached" });

    const supabase = createSupabaseAdminMock({
      tables: {
        sales_response_drafts: ({ calls }) => {
          if (calls.some((c) => c.method === "update")) return { data: { id: "resp_1" }, error: null };
          return { data: { id: "resp_1", recipient_email: "lead@example.com", subject: "Old", generated_body: "Old body" }, error: null };
        },
        sales_response_revisions: () => ({ data: null, error: null }),
      },
    });
    getSupabaseAdmin.mockReturnValue(supabase);
    const { approveAndSendSalesResponse } = await import("./sales-response");

    const result = await approveAndSendSalesResponse(USER, formData({ id: "resp_1", subject: "Hi", body_text: "Body" }));
    expect(result).toEqual({ ok: false, errorCode: encodeURIComponent("daily proposal cap reached") });
  });

  it("marks an accepted-but-failed provider send as send_failed", async () => {
    process.env.RESEND_API_KEY = "key";
    process.env.RESEND_FROM_EMAIL = "alerts@teamtastic.com";
    sendViaResend.mockResolvedValue({ reserved: true, sent: false, providerMessageId: null, reason: "provider timeout" });
    const updates = [];
    const supabase = createSupabaseAdminMock({ tables: {
      sales_response_drafts: ({ calls }) => {
        const update = calls.find(c => c.method === "update");
        if (update) { updates.push(update.args[0]); return { data: { id: "resp_1" }, error: null }; }
        return { data: { id: "resp_1", prospect_id: "p1", recipient_email: "lead@example.com", subject: "Old", generated_body: "Old" }, error: null };
      },
      sales_response_revisions: { data: null, error: null },
      agent_log: { data: null, error: null },
    } });
    getSupabaseAdmin.mockReturnValue(supabase);
    const { approveAndSendSalesResponse } = await import("./sales-response");
    expect(await approveAndSendSalesResponse(USER, formData({ id: "resp_1", subject: "Hi", body_text: "Body" })))
      .toEqual({ ok: false, errorCode: "send_failed" });
    expect(updates).toContainEqual({ status: "send_failed", last_error: "provider timeout" });
  });
});
