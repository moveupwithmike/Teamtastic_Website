// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createSupabaseAdminMock } from "@/test/supabase-admin-mock";
import { AVAILABILITY_COOKIE, createAvailabilityAccess } from "@/lib/server/availability-access";

const getSupabaseAdmin = vi.fn();
vi.mock("@/lib/server/supabase-admin", () => ({
  getSupabaseAdmin: () => getSupabaseAdmin(),
}));

const getCalendarBusyRanges = vi.fn((..._args) => Promise.resolve([]));
vi.mock("@/lib/server/google-calendar", () => ({
  getCalendarBusyRanges: (...args) => getCalendarBusyRanges(...args),
}));

// 2099-06-01 is a Monday, far enough out that a generous booking_horizon_days
// keeps it in range regardless of when this suite runs.
const DATE = "2099-06-01";
const CONFIG_ROW = { master_enabled: true, native_booking_enabled: true };
const BOOKING_TYPE_ROW = { duration_minutes: 15, buffer_before_minutes: 0, buffer_after_minutes: 0 };

function settingsRow(overrides = {}) {
  return {
    enabled: true,
    calendar_connection_status: "connected",
    blocked_dates: [],
    working_hours: { monday: [{ start: "09:00", end: "10:00" }] },
    owner_timezone: "America/Chicago",
    minimum_notice_minutes: 60,
    booking_horizon_days: 30000,
    maximum_bookings_per_day: 10,
    google_calendar_id: "cal_primary",
    slot_interval_minutes: 30,
    ...overrides,
  };
}

function baseTables({ settings = settingsRow(), bookingType = BOOKING_TYPE_ROW, existingBookings = [] } = {}) {
  return {
    system_config: () => ({ data: CONFIG_ROW, error: null }),
    booking_settings: () => ({ data: settings, error: null }),
    booking_types: () => ({ data: bookingType, error: null }),
    bookings: () => ({ data: existingBookings, error: null }),
  };
}

async function getAvailability({ date = DATE, type = "intro-call-15", timezone = "America/New_York", ip = "203.0.113.40", withAccessCookie = true } = {}) {
  const { GET } = await import("./route.js");
  const url = `https://teamtastic.com/api/bookings/availability?date=${date}&type=${type}&timezone=${timezone}`;
  const headers = new Headers({ "x-forwarded-for": ip });
  if (withAccessCookie) headers.set("cookie", `${AVAILABILITY_COOKIE}=${createAvailabilityAccess()}`);
  const request = new NextRequest(url, { headers });
  return GET(request);
}

