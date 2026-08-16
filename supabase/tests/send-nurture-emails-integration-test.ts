import { handleNurtureRequest } from "../functions/send-nurture-emails/handler.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

type Call = { method: string; args: unknown[] };

function fakeQuery(table: string, writes: Array<{ table: string; value: unknown }>) {
  const calls: Call[] = [];
  const query: Record<string, unknown> = {};
  for (const method of ["select", "eq", "lte", "gte", "in"]) {
    query[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return query;
    };
  }
  for (const method of ["insert", "upsert"]) {
    query[method] = (value: unknown) => {
      calls.push({ method, args: [value] });
      writes.push({ table, value });
      return query;
    };
  }
  query.then = (resolve: (value: unknown) => unknown) => {
    if (table === "leads") {
      return Promise.resolve(resolve({
        data: [{
          id: "lead_1",
          prospect_id: "prospect_1",
          email: "buyer@example.com",
          name: "Jordan",
          submission_id: "submission_1",
          recommendation_key: "social",
          created_at: "2026-08-14T12:00:00.000Z",
        }],
        error: null,
      }));
    }
    if (table === "notification_deliveries" && calls.some((call) => call.method === "select")) {
      return Promise.resolve(resolve({ data: [], error: null }));
    }
    return Promise.resolve(resolve({ data: null, error: null }));
  };
  return query;
}

Deno.test("send-nurture-emails handles an authenticated due lead end to end", async () => {
  const writes: Array<{ table: string; value: unknown }> = [];
  const sends: Array<Record<string, unknown>> = [];
  const client = {
    from(table: string) {
      return fakeQuery(table, writes);
    },
    rpc(name: string) {
      if (name === "lead_has_paid_hosted_event") return Promise.resolve({ data: false, error: null });
      throw new Error(`unexpected rpc: ${name}`);
    },
  };

  const response = await handleNurtureRequest(new Request("https://example.test/functions/v1/send-nurture-emails", {
    method: "POST",
  }), {
    authorize: () => Promise.resolve(null),
    createClient: () => client,
      sendEmail: (_client: unknown, options: Record<string, unknown>) => {
      sends.push(options as unknown as Record<string, unknown>);
      return Promise.resolve({ sent: true, reserved: true, providerMessageId: "email_1", reason: null, status: 200 });
    },
    now: () => Date.parse("2026-08-16T12:00:00.000Z"),
  } as never);

  assert(response.status === 200, "expected a successful handler response");
  const payload = await response.json();
  assert(payload.processed === 1 && payload.sent === 1, "expected one processed and sent lead");
  assert(sends.length === 1, "expected one email delivery");
  assert(sends[0].idempotencyKey === "nurture/lead_1/nurture_day1", "expected a stable idempotency key");
  assert(writes.some((write) => write.table === "notification_deliveries"), "expected delivery state to be persisted");
  assert(writes.some((write) => write.table === "messages"), "expected the outbound message to be logged");
});
