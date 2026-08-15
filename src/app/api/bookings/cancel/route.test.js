// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseAdminMock } from "@/test/supabase-admin-mock";

const getSupabaseAdmin = vi.fn();
vi.mock("@/lib/server/supabase-admin", () => ({
  getSupabaseAdmin: () => getSupabaseAdmin(),
}));

const resolveManagedBooking = vi.fn((..._args) => undefined);
vi.mock("@/lib/server/booking-manage", () => ({
  resolveManagedBooking: (...args) => resolveManagedBooking(...args),
}));

const attemptBookingCleanup = vi.fn((db, options, cleanup) => cleanup().then(() => true).catch(() => false));
vi.mock("@/lib/server/booking-cleanup", () => ({
  attemptBookingCleanup: (db, options, cleanup) => attemptBookingCleanup(db, options, cleanup),
}));

const cancelZoomMeeting = vi.fn((..._args) => Promise.resolve());
vi.mock("@/lib/server/zoom", () => ({
  cancelZoomMeeting: (...args) => cancelZoomMeeting(...args),
}));

const deleteCalendarEvent = vi.fn((..._args) => Promise.resolve());
vi.mock("@/lib/server/google-calendar", () => ({
  deleteCalendarEvent: (...args) => deleteCalendarEvent(...args),
}));

const FUTURE_STARTS_AT = "2099-01-01T15:00:00.000Z";

function confirmedLookup(overrides = {}) {
  return {
    booking: { id: "booking_1", status: "confirmed", starts_at: FUTURE_STARTS_AT, ...overrides },
    error: null,
  };
}

const CANCELLED_BOOKING_ROW = {
  id: "booking_1",
  name: "Jordan Rivera",
  email: "jordan@example.com",
  visitor_timezone: "America/New_York",
  starts_at: FUTURE_STARTS_AT,
  prospect_id: "prospect_1",
  booking_type_id: "type_1",
  zoom_meeting_id: null,
  google_event_id: null,
};

async function postCancel(body, headers = {}) {
  const { POST } = await import("./route.js");
  const request = new Request("https://teamtastic.com/api/bookings/cancel", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.11", ...headers },
    body: JSON.stringify(body),
  });
  return POST(request);
}

function baseTables({ cancelledBooking = CANCELLED_BOOKING_ROW } = {}) {
  return {
    bookings: ({ calls }) => {
      if (calls.some((c) => c.method === "update")) return { data: cancelledBooking, error: null };
      return { data: null, error: null };
    },
    booking_settings: () => ({ data: { google_calendar_id: "cal_primary" }, error: null }),
    booking_types: () => ({ data: { name: "Intro Call" }, error: null }),
    messages: () => ({ data: null, error: null }),
  };
}

describe("booking cancel", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    delete process.env.TURNSTILE_SECRET_KEY;
    delete process.env.RESEND_API_KEY;
    getSupabaseAdmin.mockReset();
    resolveManagedBooking.mockReset();
    attemptBookingCleanup.mockClear();
    cancelZoomMeeting.mockClear();
    deleteCalendarEvent.mockClear();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("rejects a request with no token", async () => {
    const response = await postCancel({ turnstileToken: "development-bypass" });
    expect(response.status).toBe(400);
  });

  it("rejects when bot verification fails", async () => {
    const response = await postCancel({ token: "tok_1", turnstileToken: "nope" });
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.reason).toBe("bot_verification_failed");
  });

  it("returns 503 when the managed-booking lookup errors", async () => {
    resolveManagedBooking.mockResolvedValue({ booking: null, error: { code: "lookup_failed" } });
    getSupabaseAdmin.mockReturnValue(createSupabaseAdminMock({ tables: baseTables() }));

    const response = await postCancel({ token: "tok_1", turnstileToken: "development-bypass" });
    expect(response.status).toBe(503);
  });

  it("refuses to cancel a booking that already happened or isn't confirmed", async () => {
    resolveManagedBooking.mockResolvedValue({ booking: { id: "booking_1", status: "cancelled", starts_at: FUTURE_STARTS_AT }, error: null });
    getSupabaseAdmin.mockReturnValue(createSupabaseAdminMock({ tables: baseTables() }));

    const response = await postCancel({ token: "tok_1", turnstileToken: "development-bypass" });
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.reason).toBe("booking_not_found_or_not_cancellable");
  });

  it("cancels a confirmed future booking and tears down its Zoom + Calendar resources", async () => {
    resolveManagedBooking.mockResolvedValue(confirmedLookup());
    getSupabaseAdmin.mockReturnValue(createSupabaseAdminMock({
      tables: baseTables({
        cancelledBooking: { ...CANCELLED_BOOKING_ROW, zoom_meeting_id: "zoom_1", google_event_id: "gcal_1" },
      }),
    }));

    const response = await postCancel({ token: "tok_1", turnstileToken: "development-bypass", reason: "Schedule conflict" });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(cancelZoomMeeting).toHaveBeenCalledWith("zoom_1");
    expect(deleteCalendarEvent).toHaveBeenCalledWith("cal_primary", "gcal_1");
  });

  it("skips Zoom/Calendar teardown when the booking never had those resources", async () => {
    resolveManagedBooking.mockResolvedValue(confirmedLookup());
    getSupabaseAdmin.mockReturnValue(createSupabaseAdminMock({ tables: baseTables() }));

    const response = await postCancel({ token: "tok_1", turnstileToken: "development-bypass" });
    expect(response.status).toBe(200);
    expect(cancelZoomMeeting).not.toHaveBeenCalled();
    expect(deleteCalendarEvent).not.toHaveBeenCalled();
  });

  it("returns 409 when the confirmed-and-future guard races and the update matches nothing", async () => {
    resolveManagedBooking.mockResolvedValue(confirmedLookup());
    getSupabaseAdmin.mockReturnValue(createSupabaseAdminMock({
      tables: { bookings: () => ({ data: null, error: null }) },
    }));

    const response = await postCancel({ token: "tok_1", turnstileToken: "development-bypass" });
    expect(response.status).toBe(409);
  });
});
