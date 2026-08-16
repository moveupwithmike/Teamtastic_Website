// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseAdminMock } from "@/test/supabase-admin-mock";
const verify = vi.fn(), getSupabaseAdmin = vi.fn();
vi.mock("svix", () => ({ Webhook: vi.fn().mockImplementation(function WebhookMock() { return { verify: (...args) => verify(...args) }; }) }));
vi.mock("@/lib/server/supabase-admin", () => ({ getSupabaseAdmin: () => getSupabaseAdmin() }));

const request = () => new Request("https://teamtastic.com/api/resend/webhook", { method: "POST", body: "{}", headers: { "svix-id": "evt_1", "svix-timestamp": "1", "svix-signature": "sig" } });

describe("Resend webhook", () => {
  beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); verify.mockReset(); process.env.RESEND_WEBHOOK_SECRET = "secret"; });
  it("requires configuration and a valid signature", async () => {
    const { POST } = await import("./route");
    delete process.env.RESEND_WEBHOOK_SECRET;
    expect((await POST(request())).status).toBe(503);
    process.env.RESEND_WEBHOOK_SECRET = "secret"; verify.mockImplementation(() => { throw new Error("bad"); });
    expect((await POST(request())).status).toBe(400);
  });
  it("updates delivered messages", async () => {
    verify.mockReturnValue({ type: "email.delivered", data: { email_id: "msg_1", to: ["buyer@example.com"] } });
    const db = createSupabaseAdminMock({ tables: { resend_webhook_events: { data: null, error: null }, messages: { data: null, error: null } } });
    getSupabaseAdmin.mockReturnValue(db);
    const { POST } = await import("./route");
    expect(await (await POST(request())).json()).toEqual({ received: true });
    expect(db.from).toHaveBeenCalledWith("messages");
  });
  it("suppresses hard bounces and treats duplicate events idempotently", async () => {
    verify.mockReturnValue({ type: "email.bounced", data: { email_id: "msg_2", to: "bad@example.com", bounce_type: "Hard" } });
    const db = createSupabaseAdminMock({ tables: { resend_webhook_events: { data: null, error: { code: "23505" } } } });
    getSupabaseAdmin.mockReturnValue(db);
    const { POST } = await import("./route");
    expect(await (await POST(request())).json()).toEqual({ received: true, duplicate: true });
  });
});
