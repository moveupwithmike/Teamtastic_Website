import { createClient } from "https://esm.sh/@supabase/supabase-js@2.106.1";

export type ServiceClient = ReturnType<typeof createClient>;

export function serviceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Supabase service configuration is missing");
  return createClient(url, key);
}

export function authorizeWebhook(request: Request, secretName: string) {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const expected = Deno.env.get(secretName);
  if (!expected || request.headers.get("x-webhook-secret") !== expected) {
    return new Response("Unauthorized", { status: 401 });
  }
  return null;
}

export function errorText(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const code = "code" in error ? ` (code: ${String((error as { code: unknown }).code)})` : "";
    return `${String((error as { message: unknown }).message)}${code}`;
  }
  try { return JSON.stringify(error); } catch { return String(error); }
}

export function functionError(code: string, status = 500) {
  return Response.json({ error: code }, { status });
}
