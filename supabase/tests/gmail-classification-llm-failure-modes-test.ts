// Regression coverage for classifyReply/classifyWithLLM's failure handling.
//
// The production requirement (see docs/.../TEAMTASTIC_INBOUND_CLASSIFIER_CERTIFICATION.md,
// section "LLM Failure Modes"): a failed, slow, or malformed AI call must never lose an
// inbound lead. classifyReply's try/catch around classifyWithLLM must always fall back to
// the deterministic regex path, and classifyWithLLM must never accept an unusable response.
//
// fetch is stubbed per-test (no network access, no ANTHROPIC_API_KEY required beyond a
// placeholder value so the "not configured" branch isn't what's under test here).

import { classifyReply, classifyWithLLM } from "../functions/_shared/gmail-classification.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const noop = (error: unknown) => String(error);

function withStubbedFetch(stub: typeof fetch, run: () => Promise<void>) {
  const original = globalThis.fetch;
  globalThis.fetch = stub;
  Deno.env.set("ANTHROPIC_API_KEY", "test-key-not-real");
  return run().finally(() => {
    globalThis.fetch = original;
  });
}

Deno.test("classifyWithLLM throws when ANTHROPIC_API_KEY is not configured", async () => {
  const original = Deno.env.get("ANTHROPIC_API_KEY");
  Deno.env.delete("ANTHROPIC_API_KEY");
  try {
    let threw = false;
    try {
      await classifyWithLLM("subject", "body");
    } catch (error) {
      threw = true;
      assert(String((error as Error).message).includes("not configured"), "should report missing key");
    }
    assert(threw, "must throw, not silently proceed, when no key is configured");
  } finally {
    if (original) Deno.env.set("ANTHROPIC_API_KEY", original);
  }
});

Deno.test("classifyReply falls back to regex on a provider error (non-2xx response)", async () => {
  await withStubbedFetch(
    () => Promise.resolve(new Response("rate limited", { status: 429 })),
    async () => {
      const result = await classifyReply("subject", "I'd like to learn more, sounds great", true, noop);
      assert(result.method === "regex", `expected regex fallback, got ${result.method}`);
      assert(result.classification === "interested", `expected interested, got ${result.classification}`);
    },
  );
});

Deno.test("classifyReply falls back to regex on a request timeout / network failure", async () => {
  await withStubbedFetch(
    () => Promise.reject(new DOMException("The signal has been aborted", "AbortError")),
    async () => {
      const result = await classifyReply("subject", "Can you send pricing for 75 people?", true, noop);
      assert(result.method === "regex", `expected regex fallback, got ${result.method}`);
      assert(result.classification === "pricing_request", `expected pricing_request, got ${result.classification}`);
    },
  );
});

Deno.test("classifyReply falls back to regex on malformed (non-JSON) response body", async () => {
  await withStubbedFetch(
    () => Promise.resolve(new Response("not json{{{", { status: 200 })),
    async () => {
      const result = await classifyReply("subject", "not interested, we're all set", true, noop);
      assert(result.method === "regex", `expected regex fallback, got ${result.method}`);
      assert(result.classification === "not_interested", `expected not_interested, got ${result.classification}`);
    },
  );
});

Deno.test("classifyReply falls back to regex when the model returns an out-of-enum label", async () => {
  await withStubbedFetch(
    () =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            content: [{ type: "tool_use", input: { classification: "closed_won", confidence: 0.9, reason: "hallucinated" } }],
          }),
          { status: 200 },
        ),
      ),
    async () => {
      const result = await classifyReply("subject", "book a call next Thursday please", true, noop);
      assert(result.method === "regex", `expected regex fallback, got ${result.method}`);
      assert(result.classification === "booking_request", `expected booking_request, got ${result.classification}`);
    },
  );
});

Deno.test("classifyReply falls back to regex when the model omits a numeric confidence", async () => {
  await withStubbedFetch(
    () =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            content: [{ type: "tool_use", input: { classification: "interested", confidence: "high", reason: "vibes" } }],
          }),
          { status: 200 },
        ),
      ),
    async () => {
      const result = await classifyReply("subject", "sounds good, tell me more", true, noop);
      assert(result.method === "regex", `expected regex fallback, got ${result.method}`);
    },
  );
});

Deno.test("classifyReply falls back to regex when confidence is out of the valid [0,1] range", async () => {
  await withStubbedFetch(
    () =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            content: [{ type: "tool_use", input: { classification: "interested", confidence: 1.5, reason: "overconfident" } }],
          }),
          { status: 200 },
        ),
      ),
    async () => {
      const result = await classifyReply("subject", "sounds good, tell me more", true, noop);
      assert(result.method === "regex", `expected regex fallback, got ${result.method}`);
    },
  );
});

Deno.test("classifyReply falls back to regex when no tool_use block is present at all", async () => {
  await withStubbedFetch(
    () => Promise.resolve(new Response(JSON.stringify({ content: [{ type: "text", text: "I refuse to classify this." }] }), { status: 200 })),
    async () => {
      const result = await classifyReply("subject", "no thanks, not a fit", true, noop);
      assert(result.method === "regex", `expected regex fallback, got ${result.method}`);
      assert(result.classification === "not_interested", `expected not_interested, got ${result.classification}`);
    },
  );
});

Deno.test("classifyReply never reaches the LLM for hard-stop content, regardless of llmEnabled", async () => {
  let fetchCalled = false;
  await withStubbedFetch(
    () => {
      fetchCalled = true;
      return Promise.resolve(new Response("{}", { status: 200 }));
    },
    async () => {
      const result = await classifyReply("subject", "please unsubscribe me from this list", true, noop);
      assert(result.classification === "unsubscribe", `expected unsubscribe, got ${result.classification}`);
      assert(!fetchCalled, "hard-stop classification must never call the network/LLM");
    },
  );
});

Deno.test("classifyReply skips the LLM entirely and uses regex directly when llmEnabled is false", async () => {
  let fetchCalled = false;
  await withStubbedFetch(
    () => {
      fetchCalled = true;
      return Promise.resolve(new Response("{}", { status: 200 }));
    },
    async () => {
      const result = await classifyReply("subject", "sounds good, tell me more", false, noop);
      assert(result.method === "regex", `expected regex, got ${result.method}`);
      assert(!fetchCalled, "LLM must not be called when llmEnabled is false");
    },
  );
});

Deno.test("classifyReply succeeds via LLM when the model returns a well-formed, in-enum response", async () => {
  await withStubbedFetch(
    () =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            content: [{ type: "tool_use", input: { classification: "objection", confidence: 0.8, reason: "budget concern" } }],
          }),
          { status: 200 },
        ),
      ),
    async () => {
      const result = await classifyReply("subject", "this seems pricey for our budget", true, noop);
      assert(result.method === "llm", `expected llm, got ${result.method}`);
      assert(result.classification === "objection", `expected objection, got ${result.classification}`);
    },
  );
});
