import { NextResponse } from "next/server";
import { getOfficeUser } from "@/lib/server/office-auth";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import { hashKey, rateLimited } from "@/lib/server/rate-limit";
import { askEddie, EddieError, executeEddieAction } from "@/lib/server/office/eddie";

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
  if (Number(request.headers.get("content-length") || 0) > 50_000) return fail(413, "request_too_large");

  let body;
  try {
    body = await request.json();
  } catch {
    return fail(400, "invalid_json");
  }

  const mode = body?.mode === "execute" ? "execute" : "chat";
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
  const limit = mode === "execute" ? { windowMs: 60_000, max: 10 } : { windowMs: 60_000, max: 20 };
  if (rateLimited(hashKey("eddie", mode, user.id || user.email, ip), limit)) return fail(429, "slow_down");

  try {
    const db = getSupabaseAdmin();
    const result = mode === "execute"
      ? await executeEddieAction({ db, user, token: body?.token })
      : await askEddie({ db, user, messages: body?.messages });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof EddieError) return fail(error.status, error.code);
    console.error("Eddie request failed", { message: error?.message });
    return fail(503, "eddie_unavailable");
  }
}
