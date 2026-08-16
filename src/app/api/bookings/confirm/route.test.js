// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseAdminMock } from "@/test/supabase-admin-mock";

const getSupabaseAdmin = vi.fn();
vi.mock("@/lib/server/supabase-admin", () => ({
  getSupabaseAdmin: () => getSupabaseAdmin(),
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

const BOOKING_ROW = {
  id: "booking_1",
  name: "Jordan Rivera",
  email: "jordan@example.com",
  visitor_timezone: "America/New_York",
  starts_at: "2026-09-01T15:00:00.000Z",
  ends_at: "2026-09-01T15:15:00.000Z",
  prospect_id: "prospect_1",
};
const BOOKING_TYPE_ROW = { name: "Intro Call", zoom_enabled: true, duration_minutes: 15 };
const SETTINGS_ROW = { owner_timezone: "America/Chicago", google_calendar_id: "cal_primary" };

function validBody(overrides = {}) {
  return {
    bookingTypeSlug: "intro-call-15",
    name: "Jordan Rivera",
    email: "jordan@example.com",
    company: "Acme",
    visitorTimezone: "America/New_York",
    startsAt: "2026-09-01T15:00:00.000Z",
    turnstileToken: "development-bypass",
    ...overrides,
  };
}

async function postConfirm(body, headers = {}) {
  const { POST } = await import("./route.js");
  const request = new Request("https://teamtastic.com/api/bookings/confirm", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.9", ...headers },
    body: JSON.stringify(body),
  });
  return POST(request);
}

function baseSupabaseTables({
  bookingType = BOOKING_TYPE_ROW,
  confirmUpdateError = null,
} = {}) {
  return {
    bookings: ({ calls }) => {
      if (calls.some((c) => c.method === "update")) return { data: null, error: confirmUpdateError };
      return { data: BOOKING_ROW, error: null };
    },
    booking_types: () => ({ data: bookingType, error: null }),
    booking_settings: () => ({ data: SETTINGS_ROW, error: null }),
    tasks: () => ({ data: null, error: null }),
    messages: () => ({ data: null, error: null }),
  };
}

describe("booking confirm", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    delete process.env.TURNSTILE_SECRET_KEY; // enables the development-bypass path
    delete process.env.RESEND_API_KEY; // sendConfirmationEmail is fire-and-forget; keep it inert by default
    getSupabaseAdmin.mockReset();
    createZoomMeeting.mockReset();
    cancelZoomMeeting.mockClear();
    createCalendarEvent.mockReset();
    deleteCalendarEvent.mockClear();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("rejects an invalid request (missing name)", async () => {
    const response = await postConfirm(validBody({ name: "" }));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.reason).toBe("invalid_request");
  });

  it("rejects when bot verification fails", async () => {
    const response = await postConfirm(validBody({ turnstileToken: "not-the-bypass-token" }));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.reason).toBe("bot_verification_failed");
  });

  it("returns 503 when hold_booking_slot itself errors", async () => {
    const supabase = createSupabaseAdminMock({
      tables: baseSupabaseTables(),
      rpc: { hold_booking_slot: () => ({ data: null, error: { code: "hold_failed" } }) },
    });
    getSupabaseAdmin.mockReturnValue(supabase);

    const response = await postConfirm(validBody({ email: "hold-error@example.com" }));
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.reason).toBe("booking_service_unavailable");
  });

  it("maps a rejected hold (slot already taken) to 409 without touching Zoom or Calendar", async () => {
    const supabase = createSupabaseAdminMock({
      tables: baseSupabaseTables(),
      rpc: { hold_booking_slot: () => ({ data: { held: false, reason: "slot_unavailable" }, error: null }) },
    });
    getSupabaseAdmin.mockReturnValue(supabase);

    const response = await postConfirm(validBody({ email: "taken-slot@example.com" }));
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.reason).toBe("slot_unavailable");
    expect(createZoomMeeting).not.toHaveBeenCalled();
    expect(createCalendarEvent).not.toHaveBeenCalled();
  });

  it("holds the slot, provisions Zoom + Calendar, and confirms the booking end to end", async () => {
    createZoomMeeting.mockResolvedValue({ meetingId: "zoom_1", joinUrl: "https://zoom.us/j/123" });
    createCalendarEvent.mockResolvedValue({ eventId: "gcal_1" });

    const supabase = createSupabaseAdminMock({
      tables: baseSupabaseTables(),
      rpc: { hold_booking_slot: () => ({ data: { held: true, booking_id: "booking_1" }, error: null }) },
    });
    getSupabaseAdmin.mockReturnValue(supabase);

    const response = await postConfirm(validBody({ email: "happy-path@example.com" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.bookingId).toBe("booking_1");
    expect(body.joinUrl).toBe("https://zoom.us/j/123");
    expect(createZoomMeeting).toHaveBeenCalledWith(
      expect.objectContaining({ topic: expect.stringContaining("Jordan Rivera") }),
    );
    expect(createCalendarEvent).toHaveBeenCalledWith(
      expect.objectContaining({ calendarId: "cal_primary", attendeeEmail: "happy-path@example.com" }),
    );
  });

  it("rolls back with an urgent task and 502 when Zoom provisioning fails", async () => {
    createZoomMeeting.mockRejectedValue(new Error("zoom outage"));

    const supabase = createSupabaseAdminMock({
      tables: baseSupabaseTables(),
      rpc: {
        hold_booking_slot: () => ({ data: { held: true, booking_id: "booking_1" }, error: null }),
        fail_booking_hold: () => ({ data: null, error: null }),
      },
    });
    getSupabaseAdmin.mockReturnValue(supabase);

    const response = await postConfirm(validBody({ email: "zoom-fail@example.com" }));
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.reason).toBe("zoom_meeting_failed");
    expect(createCalendarEvent).not.toHaveBeenCalled();
    expect(supabase.rpc).toHaveBeenCalledWith(
      "fail_booking_hold",
      expect.objectContaining({ p_booking_id: "booking_1" }),
    );
  });

  it("cancels the just-created Zoom meeting and rolls back when Calendar provisioning fails", async () => {
    createZoomMeeting.mockResolvedValue({ meetingId: "zoom_1", joinUrl: "https://zoom.us/j/123" });
    createCalendarEvent.mockRejectedValue(new Error("calendar outage"));

    const supabase = createSupabaseAdminMock({
      tables: baseSupabaseTables(),
      rpc: {
        hold_booking_slot: () => ({ data: { held: true, booking_id: "booking_1" }, error: null }),
        fail_booking_hold: () => ({ data: null, error: null }),
      },
    });
    getSupabaseAdmin.mockReturnValue(supabase);

    const response = await postConfirm(validBody({ email: "calendar-fail@example.com" }));
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.reason).toBe("calendar_event_failed");
    expect(cancelZoomMeeting).toHaveBeenCalledWith("zoom_1");
  });

  it("still records an urgent task when the Zoom rollback itself fails after a Calendar failure", async () => {
    createZoomMeeting.mockResolvedValue({ meetingId: "zoom_1", joinUrl: "https://zoom.us/j/123" });
    createCalendarEvent.mockRejectedValue(new Error("calendar outage"));
    cancelZoomMeeting.mockRejectedValue(new Error("zoom cancel also failed"));

    const taskInserts = [];
    const supabase = createSupabaseAdminMock({
      tables: {
        ...baseSupabaseTables(),
        tasks: ({ calls }) => {
          const insertCall = calls.find((c) => c.method === "insert");
          if (insertCall) taskInserts.push(insertCall.args[0]);
          return { data: null, error: null };
        },
      },
      rpc: {
        hold_booking_slot: () => ({ data: { held: true, booking_id: "booking_1" }, error: null }),
        fail_booking_hold: () => ({ data: null, error: null }),
      },
    });
    getSupabaseAdmin.mockReturnValue(supabase);

    const response = await postConfirm(validBody({ email: "calendar-and-cleanup-fail@example.com" }));
    const body = await response.json();

    // The primary-failure response is unaffected by the rollback also failing.
    expect(response.status).toBe(502);
    expect(body.reason).toBe("calendar_event_failed");
    expect(cancelZoomMeeting).toHaveBeenCalledWith("zoom_1");

    // But the failed rollback is no longer silently swallowed: it produces its
    // own urgent task in addition to the primary-failure task.
    expect(taskInserts).toHaveLength(2);
    expect(taskInserts.some((task) => task.source === "native_booking_cleanup_failure")).toBe(true);
  });

  it("rolls back Zoom and Calendar when the final confirm write fails", async () => {
    createZoomMeeting.mockResolvedValue({ meetingId: "zoom_1", joinUrl: "https://zoom.us/j/123" });
    createCalendarEvent.mockResolvedValue({ eventId: "gcal_1" });

    const supabase = createSupabaseAdminMock({
      tables: baseSupabaseTables({ confirmUpdateError: { code: "write_conflict" } }),
      rpc: {
        hold_booking_slot: () => ({ data: { held: true, booking_id: "booking_1" }, error: null }),
        fail_booking_hold: () => ({ data: null, error: null }),
      },
    });
    getSupabaseAdmin.mockReturnValue(supabase);

    const response = await postConfirm(validBody({ email: "confirm-write-fail@example.com" }));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.reason).toBe("booking_service_unavailable");
    expect(cancelZoomMeeting).toHaveBeenCalledWith("zoom_1");
    expect(deleteCalendarEvent).toHaveBeenCalledWith("cal_primary", "gcal_1");
  });
});
