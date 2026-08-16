import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import { getCalendarBusyRanges } from "@/lib/server/google-calendar";
import { addWallMinutes, overlaps, validTimeZone, wallMinutes, weekdayForDate, zonedWallTimeToUtc } from "@/lib/server/booking-time";
import { hashKey, RATE_LIMIT_TIERS, rateLimited } from "@/lib/server/rate-limit";
import { AVAILABILITY_COOKIE, validAvailabilityAccess } from "@/lib/server/availability-access";

export const runtime = "nodejs";

function unavailable(reason, status = 503) {
  return NextResponse.json({ available: false, reason, slots: [] }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") || "";
  const bookingTypeSlug = searchParams.get("type") || "intro-call-15";
  const visitorTimezone = searchParams.get("timezone") || "America/New_York";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !validTimeZone(visitorTimezone)) return unavailable("invalid_request", 400);
  if (!validAvailabilityAccess(request.cookies.get(AVAILABILITY_COOKIE)?.value)) return unavailable("bot_verification_required", 403);
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
  const rateKey = hashKey("availability", ip, bookingTypeSlug);
  if (rateLimited(rateKey, RATE_LIMIT_TIERS.lenient)) return unavailable("rate_limited", 429);

  try {
    const supabase = getSupabaseAdmin();
    const [{ data: config }, { data: settings }, { data: bookingType }] = await Promise.all([
      supabase.from("system_config").select("master_enabled,native_booking_enabled").eq("id", true).single(),
      supabase.from("booking_settings").select("*").eq("id", true).single(),
      supabase.from("booking_types").select("*").eq("slug", bookingTypeSlug).eq("active", true).maybeSingle(),
    ]);
    if (!config?.master_enabled || !config?.native_booking_enabled || !settings?.enabled) return unavailable("native_booking_disabled");
    if (settings.calendar_connection_status !== "connected") return unavailable("calendar_not_connected");
    if (!bookingType) return unavailable("booking_type_unavailable", 404);
    if ((settings.blocked_dates || []).includes(date)) return NextResponse.json({ available: true, date, slots: [] });

    const windows = settings.working_hours?.[weekdayForDate(date)] || [];
    if (!windows.length) return NextResponse.json({ available: true, date, slots: [] });
    const dayStart = zonedWallTimeToUtc(date, "00:00", settings.owner_timezone);
    const dayEnd = zonedWallTimeToUtc(date, "23:59", settings.owner_timezone);
    const now = new Date();
    if (dayEnd < new Date(now.getTime() + settings.minimum_notice_minutes * 60000)) return NextResponse.json({ available: true, date, slots: [] });
    if (dayStart > new Date(now.getTime() + settings.booking_horizon_days * 86400000)) return NextResponse.json({ available: true, date, slots: [] });

    const { data: existing, error: existingError } = await supabase.from("bookings")
      .select("blocked_starts_at,blocked_ends_at,status,hold_expires_at")
      .lt("blocked_starts_at", dayEnd.toISOString())
      .gt("blocked_ends_at", dayStart.toISOString())
      .in("status", ["held", "confirmed"]);
    if (existingError) throw existingError;
    const activeBookings = (existing || []).filter((booking) => booking.status === "confirmed" || new Date(booking.hold_expires_at) > now);
    if (activeBookings.length >= settings.maximum_bookings_per_day) return NextResponse.json({ available: true, date, slots: [] });

    const calendarId = settings.google_calendar_id || "primary";
    const busy = await getCalendarBusyRanges({
      calendarId,
      timeMin: dayStart.toISOString(),
      timeMax: new Date(dayEnd.getTime() + 60000).toISOString(),
      timeZone: settings.owner_timezone,
    });
    const occupied = [
      ...busy,
      ...activeBookings.map((booking) => ({ start: new Date(booking.blocked_starts_at), end: new Date(booking.blocked_ends_at) })),
    ];
    const slots = [];
    for (const window of windows) {
      for (let cursor = window.start; wallMinutes(cursor) + bookingType.duration_minutes <= wallMinutes(window.end); cursor = addWallMinutes(cursor, settings.slot_interval_minutes)) {
        const startsAt = zonedWallTimeToUtc(date, cursor, settings.owner_timezone);
        const endsAt = new Date(startsAt.getTime() + bookingType.duration_minutes * 60000);
        const blockedStart = new Date(startsAt.getTime() - bookingType.buffer_before_minutes * 60000);
        const blockedEnd = new Date(endsAt.getTime() + bookingType.buffer_after_minutes * 60000);
        if (startsAt < new Date(now.getTime() + settings.minimum_notice_minutes * 60000)) continue;
        if (occupied.some((range) => overlaps(blockedStart, blockedEnd, range.start, range.end))) continue;
        slots.push({ startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() });
      }
    }
    return NextResponse.json({ available: true, date, visitorTimezone, ownerTimezone: settings.owner_timezone, slots }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Booking availability failed", { code: error?.code || error?.message || "unknown" });
    return unavailable("availability_unavailable");
  }
}
