// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseAdminMock } from "@/test/supabase-admin-mock";

const getSupabaseAdmin = vi.fn();
vi.mock("@/lib/server/supabase-admin", () => ({
  getSupabaseAdmin: () => getSupabaseAdmin(),
}));

const captureServerEvent = vi.fn((..._args) => Promise.resolve());
vi.mock("@/lib/server/posthog", () => ({
  captureServerEvent: (...args) => captureServerEvent(...args),
}));

const constructEvent = vi.fn();
vi.mock("stripe", () => ({
  default: vi.fn().mockImplementation(function StripeMock() {
    return { webhooks: { constructEvent: (...args) => constructEvent(...args) } };
  }),
}));

const ENV = {
  STRIPE_SECRET_KEY: "sk_test_123",
  STRIPE_WEBHOOK_SECRET: "whsec_123",
  RESEND_API_KEY: "resend_123",
  INTERNAL_NOTIFICATION_EMAIL: "michael@teamtastic.com",
  RESEND_FROM_EMAIL: "alerts@teamtastic.com",
};

function checkoutSession(overrides = {}) {
  return {
    id: "cs_test_123",
    mode: "payment",
    amount_total: 20000,
    currency: "usd",
    payment_status: "paid",
    payment_intent: "pi_123",
    payment_link: null,
    customer_details: { email: "client@example.com" },
    client_reference_id: "submission-abc",
    metadata: {},
    ...overrides,
  };
}

function stripeEvent(session, overrides = {}) {
  return {
    id: "evt_123",
    type: "checkout.session.completed",
    created: Math.floor(Date.now() / 1000),
    data: { object: session },
    ...overrides,
  };
}

async function postWebhook(body = "{}") {
  const { POST } = await import("./route.js");
  const request = new Request("https://teamtastic.com/api/stripe/webhook", {
    method: "POST",
    headers: { "stripe-signature": "sig_test" },
    body,
  });
  return POST(request);
}

