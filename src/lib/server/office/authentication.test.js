// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseAdminMock } from "@/test/supabase-admin-mock";

const getSupabaseAdmin = vi.fn();
const sendViaResend = vi.fn();
const redirect = vi.fn((path) => { throw new Error(`REDIRECT:${path}`); });
vi.mock("@/lib/server/supabase-admin", () => ({ getSupabaseAdmin: () => getSupabaseAdmin() }));
vi.mock("@/lib/server/email", () => ({ sendViaResend: (...args) => sendViaResend(...args) }));
vi.mock("@/lib/server/office-auth", () => ({
  officeAllowedEmail: () => (process.env.OFFICE_ALLOWED_EMAIL || process.env.INTERNAL_NOTIFICATION_EMAIL || "").trim().toLowerCase(),
  requireOfficeUser: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (path) => redirect(path) }));

const formData = (email) => ({ get: () => email });

describe("requestMagicLink", () => {
  beforeEach(() => {
    vi.resetModules();
    getSupabaseAdmin.mockReset();
    sendViaResend.mockReset();
    process.env.OFFICE_ALLOWED_EMAIL = "owner@example.com";
    process.env.RESEND_API_KEY = "key";
    process.env.RESEND_FROM_EMAIL = "hello@example.com";
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.com";
  });

  it("does not reveal whether an unapproved address exists", async () => {
    const { requestMagicLink } = await import("./authentication");
    await expect(requestMagicLink(formData("attacker@example.com"))).rejects.toThrow("REDIRECT:/office/login?sent=1");
    expect(getSupabaseAdmin).not.toHaveBeenCalled();
  });

  it("mints a hashed magic link and delivers it through the shared helper", async () => {
    const db = createSupabaseAdminMock({
      tables: { agent_log: () => ({ data: null, error: null }) },
      rpc: { try_claim_magic_link_send: () => ({ data: true, error: null }) },
    });
    db.auth = { admin: { generateLink: vi.fn().mockResolvedValue({ data: { properties: { hashed_token: "hash_123" } }, error: null }) } };
    getSupabaseAdmin.mockReturnValue(db);
    sendViaResend.mockResolvedValue({ reserved: true, sent: true, providerMessageId: "msg_1", reason: null });
    const { requestMagicLink } = await import("./authentication");

    await expect(requestMagicLink(formData("OWNER@example.com"))).rejects.toThrow("REDIRECT:/office/login?sent=1");
    expect(db.auth.admin.generateLink).toHaveBeenCalledWith({ type: "magiclink", email: "owner@example.com" });
    expect(sendViaResend).toHaveBeenCalledWith(db, expect.objectContaining({
      idempotencyKey: "office-magic-link/hash_123",
      text: expect.stringContaining("token_hash=hash_123"),
    }));
  });
});
