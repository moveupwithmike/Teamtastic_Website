// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseAdminMock } from "@/test/supabase-admin-mock";

const getSupabaseAdmin = vi.fn();
const sendViaResend = vi.fn();
const redirect = vi.fn((path) => { throw new Error(`REDIRECT:${path}`); });
const requireOfficeUser = vi.fn();
const createSupabaseServerClient = vi.fn();
vi.mock("@/lib/server/supabase-admin", () => ({ getSupabaseAdmin: () => getSupabaseAdmin() }));
vi.mock("@/lib/server/email", () => ({ sendViaResend: (...args) => sendViaResend(...args) }));
vi.mock("@/lib/server/office-auth", () => ({
  isOfficeAllowedEmail: (email) => {
    const allowed = (process.env.OFFICE_ALLOWED_EMAILS || process.env.OFFICE_ALLOWED_EMAIL || process.env.INTERNAL_NOTIFICATION_EMAIL || "")
      .split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
    return allowed.includes(String(email || "").trim().toLowerCase());
  },
  requireOfficeUser: (...args) => requireOfficeUser(...args),
}));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: (...args) => createSupabaseServerClient(...args) }));
vi.mock("next/navigation", () => ({ redirect: (path) => redirect(path) }));

const formData = (email) => ({ get: () => email });

describe("requestMagicLink", () => {
  beforeEach(() => {
    vi.resetModules();
    getSupabaseAdmin.mockReset();
    sendViaResend.mockReset();
    requireOfficeUser.mockReset();
    createSupabaseServerClient.mockReset();
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

  it("sends the link to whichever admin on the allow-list requested it, not a single fixed address", async () => {
    process.env.OFFICE_ALLOWED_EMAILS = "owner@example.com,second-admin@example.com";
    const db = createSupabaseAdminMock({
      tables: { agent_log: () => ({ data: null, error: null }) },
      rpc: { try_claim_magic_link_send: () => ({ data: true, error: null }) },
    });
    db.auth = { admin: { generateLink: vi.fn().mockResolvedValue({ data: { properties: { hashed_token: "hash_456" } }, error: null }) } };
    getSupabaseAdmin.mockReturnValue(db);
    sendViaResend.mockResolvedValue({ reserved: true, sent: true, providerMessageId: "msg_2", reason: null });
    const { requestMagicLink } = await import("./authentication");

    await expect(requestMagicLink(formData("Second-Admin@example.com"))).rejects.toThrow("REDIRECT:/office/login?sent=1");
    expect(db.auth.admin.generateLink).toHaveBeenCalledWith({ type: "magiclink", email: "second-admin@example.com" });
    expect(sendViaResend).toHaveBeenCalledWith(db, expect.objectContaining({ recipient: "second-admin@example.com" }));
  });

  it("logs link-generation failures", async () => {
    const logs = [];
    const db = createSupabaseAdminMock({
      tables: { agent_log: ({ calls }) => { logs.push(calls[0].args[0]); return { data: null, error: null }; } },
      rpc: { try_claim_magic_link_send: { data: true, error: null } },
    });
    db.auth = { admin: { generateLink: vi.fn().mockResolvedValue({ data: {}, error: { message: "auth unavailable" } }) } };
    getSupabaseAdmin.mockReturnValue(db);
    const { requestMagicLink } = await import("./authentication");
    await expect(requestMagicLink(formData("owner@example.com"))).rejects.toThrow("error=send_failed");
    expect(logs[0]).toMatchObject({ outcome: "failed", error: "auth unavailable" });
  });

  it("logs blocked deliveries and rejects provider failures", async () => {
    const logs = [];
    const db = createSupabaseAdminMock({
      tables: { agent_log: ({ calls }) => { logs.push(calls[0].args[0]); return { data: null, error: null }; } },
      rpc: { try_claim_magic_link_send: { data: true, error: null } },
    });
    db.auth = { admin: { generateLink: vi.fn().mockResolvedValue({ data: { properties: { hashed_token: "hash" } }, error: null }) } };
    getSupabaseAdmin.mockReturnValue(db);
    sendViaResend.mockResolvedValue({ reserved: false, sent: false, reason: "daily_cap" });
    const { requestMagicLink } = await import("./authentication");
    await expect(requestMagicLink(formData("owner@example.com"))).rejects.toThrow("error=send_failed");
    expect(logs[0]).toMatchObject({ outcome: "blocked", decision: { reason: "daily_cap" } });
  });

  it("signs the authenticated office user out", async () => {
    requireOfficeUser.mockResolvedValue({ email: "owner@example.com" });
    const signOut = vi.fn();
    createSupabaseServerClient.mockResolvedValue({ auth: { signOut } });
    const { signOutOffice } = await import("./authentication");
    await expect(signOutOffice()).rejects.toThrow("REDIRECT:/office/login");
    expect(signOut).toHaveBeenCalled();
  });
});
