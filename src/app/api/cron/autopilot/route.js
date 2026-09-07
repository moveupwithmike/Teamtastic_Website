import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import { runDailyAutopilot } from "@/lib/server/office/autopilot";
import { isEasternAutopilotWindow } from "@/lib/server/office/cron-windows";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

// Runs at 7:10 Eastern, an hour before the standalone morning generator, so it
// composes the same loop without double-generation (each step stays idempotent).
export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ success: false, reason: "cron_not_configured" }, { status: 503 });
  if (!safeEqual(request.headers.get("authorization"), `Bearer ${secret}`)) {
    return NextResponse.json({ success: false, reason: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  if (!isEasternAutopilotWindow(now)) {
    return NextResponse.json({ success: true, skipped: true, reason: "outside_eastern_autopilot_window" });
  }

  const result = await runDailyAutopilot({ db: getSupabaseAdmin(), now, trigger: "vercel_cron" });
  return NextResponse.json({ success: result.enabled, ...result }, { status: result.enabled ? 200 : 503 });
}
