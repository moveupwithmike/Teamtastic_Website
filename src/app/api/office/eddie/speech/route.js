import { NextResponse } from "next/server";
import { getOfficeUser } from "@/lib/server/office-auth";
import { hashKey, rateLimited } from "@/lib/server/rate-limit";
import { createEddieSpeech, ElevenLabsSpeechError } from "@/lib/server/office/elevenlabs-speech";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fail(status, reason) {
  return NextResponse.json({ success: false, reason }, { status });
}

function sameOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const allowed = new Set([new URL(request.url).origin]);
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    try { allowed.add(new URL(process.env.NEXT_PUBLIC_SITE_URL).origin); } catch { /* Invalid configuration cannot expand access. */ }
  }
  return allowed.has(origin);
}

export async function POST(request) {
  if (!sameOrigin(request)) return fail(403, "origin_not_allowed");
  const user = await getOfficeUser();
  if (!user?.email) return fail(401, "office_login_required");
  if (Number(request.headers.get("content-length") || 0) > 20_000) return fail(413, "request_too_large");

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
  if (rateLimited(hashKey("eddie-speech", user.id || user.email, ip), { windowMs: 60_000, max: 30 })) {
    return fail(429, "slow_down");
  }

  let body;
  try { body = await request.json(); } catch { return fail(400, "invalid_json"); }
  const text = String(body?.text || "").trim();
  if (!text || text.length > 4_000) return fail(400, "speech_text_required");

  try {
    const upstream = await createEddieSpeech(text);
    return new Response(upstream.body, {
      status: 200,
      headers: {
        "content-type": upstream.headers.get("content-type") || "audio/mpeg",
        "cache-control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof ElevenLabsSpeechError) return fail(error.status, error.code);
    console.error("Eddie speech generation failed", { message: error?.message });
    return fail(503, "elevenlabs_unavailable");
  }
}
