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

function refundObject(overrides = {}) {
  return {
    id: "re_123",
    object: "refund",
    amount: 50000,
    currency: "usd",
    status: "succeeded",
    reason: "requested_by_customer",
    failure_reason: null,
    payment_intent: "pi_123",
    charge: "ch_123",
    created: Math.floor(Date.now() / 1000),
    ...overrides,
  };
}

function refundEvent(refund, overrides = {}) {
  return {
    id: "evt_refund_1",
    type: "refund.created",
    created: Math.floor(Date.now() / 1000),
    data: { object: refund },
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
    global.fetch = /** @type {typeof fetch} */ (/** @type {unknown} */ (
      vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ id: "email_test_id" }) }))
    ));
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

  it("returns 503 when the Stripe event cannot be persisted", async () => {
    constructEvent.mockReturnValue(stripeEvent(checkoutSession()));
    const supabase = createSupabaseAdminMock({ tables: {
      stripe_events: ({ calls }) => calls.some(c => c.method === "insert")
        ? { data: null, error: { code: "db_down" } }
        : { data: null, error: null },
      leads: { data: null, error: null },
    } });
    getSupabaseAdmin.mockReturnValue(supabase);
    const response = await postWebhook();
    expect(response.status).toBe(503);
    expect(await response.text()).toBe("Persistence failed");
  });

  it("retries lifecycle conversion and alert delivery for an incomplete duplicate", async () => {
    constructEvent.mockReturnValue(stripeEvent(checkoutSession()));
    const duplicate = { id: "row_retry", stripe_event_id: "evt_123", stripe_session_id: "cs_test_123", product_key: "hosted_event_deposit", amount_total: 20000, currency: "usd", lifecycle_status: "failed", lifecycle_attempts: 1, alert_status: "failed", alert_attempts: 1, lead_id: "lead_retry", customer_email: "client@example.com" };
    const supabase = createSupabaseAdminMock({
      tables: {
        stripe_events: ({ calls, eqValue }) => {
          if (calls.some(c => c.method === "select" && c.args[0] === "lifecycle_attempts")) return { data: { lifecycle_attempts: 1 }, error: null };
          if (eqValue("stripe_event_id") === "evt_123") return { data: duplicate, error: null };
          return { data: null, error: null };
        },
        leads: { data: { id: "lead_retry", name: "Jordan", company: "Acme" }, error: null },
      },
      rpc: {
        process_paid_conversion: { data: null, error: { code: "conversion_down" } },
        reserve_email_send: { data: { allowed: true }, error: null },
        record_email_send_result: { data: null, error: null },
      },
    });
    getSupabaseAdmin.mockReturnValue(supabase);
    const response = await postWebhook();
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("Already processed");
    expect(supabase.rpc).toHaveBeenCalledWith("process_paid_conversion", { p_stripe_event_id: "row_retry" });
    expect(global.fetch).toHaveBeenCalled();
  });
});

