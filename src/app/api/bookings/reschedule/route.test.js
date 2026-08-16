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

const createZoomMeeting = vi.fn((..._args) => undefined);
const cancelZoomMeeting = vi.fn((..._args) => Promise.resolve());
vi.mock("@/lib/server/zoom", () => ({
  createZoomMeeting: (...args) => createZoomMeeting(...args),
  cancelZoomMeeting: (...args) => cancelZoomMeeting(...args),
}));

const createCalendarEvent = vi.fn((..._args) => undefined);
const deleteCalendarEvent = vi.fn((..._args) => Promise.resolve());
vi.mock("@/lib/server/google-calendar", () => ({
  createCalendarEvent: (...args) => createCalendarEvent(...args),
  deleteCalendarEvent: (...args) => deleteCalendarEvent(...args),
}));

const FUTURE_STARTS_AT = "2099-01-01T15:00:00.000Z";
const NEW_STARTS_AT = "2099-01-02T15:00:00.000Z";

const OLD_BOOKING_ROW = {
  id: "old_booking_1",
  name: "Jordan Rivera",
  email: "jordan@example.com",
  company: "Acme",
  visitor_timezone: "America/New_York",
  starts_at: FUTURE_STARTS_AT,
  status: "confirmed",
  prospect_id: "prospect_1",
  zoom_meeting_id: "old_zoom_1",
  google_event_id: "old_gcal_1",
  booking_types: [{ id: "type_1", slug: "intro-call-15", name: "Intro Call", zoom_enabled: true, duration_minutes: 15 }],
};

function validBody(overrides = {}) {
  return {
    token: "tok_1",
    visitorTimezone: "America/New_York",
    startsAt: NEW_STARTS_AT,
    turnstileToken: "development-bypass",
    ...overrides,
  };
}

async function postReschedule(body, headers = {}) {
  const { POST } = await import("./route.js");
  const request = new Request("https://teamtastic.com/api/bookings/reschedule", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.13", ...headers },
    body: JSON.stringify(body),
  });
  return POST(request);
}

function baseTables({ retiredOld = { id: "old_booking_1" }, confirmUpdateError = null } = {}) {
  return {
    bookings: ({ calls }) => {
      const hasUpdate = calls.some((c) => c.method === "update");
      const hasSelect = calls.some((c) => c.method === "select");
      if (hasUpdate && hasSelect) {
        // retire-old update: .update().eq().eq().select("id").maybeSingle()
        return { data: retiredOld, error: null };
      }
      if (hasUpdate) {
        return { data: null, error: confirmUpdateError }; // confirm-new update: no .select()
      }
      // new booking lookup: .select("id,starts_at,ends_at").eq("id", newBookingId).single()
      return { data: { id: "new_booking_1", starts_at: NEW_STARTS_AT, ends_at: "2099-01-02T15:15:00.000Z" }, error: null };
    },
    booking_settings: () => ({ data: { owner_timezone: "America/Chicago", google_calendar_id: "cal_primary" }, error: null }),
    agent_log: () => ({ data: null, error: null }),
    messages: () => ({ data: null, error: null }),
  };
}

