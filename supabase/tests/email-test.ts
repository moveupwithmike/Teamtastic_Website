import { sendViaResend } from "../functions/_shared/email.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

type RpcCall = { name: string; args: Record<string, unknown> };

function rpcClient(calls: RpcCall[], reservation: { allowed: boolean; reason?: string } = { allowed: true }) {
  return {
    rpc(name: string, args: Record<string, unknown>) {
      calls.push({ name, args });
      return Promise.resolve({ data: name === "reserve_email_send" ? reservation : null, error: null });
    },
  };
}

Deno.test("sendViaResend reserves, sends idempotently, and records success", async () => {
  const calls: RpcCall[] = [];
  let request: RequestInit | undefined;
  const result = await sendViaResend(rpcClient(calls), {
    messageType: "nurture",
    recipient: "buyer@example.com",
    idempotencyKey: "nurture/lead-1/day-1",
    from: "Teamtastic <hello@example.com>",
    to: "buyer@example.com",
    subject: "Hello",
    text: "Welcome",
    apiKey: "test-key",
    fetcher: (_url, init) => {
      request = init;
      return Promise.resolve(Response.json({ id: "email_123" }));
    },
  });

  assert(result.sent && result.reserved, "expected a reserved, successful send");
  assert(result.providerMessageId === "email_123", "expected the provider message id");
  assert(calls[0]?.name === "reserve_email_send", "expected reservation before delivery");
  assert(calls[1]?.name === "record_email_send_result", "expected the result to be recorded");
  assert(calls[1]?.args.p_sent === true, "expected the successful result to be recorded");
  const body = JSON.parse(String(request?.body));
  assert(Array.isArray(body.to) && body.to[0] === "buyer@example.com", "expected a normalized recipient array");
  const headers = request?.headers as Record<string, string>;
  assert(headers["Idempotency-Key"] === "nurture/lead-1/day-1", "expected the required idempotency key");
});

Deno.test("sendViaResend never calls Resend when reservation is blocked", async () => {
  const calls: RpcCall[] = [];
  let fetched = false;
  const result = await sendViaResend(rpcClient(calls, { allowed: false, reason: "daily_cap" }), {
    messageType: "nurture",
    recipient: "buyer@example.com",
    idempotencyKey: "nurture/lead-1/day-1",
    from: "hello@example.com",
    to: "buyer@example.com",
    subject: "Hello",
    apiKey: "test-key",
    fetcher: () => {
      fetched = true;
      return Promise.resolve(Response.json({ id: "unexpected" }));
    },
  });

  assert(!result.sent && !result.reserved, "expected a blocked reservation");
  assert(result.reason === "daily_cap", "expected the reservation reason");
  assert(!fetched, "Resend must not be called after a blocked reservation");
  assert(calls.length === 1, "a blocked reservation must not record a send result");
});

Deno.test("sendViaResend records provider failures", async () => {
  const calls: RpcCall[] = [];
  const result = await sendViaResend(rpcClient(calls), {
    messageType: "internal_notification",
    recipient: "buyer@example.com",
    idempotencyKey: "daily-sales-report/2026-08-16",
    from: "hello@example.com",
    to: ["buyer@example.com"],
    subject: "Hello",
    apiKey: "test-key",
    fetcher: () => Promise.resolve(Response.json({ message: "Rejected" }, { status: 422 })),
  });

  assert(!result.sent && result.reserved, "expected a reserved, failed send");
  assert(result.status === 422 && result.reason === "Rejected", "expected the provider failure");
  assert(calls[1]?.name === "record_email_send_result", "expected the failure to be recorded");
  assert(calls[1]?.args.p_sent === false, "expected p_sent=false");
});

Deno.test("sendViaResend requires idempotency before reserving", async () => {
  const calls: RpcCall[] = [];
  const result = await sendViaResend(rpcClient(calls), {
    messageType: "booking",
    recipient: "buyer@example.com",
    idempotencyKey: " ",
    from: "hello@example.com",
    to: "buyer@example.com",
    subject: "Hello",
  });

  assert(!result.sent && !result.reserved, "expected an invalid send to be rejected");
  assert(result.reason === "idempotency_key_required", "expected a stable validation reason");
  assert(calls.length === 0, "invalid input must not consume a reservation");
});
