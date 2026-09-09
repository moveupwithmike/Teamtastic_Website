import {
  authorizeServiceRole,
  authorizeWebhook,
  errorText,
  functionError,
  resolveInjectedSecretKey,
} from "../functions/_shared/runtime.ts";

function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }

Deno.test("authorizeWebhook rejects unsupported methods before reading secrets", async () => {
  const response = await authorizeWebhook(new Request("https://example.com", { method: "GET" }), "TEST_WEBHOOK_SECRET");
  assert(response?.status === 405, "expected method rejection");
});

Deno.test("authorizeWebhook rejects missing and incorrect credentials", async () => {
  Deno.env.set("TEST_WEBHOOK_SECRET", "expected-secret");
  try {
    const missing = await authorizeWebhook(new Request("https://example.com", { method: "POST" }), "TEST_WEBHOOK_SECRET");
    const wrong = await authorizeWebhook(new Request("https://example.com", {
      method: "POST", headers: { "x-webhook-secret": "wrong-secret" },
    }), "TEST_WEBHOOK_SECRET");
    assert(missing?.status === 401 && wrong?.status === 401, "expected unauthorized responses");
  } finally {
    Deno.env.delete("TEST_WEBHOOK_SECRET");
  }
});

Deno.test("authorizeWebhook accepts the configured credential", async () => {
  Deno.env.set("TEST_WEBHOOK_SECRET", "expected-secret");
  try {
    const response = await authorizeWebhook(new Request("https://example.com", {
      method: "POST", headers: { "x-webhook-secret": "expected-secret" },
    }), "TEST_WEBHOOK_SECRET");
    assert(response === null, "expected authorization to succeed");
  } finally {
    Deno.env.delete("TEST_WEBHOOK_SECRET");
  }
});

Deno.test("runtime error helpers preserve safe error information", async () => {
  assert(errorText({ message: "query failed", code: "PGRST123" }) === "query failed (code: PGRST123)", "expected error details");
  const response = functionError("service_failed", 503);
  assert(response.status === 503, "expected custom status");
  assert((await response.json()).error === "service_failed", "expected stable error code");
});

Deno.test("new named Supabase secret keys take precedence over the legacy key", () => {
  Deno.env.set("SUPABASE_SECRET_KEYS", JSON.stringify({ default: "sb_secret_modern" }));
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "legacy-service-role");
  try {
    assert(resolveInjectedSecretKey() === "sb_secret_modern", "expected modern secret key");
  } finally {
    Deno.env.delete("SUPABASE_SECRET_KEYS");
    Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
  }
});

Deno.test("service authorization accepts a modern key on apikey", async () => {
  Deno.env.set("SUPABASE_SECRET_KEYS", JSON.stringify({ default: "sb_secret_modern" }));
  try {
    const request = new Request("https://example.com", {
      method: "POST",
      headers: { apikey: "sb_secret_modern" },
    });
    assert(await authorizeServiceRole(request), "expected service authorization to succeed");
  } finally {
    Deno.env.delete("SUPABASE_SECRET_KEYS");
  }
});
