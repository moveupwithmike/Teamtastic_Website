import { randomBytes, createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import { createCalendarEvent, deleteCalendarEvent } from "@/lib/server/google-calendar";
import { createZoomMeeting, cancelZoomMeeting } from "@/lib/server/zoom";
import { validTimeZone } from "@/lib/server/booking-time";

export const runtime = "nodejs";

const buckets = new Map();

function clean(value, max = 300) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

function rateLimited(key) {
  const now = Date.now();
  const entries = (buckets.get(key) || []).filter((time) => now - time < 10 * 60 * 1000);
  entries.push(now);
  buckets.set(key, entries);
  return entries.length > 5;
}

function fail(status, reason) {
  return NextResponse.json({ success: false, reason }, { status });
}

const REASON_STATUS = {
  master_kill_switch: 503,
  native_booking_disabled: 503,
  calendar_not_connected: 503,
  zoom_not_connected: 503,
  invalid_email: 400,
  invalid_name: 400,
  booking_type_unavailable: 404,
  minimum_notice: 409,
  outside_booking_horizon: 409,
  daily_limit: 409,
  slot_unavailable: 409,
  request_already_used: 409,
};

async function sendConfirmationEmail(supabase, { booking, bookingType, ownerTimezone, joinUrl }) {
  const { data: reservation } = await supabase.rpc("reserve_email_send", {
    p_message_type: "booking",
    p_recipient: booking.email,
  });
  if (!reservation?.allowed) return;

  const whenText = new Intl.DateTimeFormat("en-US", {
    timeZone: booking.visitor_timezone, dateStyle: "full", timeStyle: "short",
  }).format(new Date(booking.starts_at));

  const bodyLines = [
    `Hi ${booking.name},`,
    "",
    `You're booked for a ${bookingType.name} with Teamtastic.`,
    "",
    `When: ${whenText} (${booking.visitor_timezone.replaceAll("_", " ")})`,
    joinUrl ? `Join link: ${joinUrl}` : null,
    "",
    "A calendar invite is on its way from Google Calendar with these same details.",
    "",
    "Need to change anything? Just reply to this email.",
    "",
    "Michael",
  ].filter((line) => line !== null).join("\n");

  let sendResult = "failed";
  let providerMessageId = null;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL,
        to: booking.email,
        subject: `Confirmed: ${bookingType.name} with Teamtastic`,
        text: bodyLines,
      }),
      signal: AbortSignal.timeout(8000),
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok && data.id) {
      sendResult = "sent";
      providerMessageId = data.id;
    }
  } catch {
    sendResult = "failed";
  }

  await supabase.rpc("record_email_send_result", { p_message_type: "booking", p_sent: sendResult === "sent" });
  await supabase.from("messages").insert({
    prospect_id: booking.prospect_id,
    direction: "outbound",
    message_type: "booking",
    provider: "resend",
    provider_message_id: providerMessageId,
    from_address: process.env.RESEND_FROM_EMAIL || "",
    to_addresses: [booking.email],
    subject: `Confirmed: ${bookingType.name} with Teamtastic`,
    body_text: bodyLines,
    status: sendResult,
    sent_at: sendResult === "sent" ? new Date().toISOString() : null,
  });
}

