import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { verifyTurnstile } from "@/lib/server/turnstile";
import { rateLimited } from "@/lib/server/rate-limit";
import { AVAILABILITY_COOKIE, createAvailabilityAccess } from "@/lib/server/availability-access";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
  const key = createHash("sha256").update(`availability-access:${ip}`).digest("hex");
  if (rateLimited(key, { windowMs: 10 * 60 * 1000, max: 5 })) {
    return NextResponse.json({ success: false, reason: "rate_limited" }, { status: 429 });
  }
  try {
    if (!(await verifyTurnstile(String(body.turnstileToken || "").slice(0, 2048), ip))) {
      return NextResponse.json({ success: false, reason: "bot_verification_failed" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ success: false, reason: "verification_unavailable" }, { status: 503 });
  }
  const response = NextResponse.json({ success: true });
  response.cookies.set(AVAILABILITY_COOKIE, createAvailabilityAccess(), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
    path: "/api/bookings/availability", maxAge: 15 * 60,
  });
  return response;
}
