// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendViaResend } from "./email";

/**
 * @param {{ reservation?: { allowed: boolean, reason?: string }, reserveError?: { message: string } | null }} [options]
 */
function makeSupabase({ reservation = { allowed: true }, reserveError = null } = {}) {
  const rpc = vi.fn((name) => {
    if (name === "reserve_email_send") return Promise.resolve({ data: reservation, error: reserveError });
    if (name === "record_email_send_result") return Promise.resolve({ data: null, error: null });
    throw new Error(`unexpected rpc: ${name}`);
  });
  return { rpc };
}

const fetchMock = vi.fn();

describe("sendViaResend", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.RESEND_API_KEY = "resend_test_key";
    process.env.RESEND_FROM_EMAIL = "alerts@teamtastic.com";
    fetchMock.mockReset();
    global.fetch = /** @type {typeof fetch} */ (/** @type {unknown} */ (fetchMock));
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("does not call Resend when the reservation is denied", async () => {
    const supabase = makeSupabase({ reservation: { allowed: false, reason: "daily_limit_reached" } });
    const result = await sendViaResend(supabase, {
      messageType: "booking", recipient: "jordan@example.com", subject: "Hi", text: "Hi",
      idempotencyKey: "booking/cancel/booking_1",
    });
    expect(result).toEqual({ sent: false, reserved: false, providerMessageId: null, reason: "daily_limit_reached" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends idempotently through Resend and records success on a 2xx response with an id", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({ id: "msg_123" }) });
    const supabase = makeSupabase();
    const result = await sendViaResend(supabase, {
      messageType: "booking", recipient: "jordan@example.com", subject: "Confirmed", text: "See you then",
      idempotencyKey: "booking/confirm/booking_1",
    });
    expect(result).toEqual({ sent: true, reserved: true, providerMessageId: "msg_123", reason: null });
    expect(supabase.rpc).toHaveBeenCalledWith("record_email_send_result", { p_message_type: "booking", p_sent: true });
    expect(fetchMock).toHaveBeenCalledWith("https://api.resend.com/emails", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ "Idempotency-Key": "booking/confirm/booking_1" }),
    }));
  });

  it("fails closed before reserving when the idempotency key is missing", async () => {
    const supabase = makeSupabase();
    // @ts-expect-error Verify the runtime guard for untyped JavaScript callers.
    const result = await sendViaResend(supabase, {
      messageType: "proposal", recipient: "lead@example.com", subject: "Proposal", text: "…",
    });
    expect(result).toEqual({ sent: false, reserved: false, providerMessageId: null, reason: "idempotency_key_required" });
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("records failure and returns a reason when Resend responds with an error status", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 422, json: () => Promise.resolve({ message: "invalid recipient" }) });
    const supabase = makeSupabase();
    const result = await sendViaResend(supabase, {
      messageType: "booking", recipient: "bad@example", subject: "Hi", text: "Hi",
      idempotencyKey: "booking/confirm/booking_bad",
    });
    expect(result.sent).toBe(false);
    expect(result.reason).toBe("invalid recipient");
    expect(supabase.rpc).toHaveBeenCalledWith("record_email_send_result", { p_message_type: "booking", p_sent: false });
  });

  it("records failure and returns a reason when the request itself throws", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    const supabase = makeSupabase();
    const result = await sendViaResend(supabase, {
      messageType: "booking", recipient: "jordan@example.com", subject: "Hi", text: "Hi",
      idempotencyKey: "booking/reschedule/booking_1",
    });
    expect(result.sent).toBe(false);
    expect(result.reason).toBe("network down");
    expect(supabase.rpc).toHaveBeenCalledWith("record_email_send_result", { p_message_type: "booking", p_sent: false });
  });

  it("includes an html body when one is supplied, alongside text", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({ id: "msg_789" }) });
    const supabase = makeSupabase();
    await sendViaResend(supabase, {
      messageType: "internal_notification", recipient: "michael@teamtastic.com",
      subject: "Sign in", text: "plain", html: "<p>html</p>",
      idempotencyKey: "office-magic-link/token_1",
    });
    const [, init] = fetchMock.mock.calls[0];
    const payload = JSON.parse(init.body);
    expect(payload.text).toBe("plain");
    expect(payload.html).toBe("<p>html</p>");
  });
});
