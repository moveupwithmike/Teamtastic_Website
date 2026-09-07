import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import { buildMorningProposals } from "@/lib/server/office/social-generator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

export function isEasternMorningWindow(date = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
  return parts.hour === 8 && parts.minute >= 10 && parts.minute < 20;
}

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ success: false, reason: "cron_not_configured" }, { status: 503 });
  if (!safeEqual(request.headers.get("authorization"), `Bearer ${secret}`)) {
    return NextResponse.json({ success: false, reason: "unauthorized" }, { status: 401 });
  }

  // The Vercel schedule checks both possible UTC times around daylight-saving
  // changes. Only the request that lands at 8:10 Eastern performs work.
  const now = new Date();
  if (!isEasternMorningWindow(now)) {
    return NextResponse.json({ success: true, skipped: true, reason: "outside_eastern_morning_window" });
  }

  const result = await buildMorningProposals({ db: getSupabaseAdmin(), now, trigger: "vercel_cron" });
  return NextResponse.json({ success: result.enabled, ...result }, { status: result.enabled ? 200 : 503 });
}
