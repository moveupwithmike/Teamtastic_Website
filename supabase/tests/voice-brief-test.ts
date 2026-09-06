// Coverage for the spoken morning brief's LLM summary step
// (_shared/voice-brief.ts), extracted from generate-daily-voice-brief so it
// can be exercised here with a stubbed fetch, no network access, and no
// AI_GATEWAY_API_KEY required. Mirrors the fetch-stubbing style already
// established in gmail-classification-llm-failure-modes-test.ts.
//
// generateSpeech (the actual text-to-speech call) is NOT covered here -- it
// goes through the `ai`/`@ai-sdk/gateway` npm packages rather than a plain
// fetch call, so it isn't cleanly unit-testable with this same stubbing
// technique. Its caller in generate-daily-voice-brief/index.ts wraps it in a
// try/catch that always degrades to voice_brief_status:'unavailable' on any
// failure -- that behavior is what actually matters and is covered by
// generateSummary's own failure-mode tests below plus manual/staging
// verification, per the project's earlier voice-brief verification plan.

import { generateSummary, reportDate } from "../functions/_shared/voice-brief.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function withStubbedFetch(stub: typeof fetch, run: () => Promise<void>) {
  const original = globalThis.fetch;
  globalThis.fetch = stub;
  return run().finally(() => {
    globalThis.fetch = original;
  });
}

function anthropicResponse(text: string) {
  return Promise.resolve(
    new Response(
      JSON.stringify({ content: [{ type: "text", text }] }),
      { status: 200, headers: { "content-type": "application/json" } },
    ),
  );
}

Deno.test("reportDate returns a YYYY-MM-DD string", () => {
  const date = reportDate();
  assert(/^\d{4}-\d{2}-\d{2}$/.test(date), `expected YYYY-MM-DD, got ${date}`);
});

Deno.test("generateSummary returns the model's text on a well-formed response", async () => {
  await withStubbedFetch(
    () => anthropicResponse('Good morning, this is Eddie. Everything looks calm today.'),
    async () => {
      const text = await generateSummary("test-key", { new_leads: 2 }, [], { available: true });
      assert(text.startsWith("Good morning, this is Eddie."), `unexpected text: ${text}`);
    },
  );
});

Deno.test("generateSummary throws (never silently returns empty) on a non-2xx response", async () => {
  await withStubbedFetch(
    () => Promise.resolve(new Response("rate limited", { status: 429 })),
    async () => {
      let threw = false;
      try {
        await generateSummary("test-key", {}, [], {});
      } catch (error) {
        threw = true;
        assert(String((error as Error).message).includes("AI Gateway summary 429"), `unexpected message: ${(error as Error).message}`);
      }
      assert(threw, "must throw on a provider error, not silently proceed");
    },
  );
});

Deno.test("generateSummary throws on a request timeout / network failure", async () => {
  await withStubbedFetch(
    () => Promise.reject(new DOMException("The signal has been aborted", "AbortError")),
    async () => {
      let threw = false;
      try {
        await generateSummary("test-key", {}, [], {});
      } catch {
        threw = true;
      }
      assert(threw, "must throw on a network/timeout failure");
    },
  );
});

Deno.test("generateSummary throws when the response has no text content block", async () => {
  await withStubbedFetch(
    () => Promise.resolve(new Response(JSON.stringify({ content: [] }), { status: 200 })),
    async () => {
      let threw = false;
      try {
        await generateSummary("test-key", {}, [], {});
      } catch (error) {
        threw = true;
        assert(String((error as Error).message).includes("returned no text content"), `unexpected message: ${(error as Error).message}`);
      }
      assert(threw, "must throw rather than return an empty/undefined script");
    },
  );
});

Deno.test("generateSummary throws when the response body is not valid JSON", async () => {
  await withStubbedFetch(
    () => Promise.resolve(new Response("not json{{{", { status: 200 })),
    async () => {
      let threw = false;
      try {
        await generateSummary("test-key", {}, [], {});
      } catch {
        threw = true;
      }
      assert(threw, "must throw rather than proceed with an unparseable response");
    },
  );
});

Deno.test("generateSummary tells the model plainly when no marketing platforms are connected", async () => {
  let capturedBody = "";
  await withStubbedFetch(
    (_input, init) => {
      capturedBody = String(init?.body || "");
      return anthropicResponse("Good morning, this is Eddie.");
    },
    async () => {
      await generateSummary("test-key", {}, [], {});
    },
  );
  assert(capturedBody.includes("No marketing platform data is connected yet."), "must state plainly that no platform is connected, not omit the topic");
});

Deno.test("generateSummary includes marketing snapshots in the prompt when present", async () => {
  let capturedBody = "";
  const snapshots = [{ platform: "google_analytics", snapshot_date: "2026-09-05", metrics: { channels: [] } }];
  await withStubbedFetch(
    (_input, init) => {
      capturedBody = String(init?.body || "");
      return anthropicResponse("Good morning, this is Eddie.");
    },
    async () => {
      await generateSummary("test-key", {}, snapshots, {});
    },
  );
  assert(capturedBody.includes("google_analytics"), "must pass real marketing snapshot data into the prompt when present");
});