describe("stripe webhook — refund reconciliation", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    Object.assign(process.env, ENV);
    getSupabaseAdmin.mockReset();
    constructEvent.mockReset();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("reconciles a full refund via a single RPC call carrying the refund's own fields", async () => {
    const refund = refundObject();
    const event = refundEvent(refund);
    constructEvent.mockReturnValue(event);

    const reconcile = vi.fn(() => ({
      data: { reconciled: true, applied: true, matched_deal: true, refund_status: "full", amount_refunded_cents: 50000 },
      error: null,
    }));
    const supabase = createSupabaseAdminMock({ rpc: { reconcile_stripe_refund: reconcile } });
    getSupabaseAdmin.mockReturnValue(supabase);

    const response = await postWebhook();

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("Processed");
    expect(reconcile).toHaveBeenCalledWith(expect.objectContaining({
      p_stripe_refund_id: "re_123",
      p_stripe_payment_intent_id: "pi_123",
      p_stripe_charge_id: "ch_123",
      p_amount_cents: 50000,
      p_currency: "usd",
      p_status: "succeeded",
      p_stripe_event_id: "evt_refund_1",
    }));
  });

  it("reconciles a partial refund the same way — the RPC/DB owns the aggregation, not the route", async () => {
    const refund = refundObject({ id: "re_partial_1", amount: 25000 });
    constructEvent.mockReturnValue(refundEvent(refund));

    const reconcile = vi.fn(() => ({
      data: { reconciled: true, applied: true, matched_deal: true, refund_status: "partial", amount_refunded_cents: 25000 },
      error: null,
    }));
    const supabase = createSupabaseAdminMock({ rpc: { reconcile_stripe_refund: reconcile } });
    getSupabaseAdmin.mockReturnValue(supabase);

    const response = await postWebhook();

    expect(response.status).toBe(200);
    expect(reconcile).toHaveBeenCalledWith(expect.objectContaining({ p_stripe_refund_id: "re_partial_1", p_amount_cents: 25000 }));
  });

  it("handles a second partial refund on the same payment as its own independent call (multiple partial refunds)", async () => {
    const firstRefund = refundObject({ id: "re_partial_1", amount: 25000 });
    constructEvent.mockReturnValueOnce(refundEvent(firstRefund, { id: "evt_refund_1" }));
    const reconcile = vi.fn()
      .mockReturnValueOnce({ data: { reconciled: true, applied: true, matched_deal: true, refund_status: "partial", amount_refunded_cents: 25000 }, error: null })
      .mockReturnValueOnce({ data: { reconciled: true, applied: true, matched_deal: true, refund_status: "full", amount_refunded_cents: 50000 }, error: null });
    const supabase = createSupabaseAdminMock({ rpc: { reconcile_stripe_refund: reconcile } });
    getSupabaseAdmin.mockReturnValue(supabase);

    const firstResponse = await postWebhook();
    expect(firstResponse.status).toBe(200);

    const secondRefund = refundObject({ id: "re_partial_2", amount: 25000 });
    constructEvent.mockReturnValueOnce(refundEvent(secondRefund, { id: "evt_refund_2" }));
    const secondResponse = await postWebhook();
    expect(secondResponse.status).toBe(200);

    expect(reconcile).toHaveBeenNthCalledWith(1, expect.objectContaining({ p_stripe_refund_id: "re_partial_1" }));
    expect(reconcile).toHaveBeenNthCalledWith(2, expect.objectContaining({ p_stripe_refund_id: "re_partial_2" }));
    // Aggregation to $500 total across two $250 refunds is the DB's job (proven by
    // the SQL-level reconciliation trace in supabase/tests/refund-reconciliation.md),
    // not something the route computes — the route just forwards each event.
  });

  it("is idempotent under duplicate webhook delivery: the same refund event fires the RPC again and stays 200", async () => {
    const refund = refundObject();
    constructEvent.mockReturnValue(refundEvent(refund));
    const reconcile = vi.fn(() => ({
      data: { reconciled: true, applied: false, reason: "stale_or_duplicate_event" },
      error: null,
    }));
    const supabase = createSupabaseAdminMock({ rpc: { reconcile_stripe_refund: reconcile } });
    getSupabaseAdmin.mockReturnValue(supabase);

    const response = await postWebhook();
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("Processed");
  });

  it("treats an out-of-order (stale) event as a safe no-op rather than corrupting state", async () => {
    const refund = refundObject({ status: "pending" });
    constructEvent.mockReturnValue(refundEvent(refund, { type: "refund.updated" }));
    const reconcile = vi.fn(() => ({
      data: { reconciled: true, applied: false, reason: "stale_or_duplicate_event", refund_id: "internal-uuid" },
      error: null,
    }));
    const supabase = createSupabaseAdminMock({ rpc: { reconcile_stripe_refund: reconcile } });
    getSupabaseAdmin.mockReturnValue(supabase);

    const response = await postWebhook();
    expect(response.status).toBe(200);
  });

  it("reconciles a failed refund by recording status/failure_reason, not by changing amount_refunded", async () => {
    const refund = refundObject({ status: "failed", failure_reason: "insufficient_funds", amount: 50000 });
    constructEvent.mockReturnValue(refundEvent(refund, { type: "refund.failed" }));
    const reconcile = vi.fn(() => ({
      data: { reconciled: true, applied: true, matched_deal: true, refund_status: "none", amount_refunded_cents: 0 },
      error: null,
    }));
    const supabase = createSupabaseAdminMock({ rpc: { reconcile_stripe_refund: reconcile } });
    getSupabaseAdmin.mockReturnValue(supabase);

    const response = await postWebhook();
    expect(response.status).toBe(200);
    expect(reconcile).toHaveBeenCalledWith(expect.objectContaining({
      p_status: "failed",
      p_failure_reason: "insufficient_funds",
    }));
  });

  it("returns 503 (not 200) when the reconciliation RPC itself errors, so Stripe retries", async () => {
    const refund = refundObject();
    constructEvent.mockReturnValue(refundEvent(refund));
    const supabase = createSupabaseAdminMock({
      rpc: { reconcile_stripe_refund: () => ({ data: null, error: { code: "db_down" } }) },
    });
    getSupabaseAdmin.mockReturnValue(supabase);

    const response = await postWebhook();
    expect(response.status).toBe(503);
  });

  it("handles refund.updated the same way as refund.created (both drive reconciliation)", async () => {
    const refund = refundObject({ status: "succeeded" });
    constructEvent.mockReturnValue(refundEvent(refund, { type: "refund.updated" }));
    const reconcile = vi.fn(() => ({ data: { reconciled: true, applied: true, matched_deal: true }, error: null }));
    const supabase = createSupabaseAdminMock({ rpc: { reconcile_stripe_refund: reconcile } });
    getSupabaseAdmin.mockReturnValue(supabase);

    const response = await postWebhook();
    expect(response.status).toBe(200);
    expect(reconcile).toHaveBeenCalled();
  });

  it("does not fall through to checkout-session handling for refund events", async () => {
    const refund = refundObject();
    constructEvent.mockReturnValue(refundEvent(refund));
    const reconcile = vi.fn(() => ({ data: { reconciled: true, applied: true }, error: null }));
    const supabase = createSupabaseAdminMock({
      rpc: { reconcile_stripe_refund: reconcile },
      tables: {
        stripe_events: () => {
          throw new Error("checkout-path stripe_events query should never run for a refund event");
        },
      },
    });
    getSupabaseAdmin.mockReturnValue(supabase);

    const response = await postWebhook();
    expect(response.status).toBe(200);
  });
});