describe("booking availability", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.TURNSTILE_SECRET_KEY;
    delete process.env.AVAILABILITY_ACCESS_SECRET;
    getSupabaseAdmin.mockReset();
    getCalendarBusyRanges.mockReset();
    getCalendarBusyRanges.mockResolvedValue([]);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("rejects a malformed date", async () => {
    const response = await getAvailability({ date: "not-a-date", ip: "203.0.113.41" });
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.reason).toBe("invalid_request");
  });

  it("requires a valid signed access cookie", async () => {
    const response = await getAvailability({ withAccessCookie: false, ip: "203.0.113.42" });
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.reason).toBe("bot_verification_required");
  });

  it("rate-limits repeated lookups from the same IP", async () => {
    const ip = "203.0.113.43";
    getSupabaseAdmin.mockReturnValue(createSupabaseAdminMock({ tables: baseTables() }));
    let last;
    for (let i = 0; i < 31; i += 1) {
      last = await getAvailability({ ip });
    }
    expect(last.status).toBe(429);
  });

  it("reports native_booking_disabled when the feature flag is off", async () => {
    getSupabaseAdmin.mockReturnValue(createSupabaseAdminMock({
      tables: { ...baseTables(), system_config: () => ({ data: { master_enabled: true, native_booking_enabled: false }, error: null }) },
    }));
    const response = await getAvailability({ ip: "203.0.113.44" });
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.reason).toBe("native_booking_disabled");
  });

  it("reports calendar_not_connected when Google Calendar isn't linked", async () => {
    getSupabaseAdmin.mockReturnValue(createSupabaseAdminMock({
      tables: baseTables({ settings: settingsRow({ calendar_connection_status: "disconnected" }) }),
    }));
    const response = await getAvailability({ ip: "203.0.113.45" });
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.reason).toBe("calendar_not_connected");
  });

  it("404s for an unknown or inactive booking type", async () => {
    getSupabaseAdmin.mockReturnValue(createSupabaseAdminMock({
      tables: { ...baseTables(), booking_types: () => ({ data: null, error: null }) },
    }));
    const response = await getAvailability({ ip: "203.0.113.46" });
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.reason).toBe("booking_type_unavailable");
  });

  it("returns no slots without hitting the calendar for a date the owner has blocked", async () => {
    getSupabaseAdmin.mockReturnValue(createSupabaseAdminMock({
      tables: baseTables({ settings: settingsRow({ blocked_dates: [DATE] }) }),
    }));
    const response = await getAvailability({ ip: "203.0.113.47" });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.slots).toEqual([]);
    expect(getCalendarBusyRanges).not.toHaveBeenCalled();
  });

  it("computes open slots from working hours, duration, and slot interval", async () => {
    getSupabaseAdmin.mockReturnValue(createSupabaseAdminMock({ tables: baseTables() }));
    const response = await getAvailability({ ip: "203.0.113.48" });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.available).toBe(true);
    // 09:00-10:00 window, 15-minute meetings, 30-minute cadence -> 09:00 and 09:30
    expect(body.slots).toHaveLength(2);
    expect(body.slots[0].startsAt).toBe(new Date("2099-06-01T14:00:00.000Z").toISOString()); // 09:00 America/Chicago (CDT, UTC-5)
    expect(body.slots[1].startsAt).toBe(new Date("2099-06-01T14:30:00.000Z").toISOString());
  });

  it("excludes a slot already covered by an active booking", async () => {
    getSupabaseAdmin.mockReturnValue(createSupabaseAdminMock({
      tables: baseTables({
        existingBookings: [{
          blocked_starts_at: "2099-06-01T14:00:00.000Z",
          blocked_ends_at: "2099-06-01T14:15:00.000Z",
          status: "confirmed",
          hold_expires_at: null,
        }],
      }),
    }));
    const response = await getAvailability({ ip: "203.0.113.49" });
    const body = await response.json();

    expect(body.slots).toHaveLength(1);
    expect(body.slots[0].startsAt).toBe(new Date("2099-06-01T14:30:00.000Z").toISOString());
  });

  it("excludes a slot the calendar itself reports as busy", async () => {
    getCalendarBusyRanges.mockResolvedValue([
      { start: new Date("2099-06-01T14:30:00.000Z"), end: new Date("2099-06-01T14:45:00.000Z") },
    ]);
    getSupabaseAdmin.mockReturnValue(createSupabaseAdminMock({ tables: baseTables() }));
    const response = await getAvailability({ ip: "203.0.113.50" });
    const body = await response.json();

    expect(body.slots).toHaveLength(1);
    expect(body.slots[0].startsAt).toBe(new Date("2099-06-01T14:00:00.000Z").toISOString());
  });

  it("stops honoring the daily booking cap once maximum_bookings_per_day is reached", async () => {
    getSupabaseAdmin.mockReturnValue(createSupabaseAdminMock({
      tables: baseTables({
        settings: settingsRow({ maximum_bookings_per_day: 1 }),
        existingBookings: [{
          blocked_starts_at: "2099-06-01T14:00:00.000Z",
          blocked_ends_at: "2099-06-01T14:15:00.000Z",
          status: "confirmed",
          hold_expires_at: null,
        }],
      }),
    }));
    const response = await getAvailability({ ip: "203.0.113.51" });
    const body = await response.json();
    expect(body.available).toBe(true);
    expect(body.slots).toEqual([]);
  });

  it("returns a 503 instead of leaking a stack trace when the database errors", async () => {
    getSupabaseAdmin.mockReturnValue(createSupabaseAdminMock({
      tables: { ...baseTables(), bookings: () => ({ data: null, error: { code: "db_down" } }) },
    }));
    const response = await getAvailability({ ip: "203.0.113.52" });
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.reason).toBe("availability_unavailable");
  });
});
