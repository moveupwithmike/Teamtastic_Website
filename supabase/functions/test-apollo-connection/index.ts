import "jsr:@supabase/functions-js/edge-runtime.d.ts";

function json(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status });
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (request.headers.get("x-webhook-secret") !== Deno.env.get("APOLLO_TEST_WEBHOOK_SECRET")) {
    return new Response("Unauthorized", { status: 401 });
  }

  const apiKey = Deno.env.get("APOLLO_API_KEY");
  if (!apiKey) return json({ connected: false, reason: "apollo_key_missing", credits_consumed: 0 }, 500);
  const headers = {
    "Accept": "application/json",
    "Content-Type": "application/json",
    "Cache-Control": "no-cache",
    "x-api-key": apiKey,
  };

  try {
    const health = await fetch("https://api.apollo.io/v1/auth/health", {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(15_000),
    });
    if (!health.ok) {
      return json({ connected: false, health_status: health.status, master_access: false, credits_consumed: 0 }, 200);
    }

    const usage = await fetch("https://api.apollo.io/api/v1/usage_stats/api_usage_stats", {
      method: "POST",
      headers,
      body: "{}",
      signal: AbortSignal.timeout(15_000),
    });
    return json({
      connected: true,
      health_status: health.status,
      master_access: usage.ok,
      usage_status: usage.status,
      credits_consumed: 0,
      contact_search_performed: false,
      email_sent: false,
    });
  } catch (error) {
    return json({
      connected: false,
      reason: error instanceof Error ? error.message : "apollo_connection_error",
      credits_consumed: 0,
    }, 500);
  }
});
