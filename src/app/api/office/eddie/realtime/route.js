import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { getOfficeUser } from "@/lib/server/office-auth";
import { hashKey, rateLimited } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_SDP_BYTES = 100_000;
const REALTIME_URL = "https://api.openai.com/v1/realtime/calls";

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

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return fail(503, "realtime_not_configured");
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/sdp")) {
    return fail(415, "sdp_required");
  }
  if (Number(request.headers.get("content-length") || 0) > MAX_SDP_BYTES) return fail(413, "request_too_large");

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
  if (rateLimited(hashKey("eddie-realtime", user.id || user.email, ip), { windowMs: 60_000, max: 5 })) {
    return fail(429, "slow_down");
  }

  const sdp = await request.text();
  if (!sdp || Buffer.byteLength(sdp) > MAX_SDP_BYTES) return fail(400, "sdp_required");

  const form = new FormData();
  form.set("sdp", sdp);
  form.set("session", JSON.stringify({
    type: "realtime",
    model: process.env.OPENAI_REALTIME_MODEL || "gpt-realtime-2.1",
    instructions: "You are Eddie's private voice renderer. Do not answer microphone input yourself. Automatic responses are disabled. When the application explicitly requests a response, speak the supplied approved text faithfully in a warm, concise business-assistant voice. Never claim an action happened and never add promises, figures, names, or instructions that are not in the supplied text.",
    audio: {
      input: {
        transcription: { model: "gpt-4o-mini-transcribe", language: "en" },
        noise_reduction: { type: "near_field" },
        turn_detection: {
          type: "server_vad",
          create_response: false,
          interrupt_response: true,
          silence_duration_ms: 550,
        },
      },
      output: { voice: "marin" },
    },
  }));

  let upstream;
  try {
    upstream = await fetch(REALTIME_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "OpenAI-Safety-Identifier": createHash("sha256").update(String(user.id || user.email)).digest("hex"),
      },
      body: form,
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    console.error("Eddie Realtime session failed", { message: error?.message });
    return fail(503, "realtime_unavailable");
  }

  const answer = await upstream.text();
  if (!upstream.ok || !answer) {
    console.error("Eddie Realtime session rejected", { status: upstream.status, detail: answer.slice(0, 300) });
    return fail(503, "realtime_unavailable");
  }
  return new Response(answer, { status: 200, headers: { "content-type": "application/sdp" } });
}