describe("booking reschedule", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    delete process.env.TURNSTILE_SECRET_KEY;
    delete process.env.RESEND_API_KEY;
    getSupabaseAdmin.mockReset();
    resolveManagedBooking.mockReset();
    attemptBookingCleanup.mockClear();
    createZoomMeeting.mockReset();
    cancelZoomMeeting.mockClear();
    createCalendarEvent.mockReset();
    deleteCalendarEvent.mockClear();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("rejects an invalid request (bad timezone)", async () => {
    const response = await postReschedule(validBody({ visitorTimezone: "Not/A/Zone" }));
    expect(response.status).toBe(400);
  });

  it("returns 503 when the managed-booking lookup errors", async () => {
    resolveManagedBooking.mockResolvedValue({ booking: null, error: { code: "lookup_failed" } });
    getSupabaseAdmin.mockReturnValue(createSupabaseAdminMock({ tables: baseTables() }));

    const response = await postReschedule(validBody());
    expect(response.status).toBe(503);
  });

  it("refuses to reschedule a booking that isn't confirmed and in the future", async () => {
    resolveManagedBooking.mockResolvedValue({ booking: { ...OLD_BOOKING_ROW, status: "cancelled" }, error: null });
    getSupabaseAdmin.mockReturnValue(createSupabaseAdminMock({ tables: baseTables() }));

    const response = await postReschedule(validBody());
    expect(response.status).toBe(409);
  });

  it("maps a rejected hold on the new slot to 409 and never touches the old booking", async () => {
    resolveManagedBooking.mockResolvedValue({ booking: OLD_BOOKING_ROW, error: null });
    const supabase = createSupabaseAdminMock({
      tables: baseTables(),
      rpc: { hold_booking_slot: () => ({ data: { held: false, reason: "slot_unavailable" }, error: null }) },
    });
    getSupabaseAdmin.mockReturnValue(supabase);

    const response = await postReschedule(validBody());
    expect(response.status).toBe(409);
    expect(createZoomMeeting).not.toHaveBeenCalled();
    expect(attemptBookingCleanup).not.toHaveBeenCalled();
  });

  it("returns 503 when the new-slot hold query fails", async () => {
    resolveManagedBooking.mockResolvedValue({ booking: OLD_BOOKING_ROW, error: null });
    const supabase = createSupabaseAdminMock({
      tables: baseTables(),
      rpc: { hold_booking_slot: { data: null, error: { code: "database_unavailable" } } },
    });
    getSupabaseAdmin.mockReturnValue(supabase);
    const response = await postReschedule(validBody({ token: "tok_hold_error" }), { "x-forwarded-for": "203.0.113.75" });
    expect(response.status).toBe(503);
    expect(createZoomMeeting).not.toHaveBeenCalled();
  });

  it("moves the booking to the new slot: holds it, provisions Zoom + Calendar, confirms new, retires old", async () => {
    resolveManagedBooking.mockResolvedValue({ booking: OLD_BOOKING_ROW, error: null });
    createZoomMeeting.mockResolvedValue({ meetingId: "new_zoom_1", joinUrl: "https://zoom.us/j/new" });
    createCalendarEvent.mockResolvedValue({ eventId: "new_gcal_1" });

    const supabase = createSupabaseAdminMock({
      tables: baseTables(),
      rpc: { hold_booking_slot: () => ({ data: { held: true, booking_id: "new_booking_1" }, error: null }) },
    });
    getSupabaseAdmin.mockReturnValue(supabase);

    const response = await postReschedule(validBody());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.bookingId).toBe("new_booking_1");
    expect(createZoomMeeting).toHaveBeenCalled();
    expect(createCalendarEvent).toHaveBeenCalledWith(
      expect.objectContaining({ attendeeEmail: "jordan@example.com" }),
    );
    // old resources torn down via the shared cleanup helper
    expect(attemptBookingCleanup).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ operation: "retire_old_zoom", resourceId: "old_zoom_1" }),
      expect.any(Function),
    );
    expect(attemptBookingCleanup).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ operation: "retire_old_calendar", resourceId: "old_gcal_1" }),
      expect.any(Function),
    );
  });

  it("releases the new hold and leaves the old booking untouched when Zoom provisioning fails", async () => {
    resolveManagedBooking.mockResolvedValue({ booking: OLD_BOOKING_ROW, error: null });
    createZoomMeeting.mockRejectedValue(new Error("zoom outage"));

    const supabase = createSupabaseAdminMock({
      tables: baseTables(),
      rpc: {
        hold_booking_slot: () => ({ data: { held: true, booking_id: "new_booking_1" }, error: null }),
        fail_booking_hold: () => ({ data: null, error: null }),
      },
    });
    getSupabaseAdmin.mockReturnValue(supabase);

    const response = await postReschedule(validBody());
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.reason).toBe("zoom_meeting_failed");
    expect(createCalendarEvent).not.toHaveBeenCalled();
    expect(attemptBookingCleanup).not.toHaveBeenCalled(); // old booking is never touched on this failure path
    expect(supabase.rpc).toHaveBeenCalledWith(
      "fail_booking_hold",
      expect.objectContaining({ p_booking_id: "new_booking_1" }),
    );
  });

  it("rolls back the new Zoom + Calendar resources when the confirm write on the new slot fails", async () => {
    resolveManagedBooking.mockResolvedValue({ booking: OLD_BOOKING_ROW, error: null });
    createZoomMeeting.mockResolvedValue({ meetingId: "new_zoom_1", joinUrl: "https://zoom.us/j/new" });
    createCalendarEvent.mockResolvedValue({ eventId: "new_gcal_1" });

    const supabase = createSupabaseAdminMock({
      tables: baseTables({ confirmUpdateError: { code: "write_conflict" } }),
      rpc: {
        hold_booking_slot: () => ({ data: { held: true, booking_id: "new_booking_1" }, error: null }),
        fail_booking_hold: () => ({ data: null, error: null }),
      },
    });
    getSupabaseAdmin.mockReturnValue(supabase);

    const response = await postReschedule(validBody());
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.reason).toBe("booking_service_unavailable");
    expect(attemptBookingCleanup).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ operation: "rollback_new_zoom", resourceId: "new_zoom_1" }),
      expect.any(Function),
    );
    expect(attemptBookingCleanup).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ operation: "rollback_new_calendar", resourceId: "new_gcal_1" }),
      expect.any(Function),
    );
  });

  it("fails the held slot when the new booking row cannot be loaded", async () => {
    resolveManagedBooking.mockResolvedValue({ booking: OLD_BOOKING_ROW, error: null });
    const tables = baseTables();
    tables.bookings = ({ calls }) => calls.some(c => c.method === "update")
      ? { data: null, error: null }
      : { data: null, error: { message: "missing" } };
    const supabase = createSupabaseAdminMock({ tables, rpc: {
      hold_booking_slot: { data: { held: true, booking_id: "new_booking_1" }, error: null },
      fail_booking_hold: { data: null, error: null },
    } });
    getSupabaseAdmin.mockReturnValue(supabase);
    expect((await postReschedule(validBody({ token: "tok_missing" }), { "x-forwarded-for": "203.0.113.77" })).status).toBe(503);
    expect(supabase.rpc).toHaveBeenCalledWith("fail_booking_hold", expect.objectContaining({ p_error: "missing" }));
  });

  it("rolls back new Zoom when Calendar provisioning fails", async () => {
    resolveManagedBooking.mockResolvedValue({ booking: OLD_BOOKING_ROW, error: null });
    createZoomMeeting.mockResolvedValue({ meetingId: "new_zoom_2", joinUrl: "https://zoom.test/new" });
    createCalendarEvent.mockRejectedValue(new Error("calendar outage"));
    const supabase = createSupabaseAdminMock({ tables: baseTables(), rpc: {
      hold_booking_slot: { data: { held: true, booking_id: "new_booking_1" }, error: null },
      fail_booking_hold: { data: null, error: null },
    } });
    getSupabaseAdmin.mockReturnValue(supabase);
    const response = await postReschedule(validBody({ token: "tok_calendar" }), { "x-forwarded-for": "203.0.113.76" });
    expect(response.status).toBe(502);
    expect(attemptBookingCleanup).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ operation: "rollback_new_zoom" }), expect.any(Function));
  });
});
