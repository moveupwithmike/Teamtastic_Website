// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseAdminMock } from "@/test/supabase-admin-mock";
const getSupabaseAdmin = vi.fn(), sessionsCreate = vi.fn();
vi.mock("@/lib/server/supabase-admin", () => ({ getSupabaseAdmin: () => getSupabaseAdmin() }));
vi.mock("@/lib/server/rate-limit", () => ({ hashKey: (value) => `hash:${value}` }));
vi.mock("stripe", () => ({ default: vi.fn().mockImplementation(function StripeMock() { return { checkout: { sessions: { create: (...args) => sessionsCreate(...args) } } }; }) }));
const token = "a".repeat(32);
const call = async (value = token) => (await import("./route")).GET(new Request(`https://teamtastic.com/api/stripe/proposal-checkout?token=${value}`));

describe("proposal checkout", () => {
  beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); process.env.STRIPE_SECRET_KEY = "sk_test"; process.env.NEXT_PUBLIC_SITE_URL = "https://teamtastic.com/"; });
  it("rejects missing configuration and invalid tokens", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    expect((await call()).status).toBe(503);
    process.env.STRIPE_SECRET_KEY = "sk_test";
    expect((await call("short")).status).toBe(400);
  });
  it("returns 404 and 410 for missing or expired requests", async () => {
    getSupabaseAdmin.mockReturnValue(createSupabaseAdminMock({ tables: { payment_requests: { data: null, error: null } } }));
    expect((await call()).status).toBe(404);
    getSupabaseAdmin.mockReturnValue(createSupabaseAdminMock({ tables: { payment_requests: { data: { status: "active", expires_at: "2020-01-01", proposals: {} }, error: null } } }));
    expect((await call()).status).toBe(410);
  });
  it("creates an idempotent Checkout Session and redirects", async () => {
    const payment = { id: "pr_1", status: "active", expires_at: "2099-01-01", currency: "usd", amount_due_now_cents: 20000, payment_kind: "deposit", pricing_version: "v1", deal_id: null, proposals: { id: "p_1", recipient_email: "buyer@example.com", package_name: "Hosted Event", status: "sent" } };
    const db = createSupabaseAdminMock({ tables: { payment_requests: ({ calls }) => calls.some(c => c.method === "update") ? { data: null, error: null } : { data: payment, error: null } } });
    getSupabaseAdmin.mockReturnValue(db); sessionsCreate.mockResolvedValue({ id: "cs_1", url: "https://checkout.stripe.com/cs_1" });
    const response = await call();
    expect(response.status).toBe(303);
    expect(sessionsCreate).toHaveBeenCalledWith(expect.objectContaining({ mode: "payment", customer_email: "buyer@example.com" }), { idempotencyKey: "payment-request/pr_1" });
  });
});