describe("stripe webhook", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    Object.assign(process.env, ENV);
    getSupabaseAdmin.mockReset();
    captureServerEvent.mockClear();
    constructEvent.mockReset();
    global.fetch = /** @type {typeof fetch} */ (/** @type {unknown} */ (vi.fn(() => Promise.resolve({ ok: true }))));
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
  });

  it("returns 503 when Stripe is not configured", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const response = await postWebhook();
    expect(response.status).toBe(503);
  });

  it("rejects a request with an invalid signature", async () => {
    constructEvent.mockImplementation(() => {
      throw new Error("bad signature");
    });
    const response = await postWebhook();
    expect(response.status).toBe(400);
    expect(await response.text()).toBe("Invalid signature");
  });

  it("ignores event types other than checkout.session.completed", async () => {
    constructEvent.mockReturnValue(stripeEvent(checkoutSession(), { type: "payment_intent.created" }));
    const response = await postWebhook();
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("Ignored");
  });

  it("marks the deposit paid, converts the lead, and alerts on a fresh completed checkout", async () => {
    const session = checkoutSession();
    constructEvent.mockReturnValue(stripeEvent(session));

    const supabase = createSupabaseAdminMock({
      tables: {
        stripe_events: ({ calls, eqValue }) => {
          if (calls.some((c) => c.method === "insert")) {
            return { data: { id: "row_1" }, error: null };
          }
          if (eqValue("stripe_event_id") === "evt_123") {
            return { data: null, error: null }; // not a duplicate
          }
          if (calls.some((c) => c.method === "select" && c.args[0] === "lifecycle_attempts")) {
            return { data: { lifecycle_attempts: 0 }, error: null };
          }
          return { data: null, error: null };
        },
        leads: ({ eqValue }) => {
          if (eqValue("submission_id") === "submission-abc") {
            return {
              data: { id: "lead_1", submission_id: "submission-abc", name: "Jordan", company: "Acme", lead_source: "event_quiz" },
              error: null,
            };
          }
          return { data: null, error: null };
        },
      },
      rpc: {
        reserve_email_send: () => ({ data: { allowed: true }, error: null }),
        record_email_send_result: () => ({ data: null, error: null }),
        process_paid_conversion: () => ({ data: { converted: true, status: "converted" }, error: null }),
      },
    });
    getSupabaseAdmin.mockReturnValue(supabase);

    const response = await postWebhook();

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("Processed");
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({ method: "POST" }),
    );
    expect(supabase.rpc).toHaveBeenCalledWith(
      "process_paid_conversion",
      expect.objectContaining({ p_stripe_event_id: "row_1" }),
    );
    expect(captureServerEvent).toHaveBeenCalledWith(
      "deposit_completed",
      "submission-abc",
      expect.objectContaining({ matched: true, product_key: "hosted_event_deposit" }),
    );
  });

  it("short-circuits an already-processed event without re-running the lifecycle or re-alerting", async () => {
    const session = checkoutSession();
    constructEvent.mockReturnValue(stripeEvent(session));

    const supabase = createSupabaseAdminMock({
      tables: {
        stripe_events: ({ eqValue }) => {
          if (eqValue("stripe_event_id") === "evt_123") {
            return {
              data: {
                id: "row_1",
                stripe_event_id: "evt_123",
                lifecycle_status: "converted",
                alert_status: "sent",
                lead_id: null,
              },
              error: null,
            };
          }
          return { data: null, error: null };
        },
      },
    });
    getSupabaseAdmin.mockReturnValue(supabase);

    const response = await postWebhook();

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("Already processed");
    expect(global.fetch).not.toHaveBeenCalled();
    expect(supabase.rpc).not.toHaveBeenCalledWith("process_paid_conversion", expect.anything());
  });

  it("flags a payment_request amount mismatch for manual review instead of marking it paid", async () => {
    const session = checkoutSession({
      amount_total: 15000,
      metadata: { payment_request_id: "pr_1" },
    });
    constructEvent.mockReturnValue(stripeEvent(session));

    const supabase = createSupabaseAdminMock({
      tables: {
        payment_requests: ({ eqValue, calls }) => {
          if (calls.some((c) => c.method === "update")) return { data: null, error: null };
          if (eqValue("id") === "pr_1") {
            return { data: { id: "pr_1", amount_due_now_cents: 20000, currency: "usd" }, error: null };
          }
          return { data: null, error: null };
        },
        stripe_events: ({ calls, eqValue }) => {
          if (calls.some((c) => c.method === "insert")) return { data: { id: "row_1" }, error: null };
          if (eqValue("stripe_event_id") === "evt_123") return { data: null, error: null };
          return { data: null, error: null };
        },
        leads: () => ({ data: null, error: null }),
        agent_log: () => ({ data: null, error: null }),
      },
      rpc: {
        reserve_email_send: () => ({ data: { allowed: true }, error: null }),
        record_email_send_result: () => ({ data: null, error: null }),
      },
    });
    getSupabaseAdmin.mockReturnValue(supabase);

    const response = await postWebhook();

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("Payment amount requires review");
    expect(supabase.rpc).not.toHaveBeenCalledWith("process_paid_conversion", expect.anything());
  });

  it("returns 503 when every alert channel fails to send", async () => {
    const session = checkoutSession();
    constructEvent.mockReturnValue(stripeEvent(session));
    global.fetch = /** @type {typeof fetch} */ (/** @type {unknown} */ (vi.fn(() => Promise.resolve({ ok: false }))));

    const supabase = createSupabaseAdminMock({
      tables: {
        stripe_events: ({ calls, eqValue }) => {
          if (calls.some((c) => c.method === "insert")) return { data: { id: "row_1" }, error: null };
          if (eqValue("stripe_event_id") === "evt_123") return { data: null, error: null };
          if (calls.some((c) => c.method === "select" && c.args[0] === "lifecycle_attempts")) {
            return { data: { lifecycle_attempts: 0 }, error: null };
          }
          return { data: null, error: null };
        },
        leads: () => ({ data: null, error: null }),
      },
      rpc: {
        reserve_email_send: () => ({ data: { allowed: true }, error: null }),
        record_email_send_result: () => ({ data: null, error: null }),
        process_paid_conversion: () => ({ data: { converted: false, reason: "needs_lead_match" }, error: null }),
      },
    });
    getSupabaseAdmin.mockReturnValue(supabase);

    const response = await postWebhook();

    expect(response.status).toBe(503);
    expect(await response.text()).toBe("Alert delivery failed");
  });
});
