import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";

export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const [{ data: systemConfig, error: configError }, { data: settings, error: settingsError }, { data: types, error: typesError }] = await Promise.all([
      supabase.from("system_config").select("master_enabled,native_booking_enabled").eq("id", true).single(),
      supabase.from("booking_settings").select("enabled,owner_timezone,calendar_connection_status,zoom_connection_status,minimum_notice_minutes").eq("id", true).single(),
      supabase.from("booking_types").select("slug,name,description,duration_minutes,zoom_enabled,sort_order").eq("active", true).order("sort_order"),
    ]);
    if (configError || settingsError || typesError) throw configError || settingsError || typesError;

    const ready = Boolean(
      systemConfig?.master_enabled &&
      systemConfig?.native_booking_enabled &&
      settings?.enabled &&
      settings?.calendar_connection_status === "connected"
    );
    return NextResponse.json({
      ready,
      ownerTimezone: settings?.owner_timezone || "America/New_York",
      minimumNoticeMinutes: settings?.minimum_notice_minutes ?? 1440,
      calendarConnected: settings?.calendar_connection_status === "connected",
      zoomConnected: settings?.zoom_connection_status === "connected",
      bookingTypes: types || [],
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Booking configuration failed", { code: error?.code || "unknown" });
    return NextResponse.json({ ready: false, bookingTypes: [] }, { status: 503 });
  }
}