export async function POST(request) {
  let body;
  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 10_000) return fail(413, "payload_too_large");
    body = await request.json();
  } catch {
    return fail(400, "invalid_json");
  }

  const bookingTypeSlug = clean(body.bookingTypeSlug, 80) || "intro-call-15";
  const name = clean(body.name, 120);
  const email = clean(body.email, 254).toLowerCase();
  const company = clean(body.company, 160);
  const visitorTimezone = clean(body.visitorTimezone, 100);
  const startsAt = clean(body.startsAt, 40);
  const submissionId = /^[0-9a-f-]{36}$/i.test(clean(body.submissionId, 36)) ? clean(body.submissionId, 36) : null;
  const source = clean(body.source, 80) || "book_page";
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";

  if (!name || !validEmail(email) || !validTimeZone(visitorTimezone) || Number.isNaN(Date.parse(startsAt))) {
    return fail(400, "invalid_request");
  }

  const rateKey = createHash("sha256").update(`${ip}:${email}`).digest("hex");
  if (rateLimited(rateKey)) return fail(429, "rate_limited");

  const supabase = getSupabaseAdmin();
  const manageToken = randomBytes(32).toString("base64url");
  const manageTokenHash = createHash("sha256").update(manageToken).digest("hex");

  const { data: holdResult, error: holdError } = await supabase.rpc("hold_booking_slot", {
    p_booking_type_slug: bookingTypeSlug,
    p_name: name,
    p_email: email,
    p_company: company || null,
    p_visitor_timezone: visitorTimezone,
    p_starts_at: new Date(startsAt).toISOString(),
    p_submission_id: submissionId,
    p_source: source,
    p_context: {},
    p_manage_token_hash: manageTokenHash,
  });
  if (holdError) {
    console.error("hold_booking_slot failed", { code: holdError.code });
    return fail(503, "booking_service_unavailable");
  }
  if (!holdResult?.held) {
    return fail(REASON_STATUS[holdResult?.reason] || 409, holdResult?.reason || "slot_unavailable");
  }

  const bookingId = holdResult.booking_id;
  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select("id,name,email,visitor_timezone,starts_at,ends_at,prospect_id")
    .eq("id", bookingId)
    .single();
  const { data: bookingType, error: typeError } = await supabase
    .from("booking_types")
    .select("name,zoom_enabled,duration_minutes")
    .eq("slug", bookingTypeSlug)
    .single();
  const { data: settings } = await supabase
    .from("booking_settings")
    .select("owner_timezone,google_calendar_id")
    .eq("id", true)
    .single();
  if (bookingError || typeError || !booking || !bookingType || !settings) {
    await supabase.rpc("fail_booking_hold", { p_booking_id: bookingId, p_error: "booking_lookup_failed" });
    return fail(503, "booking_service_unavailable");
  }

  const ownerTimezone = settings.owner_timezone;
  const calendarId = settings.google_calendar_id || "primary";
  let zoomMeetingId = null;
  let zoomJoinUrl = null;
  let googleEventId = null;

  try {
    if (bookingType.zoom_enabled) {
      const zoomHostEmail = process.env.ZOOM_HOST_EMAIL || process.env.INTERNAL_NOTIFICATION_EMAIL;
      const meeting = await createZoomMeeting({
        topic: `${bookingType.name} — ${name}`,
        startsAt: new Date(booking.starts_at).toISOString(),
        durationMinutes: bookingType.duration_minutes,
        timezone: ownerTimezone,
        hostEmail: zoomHostEmail,
      });
      zoomMeetingId = meeting.meetingId;
      zoomJoinUrl = meeting.joinUrl;
    }
  } catch (error) {
    await supabase.rpc("fail_booking_hold", { p_booking_id: bookingId, p_error: String(error?.message || error) });
    await supabase.from("tasks").insert({
      prospect_id: booking.prospect_id, title: `Booking failed to confirm: ${name}`,
      description: `Zoom meeting creation failed for a held booking slot. Reach out to ${email} directly to confirm the call.`,
      priority: "urgent", due_at: new Date().toISOString(), source: "native_booking_failure",
    });
    return fail(502, "zoom_meeting_failed");
  }

  try {
    const event = await createCalendarEvent({
      calendarId,
      summary: `${bookingType.name}: Teamtastic + ${name}`,
      description: [
        company ? `Company: ${company}` : null,
        zoomJoinUrl ? `Zoom: ${zoomJoinUrl}` : null,
      ].filter(Boolean).join("\n"),
      startsAt: new Date(booking.starts_at).toISOString(),
      endsAt: new Date(booking.ends_at).toISOString(),
      timeZone: ownerTimezone,
      attendeeEmail: email,
      attendeeName: name,
    });
    googleEventId = event.eventId;
  } catch (error) {
    if (zoomMeetingId) await cancelZoomMeeting(zoomMeetingId).catch(() => {});
    await supabase.rpc("fail_booking_hold", { p_booking_id: bookingId, p_error: String(error?.message || error) });
    await supabase.from("tasks").insert({
      prospect_id: booking.prospect_id, title: `Booking failed to confirm: ${name}`,
      description: `Calendar event creation failed for a held booking slot. Reach out to ${email} directly to confirm the call.`,
      priority: "urgent", due_at: new Date().toISOString(), source: "native_booking_failure",
    });
    return fail(502, "calendar_event_failed");
  }

  const { error: confirmError } = await supabase
    .from("bookings")
    .update({
      status: "confirmed",
      confirmed_at: new Date().toISOString(),
      google_event_id: googleEventId,
      zoom_meeting_id: zoomMeetingId,
      zoom_join_url: zoomJoinUrl,
    })
    .eq("id", bookingId)
    .eq("status", "held");
  if (confirmError) {
    if (zoomMeetingId) await cancelZoomMeeting(zoomMeetingId).catch(() => {});
    await deleteCalendarEvent(calendarId, googleEventId).catch(() => {});
    await supabase.rpc("fail_booking_hold", { p_booking_id: bookingId, p_error: "confirm_write_failed" });
    return fail(503, "booking_service_unavailable");
  }

  await sendConfirmationEmail(supabase, {
    booking: { ...booking, name, email }, bookingType, ownerTimezone, joinUrl: zoomJoinUrl,
  }).catch((error) => console.error("Booking confirmation email failed", { message: error?.message }));

  return NextResponse.json({
    success: true,
    bookingId,
    startsAt: booking.starts_at,
    endsAt: booking.ends_at,
    visitorTimezone: booking.visitor_timezone,
    joinUrl: zoomJoinUrl,
  });
}
