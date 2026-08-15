// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseAdminMock } from "@/test/supabase-admin-mock";

const getSupabaseAdmin = vi.fn();
vi.mock("@/lib/server/supabase-admin", () => ({
  getSupabaseAdmin: () => getSupabaseAdmin(),
}));

const sessionsCreate = vi.fn();
vi.mock("stripe", () => ({
  default: vi.fn().mockImplementation(function StripeMock() {
    return { checkout: { sessions: { create: (...args) => sessionsCreate(...args) } } };
  }),
}));

const ENV = {
  STRIPE_SECRET_KEY: "sk_test_123",
  NEXT_PUBLIC_SITE_URL: "https://teamtastic.com",
};

async function postCheckout(body) {
  const { POST } = await import("./route.js");
  const request = new Request("https://teamtastic.com/api/stripe/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return POST(request);
}

describe("stripe checkout", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    Object.assign(process.env, ENV);
    getSupabaseAdmin.mockReset();
    sessionsCreate.mockReset();
    sessionsCreate.mockResolvedValue({ id: "cs_new_1", url: "https://checkout.stripe.com/cs_new_1" });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns 503 when Stripe is not configured", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    const response = await postCheckout({ submissionId: "sub_1", paymentKind: "corporate_deposit" });
    expect(response.status).toBe(503);
  });

  it("rejects an unknown payment kind", async () => {
    const response = await postCheckout({ submissionId: "sub_1", paymentKind: "not_a_real_kind" });
    expect(response.status).toBe(400);
  });

  it("404s when the submission has no matching lead", async () => {
    const supabase = createSupabaseAdminMock({
      tables: { leads: () => ({ data: null, error: null }) },
    });
    getSupabaseAdmin.mockReturnValue(supabase);

    const response = await postCheckout({ submissionId: "sub_missing", paymentKind: "corporate_deposit" });
    expect(response.status).toBe(404);
    expect(sessionsCreate).not.toHaveBeenCalled();
  });

  it("creates a $200 corporate deposit checkout session and persists the payment_request", async () => {
    const supabase = createSupabaseAdminMock({
      tables: {
        leads: () => ({
          data: { id: "lead_1", submission_id: "sub_1", email: "client@example.com", name: "Jordan", context: {} },
          error: null,
        }),
        payment_requests: ({ calls }) => {
          if (calls.some((c) => c.method === "insert")) {
            return { data: { id: "pr_1", stripe_checkout_session_id: null, status: "active" }, error: null };
          }
          if (calls.some((c) => c.method === "update")) return { data: null, error: null };
          return { data: null, error: null }; // no existing (non-expired) payment_request
        },
      },
    });
    getSupabaseAdmin.mockReturnValue(supabase);

    const response = await postCheckout({ submissionId: "sub_1", paymentKind: "corporate_deposit" });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.url).toBe("https://checkout.stripe.com/cs_new_1");
    expect(sessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        customer_email: "client@example.com",
        client_reference_id: "sub_1",
        line_items: [expect.objectContaining({ price_data: expect.objectContaining({ unit_amount: 20000 }) })],
        metadata: expect.objectContaining({ payment_kind: "corporate_deposit", lead_id: "lead_1" }),
      }),
      expect.objectContaining({ idempotencyKey: "payment-request/pr_1" }),
    );
  });

  it("prices the estimated_event checkout from the lead's stored quiz context", async () => {
    const supabase = createSupabaseAdminMock({
      tables: {
        leads: () => ({
          data: {
            id: "lead_2",
            submission_id: "sub_2",
            email: "estimator@example.com",
            name: "Sam",
            context: { estimator_players: 20, estimator_package: "core", estimator_add_ons: [] },
          },
          error: null,
        }),
        payment_requests: ({ calls }) => {
          if (calls.some((c) => c.method === "insert")) {
            return { data: { id: "pr_2", stripe_checkout_session_id: null, status: "active" }, error: null };
          }
          return { data: null, error: null };
        },
      },
    });
    getSupabaseAdmin.mockReturnValue(supabase);

    const response = await postCheckout({ submissionId: "sub_2", paymentKind: "estimated_event" });
    expect(response.status).toBe(200);

    const [sessionArgs] = sessionsCreate.mock.calls[0];
    // 20 players * $30/person core pricing, well above the minimum — asserted loosely
    // against the pricing module's own output rather than hardcoding its constant.
    const { calculateHostedPrice } = await import("@/lib/server/pricing");
    const expected = calculateHostedPrice({ players: 20, packageType: "core", addOns: [] });
    expect(sessionArgs.line_items[0].price_data.unit_amount).toBe(expected.amountCents);
  });

  it("reuses an existing active payment_request instead of creating a duplicate", async () => {
    const supabase = createSupabaseAdminMock({
      tables: {
        leads: () => ({
          data: { id: "lead_3", submission_id: "sub_3", email: "client3@example.com", name: "Alex", context: {} },
          error: null,
        }),
        payment_requests: ({ calls }) => {
          if (calls.some((c) => c.method === "insert")) {
            throw new Error("should not insert a new payment_request when one is already active");
          }
          return { data: { id: "pr_existing", stripe_checkout_session_id: null, status: "active" }, error: null };
        },
      },
    });
    getSupabaseAdmin.mockReturnValue(supabase);

    const response = await postCheckout({ submissionId: "sub_3", paymentKind: "family_deposit" });
    expect(response.status).toBe(200);
    expect(sessionsCreate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ idempotencyKey: "payment-request/pr_existing" }),
    );
  });
});
