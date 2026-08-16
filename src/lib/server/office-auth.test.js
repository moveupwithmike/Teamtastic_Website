// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const redirect = vi.fn((path) => {
  throw new Error(`REDIRECT:${path}`);
});
vi.mock("next/navigation", () => ({
  redirect: (path) => redirect(path),
}));

const getUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => Promise.resolve({ auth: { getUser } }),
}));

const getSupabaseAdmin = vi.fn();
vi.mock("@/lib/server/supabase-admin", () => ({
  getSupabaseAdmin: () => getSupabaseAdmin(),
}));

describe("office-auth", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    redirect.mockClear();
    getUser.mockReset();
    getSupabaseAdmin.mockReset();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("officeAllowedEmails", () => {
    beforeEach(() => {
      delete process.env.OFFICE_ALLOWED_EMAILS;
      delete process.env.OFFICE_ALLOWED_EMAIL;
      delete process.env.INTERNAL_NOTIFICATION_EMAIL;
    });

    it("splits, lowercases, and trims a comma-separated OFFICE_ALLOWED_EMAILS", async () => {
      process.env.OFFICE_ALLOWED_EMAILS = "  Boss@Example.com , Second@Example.com ";
      const { officeAllowedEmails } = await import("./office-auth");
      expect(officeAllowedEmails()).toEqual(["boss@example.com", "second@example.com"]);
    });

    it("falls back to OFFICE_ALLOWED_EMAIL when OFFICE_ALLOWED_EMAILS is unset", async () => {
      process.env.OFFICE_ALLOWED_EMAIL = "Boss@Example.com";
      const { officeAllowedEmails } = await import("./office-auth");
      expect(officeAllowedEmails()).toEqual(["boss@example.com"]);
    });

    it("falls back to INTERNAL_NOTIFICATION_EMAIL when neither OFFICE_ALLOWED_* var is set", async () => {
      process.env.INTERNAL_NOTIFICATION_EMAIL = "Fallback@Example.com";
      const { officeAllowedEmails } = await import("./office-auth");
      expect(officeAllowedEmails()).toEqual(["fallback@example.com"]);
    });

    it("prefers OFFICE_ALLOWED_EMAILS over the singular fallbacks when set", async () => {
      process.env.OFFICE_ALLOWED_EMAILS = "primary@example.com";
      process.env.OFFICE_ALLOWED_EMAIL = "secondary@example.com";
      process.env.INTERNAL_NOTIFICATION_EMAIL = "tertiary@example.com";
      const { officeAllowedEmails } = await import("./office-auth");
      expect(officeAllowedEmails()).toEqual(["primary@example.com"]);
    });

    it("returns an empty array when no env var is set", async () => {
      const { officeAllowedEmails } = await import("./office-auth");
      expect(officeAllowedEmails()).toEqual([]);
    });
  });

  describe("isOfficeAllowedEmail", () => {
    beforeEach(() => {
      process.env.OFFICE_ALLOWED_EMAILS = "boss@example.com,second@example.com";
    });

    it("matches any address in the allow-list, case-insensitively", async () => {
      const { isOfficeAllowedEmail } = await import("./office-auth");
      expect(isOfficeAllowedEmail("Boss@Example.com")).toBe(true);
      expect(isOfficeAllowedEmail("Second@Example.com")).toBe(true);
    });

    it("rejects addresses not on the allow-list", async () => {
      const { isOfficeAllowedEmail } = await import("./office-auth");
      expect(isOfficeAllowedEmail("attacker@example.com")).toBe(false);
    });

    it("rejects an empty/missing email", async () => {
      const { isOfficeAllowedEmail } = await import("./office-auth");
      expect(isOfficeAllowedEmail("")).toBe(false);
      expect(isOfficeAllowedEmail(undefined)).toBe(false);
    });
  });

  describe("getOfficeUser", () => {
    beforeEach(() => {
      process.env.OFFICE_ALLOWED_EMAIL = "michael@teamtastic.com";
    });

    it("returns null when there is no signed-in user", async () => {
      getUser.mockResolvedValue({ data: { user: null }, error: null });
      const { getOfficeUser } = await import("./office-auth");
      expect(await getOfficeUser()).toBeNull();
    });

    it("returns null when Supabase reports an error, even if a user is present", async () => {
      getUser.mockResolvedValue({
        data: { user: { email: "michael@teamtastic.com" } },
        error: new Error("session expired"),
      });
      const { getOfficeUser } = await import("./office-auth");
      expect(await getOfficeUser()).toBeNull();
    });

    it("returns null when the signed-in email doesn't match the allowed email", async () => {
      getUser.mockResolvedValue({ data: { user: { email: "someone-else@example.com" } }, error: null });
      const { getOfficeUser } = await import("./office-auth");
      expect(await getOfficeUser()).toBeNull();
    });

    it("matches the allowed email case-insensitively", async () => {
      const user = { email: "Michael@Teamtastic.com" };
      getUser.mockResolvedValue({ data: { user }, error: null });
      const { getOfficeUser } = await import("./office-auth");
      expect(await getOfficeUser()).toBe(user);
    });
  });

  describe("requireOfficeUser", () => {
    it("returns the user without redirecting when authorized", async () => {
      process.env.OFFICE_ALLOWED_EMAIL = "michael@teamtastic.com";
      const user = { email: "michael@teamtastic.com" };
      getUser.mockResolvedValue({ data: { user }, error: null });
      const { requireOfficeUser } = await import("./office-auth");
      expect(await requireOfficeUser()).toBe(user);
      expect(redirect).not.toHaveBeenCalled();
    });

    it("redirects to /office/login when there is no authorized user", async () => {
      process.env.OFFICE_ALLOWED_EMAIL = "michael@teamtastic.com";
      getUser.mockResolvedValue({ data: { user: null }, error: null });
      const { requireOfficeUser } = await import("./office-auth");
      await expect(requireOfficeUser()).rejects.toThrow("REDIRECT:/office/login");
      expect(redirect).toHaveBeenCalledWith("/office/login");
    });
  });

  describe("getOfficeDb", () => {
    it("returns the admin client and user together when authorized", async () => {
      process.env.OFFICE_ALLOWED_EMAIL = "michael@teamtastic.com";
      const user = { email: "michael@teamtastic.com" };
      const admin = { from: vi.fn() };
      getUser.mockResolvedValue({ data: { user }, error: null });
      getSupabaseAdmin.mockReturnValue(admin);
      const { getOfficeDb } = await import("./office-auth");

      const result = await getOfficeDb();
      expect(result).toEqual({ db: admin, user });
    });

    it("redirects instead of ever constructing the admin client when unauthorized", async () => {
      process.env.OFFICE_ALLOWED_EMAIL = "michael@teamtastic.com";
      getUser.mockResolvedValue({ data: { user: null }, error: null });
      const { getOfficeDb } = await import("./office-auth");

      await expect(getOfficeDb()).rejects.toThrow("REDIRECT:/office/login");
      expect(getSupabaseAdmin).not.toHaveBeenCalled();
    });
  });
});
