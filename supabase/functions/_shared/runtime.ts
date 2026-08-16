import { createClient } from "https://esm.sh/@supabase/supabase-js@2.106.1";

export type ServiceClient = ReturnType<typeof createClient>;

export function serviceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Supabase service configuration is missing");
  return createClient(url, key);
}

// Hashing both sides first fixes the comparison at a constant 32 bytes
// regardless of input length, so neither the byte-by-byte XOR loop below nor
// the earlier "do the lengths match" step can leak timing information about
// the secret — a plain `===`/`!==` on the raw strings would.
async function timingSafeEqual(a: string, b: string) {
  const encoder = new TextEncoder();
  const [hashA, hashB] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(a)),
    crypto.subtle.digest("SHA-256", encoder.encode(b)),
  ]);
  const bytesA = new Uint8Array(hashA);
  const bytesB = new Uint8Array(hashB);
  let diff = 0;
  for (let i = 0; i < bytesA.length; i++) diff |= bytesA[i] ^ bytesB[i];
  return diff === 0;
}

export async function authorizeWebhook(request: Request, secretName: string) {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const expected = Deno.env.get(secretName);
  const provided = request.headers.get("x-webhook-secret");
  if (!expected || !provided || !(await timingSafeEqual(provided, expected))) {
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
