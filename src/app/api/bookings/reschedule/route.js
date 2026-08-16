import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import { createCalendarEvent, deleteCalendarEvent } from "@/lib/server/google-calendar";
import { createZoomMeeting, cancelZoomMeeting } from "@/lib/server/zoom";
import { validTimeZone } from "@/lib/server/booking-time";
import { verifyTurnstile } from "@/lib/server/turnstile";
import { hashKey, rateLimited } from "@/lib/server/rate-limit";
import { attemptBookingCleanup } from "@/lib/server/booking-cleanup";
import { resolveManagedBooking } from "@/lib/server/booking-manage";
import { sendViaResend } from "@/lib/server/email";
import { clean } from "@/lib/server/validation";

export const runtime = "nodejs";

function fail(status, reason) {
  return NextResponse.json({ success: false, reason }, { status });
}

function siteOrigin() {
  return process.env.NEXT_PUBLIC_SITE_URL
    || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "https://www.teamtastic.events");
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

async function sendRescheduleEmail(supabase, { booking, bookingTypeName, joinUrl, manageToken }) {
  const whenText = new Intl.DateTimeFormat("en-US", {
    timeZone: booking.visitor_timezone, dateStyle: "full", timeStyle: "short",
  }).format(new Date(booking.starts_at));
  const manageUrl = new URL(`/book/manage/${manageToken}`, siteOrigin()).toString();

  const subject = `Rescheduled: ${bookingTypeName} with Teamtastic`;
  const bodyText = [
    `Hi ${booking.name},`,
    "",
    `You're rescheduled — your ${bookingTypeName} with Teamtastic is now:`,
    "",
    `When: ${whenText} (${booking.visitor_timezone.replaceAll("_", " ")})`,
    joinUrl ? `Join link: ${joinUrl}` : null,
    "",
    "A calendar invite is on its way from Google Calendar with these same details.",
    "",
    `Need to change anything else? ${manageUrl}`,
    "",
    "Michael",
  ].filter((line) => line !== null).join("\n");

  const { reserved, sent, providerMessageId } = await sendViaResend(supabase, {
    messageType: "booking",
    recipient: booking.email,
    subject,
    text: bodyText,
  });
  if (!reserved) return;

  await supabase.from("messages").insert({
    prospect_id: booking.prospect_id,
    direction: "outbound",
    message_type: "booking",
    provider: "resend",
    provider_message_id: providerMessageId,
    from_address: process.env.RESEND_FROM_EMAIL || "",
    to_addresses: [booking.email],
    subject,
    body_text: bodyText,
    status: sent ? "sent" : "failed",
    sent_at: sent ? new Date().toISOString() : null,
  });
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return fail(400, "invalid_json");
  }

  const token = clean(body.token, 200);
  const visitorTimezone = clean(body.visitorTimezone, 100);
  const startsAt = clean(body.startsAt, 40);
  if (!token || !validTimeZone(visitorTimezone) || Number.isNaN(Date.parse(startsAt))) {
    return fail(400, "invalid_request");
  }
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
  if (rateLimited(hashKey("reschedule", ip, token))) return fail(429, "rate_limited");
  try {
    if (!(await verifyTurnstile(clean(body.turnstileToken, 2048), ip))) return fail(400, "bot_verification_failed");
  } catch {
    return fail(503, "verification_unavailable");
  }
  const tokenHash = hashKey(token);

  const supabase = getSupabaseAdmin();
  const { booking: oldBooking, error: lookupError } = await resolveManagedBooking(
    supabase,
    tokenHash,
    "id,name,email,company,visitor_timezone,starts_at,status,prospect_id,zoom_meeting_id,google_event_id,booking_types(id,slug,name,zoom_enabled,duration_minutes)",
  );
  if (lookupError) {
    console.error("Reschedule lookup failed", { code: lookupError.code });
    return fail(503, "booking_service_unavailable");
  }
  if (!oldBooking || oldBooking.status !== "confirmed" || new Date(oldBooking.starts_at) <= new Date()) return fail(409, "booking_not_found_or_not_reschedulable");
  const bookingType = Array.isArray(oldBooking.booking_types) ? oldBooking.booking_types[0] : oldBooking.booking_types;
  if (!bookingType) return fail(503, "booking_service_unavailable");

  // Step 1: hold the new slot. If this fails, the old booking is never touched.
  const manageToken = randomBytes(32).toString("base64url");
  const manageTokenHash = hashKey(manageToken);
  const { data: holdResult, error: holdError } = await supabase.rpc("hold_booking_slot", {
    p_booking_type_slug: bookingType.slug,
    p_name: oldBooking.name,
    p_email: oldBooking.email,
    p_company: oldBooking.company || null,
    p_visitor_timezone: visitorTimezone,
    p_starts_at: new Date(startsAt).toISOString(),
    p_submission_id: null,
    p_source: "reschedule",
    p_context: { rescheduled_from_id: oldBooking.id },
    p_manage_token_hash: manageTokenHash,
  });
  if (holdError) {
    console.error("Reschedule hold failed", { code: holdError.code });
    return fail(503, "booking_service_unavailable");
  }
  if (!holdResult?.held) {
    return fail(REASON_STATUS[holdResult?.reason] || 409, holdResult?.reason || "slot_unavailable");
  }

  const newBookingId = holdResult.booking_id;
  const { data: newBooking, error: newBookingError } = await supabase
    .from("bookings")
    .select("id,starts_at,ends_at")
    .eq("id", newBookingId)
    .single();
  if (newBookingError || !newBooking) {
    await supabase.rpc("fail_booking_hold", {
      p_booking_id: newBookingId,
      p_error: newBookingError?.message || "held_booking_not_found",
    });
    return fail(503, "booking_service_unavailable");
  }

  const { data: settings } = await supabase.from("booking_settings").select("owner_timezone,google_calendar_id").eq("id", true).single();
  const ownerTimezone = settings?.owner_timezone;
  const calendarId = settings?.google_calendar_id || "primary";
  let zoomMeetingId = null;
  let zoomJoinUrl = null;
  let googleEventId = null;

  // Step 2: provision Zoom + Calendar for the new slot. Any failure here releases
  // the new hold and stops — the old booking stays exactly as it was.
  try {
    if (bookingType.zoom_enabled) {
      const zoomHostEmail = process.env.ZOOM_HOST_EMAIL || process.env.INTERNAL_NOTIFICATION_EMAIL;
      const meeting = await createZoomMeeting({
        topic: `${bookingType.name} — ${oldBooking.name}`,
        startsAt: new Date(newBooking.starts_at).toISOString(),
        durationMinutes: bookingType.duration_minutes,
        timezone: ownerTimezone,
        hostEmail: zoomHostEmail,
      });
      zoomMeetingId = meeting.meetingId;
      zoomJoinUrl = meeting.joinUrl;
    }
  } catch (error) {
    await supabase.rpc("fail_booking_hold", { p_booking_id: newBookingId, p_error: String(error?.message || error) });
    return fail(502, "zoom_meeting_failed");
  }

  try {
    const event = await createCalendarEvent({
      calendarId,
      summary: `${bookingType.name}: Teamtastic + ${oldBooking.name}`,
      description: [
        oldBooking.company ? `Company: ${oldBooking.company}` : null,
        zoomJoinUrl ? `Zoom: ${zoomJoinUrl}` : null,
      ].filter(Boolean).join("\n"),
      startsAt: new Date(newBooking.starts_at).toISOString(),
      endsAt: new Date(newBooking.ends_at).toISOString(),
      timeZone: ownerTimezone,
      attendeeEmail: oldBooking.email,
      attendeeName: oldBooking.name,
    });
    googleEventId = event.eventId;
  } catch (error) {
    if (zoomMeetingId) await attemptBookingCleanup(supabase, {
      bookingId: newBookingId, prospectId: oldBooking.prospect_id, operation: "rollback_new_zoom",
      provider: "zoom", resourceId: zoomMeetingId,
    }, () => cancelZoomMeeting(zoomMeetingId));
    await supabase.rpc("fail_booking_hold", { p_booking_id: newBookingId, p_error: String(error?.message || error) });
    return fail(502, "calendar_event_failed");
  }

  // Step 3: the new slot is fully live — now finalize the new row and retire the old one.
  const { error: confirmError } = await supabase
    .from("bookings")
    .update({
      status: "confirmed",
      confirmed_at: new Date().toISOString(),
      google_event_id: googleEventId,
      zoom_meeting_id: zoomMeetingId,
      zoom_join_url: zoomJoinUrl,
      rescheduled_from_id: oldBooking.id,
    })
    .eq("id", newBookingId)
    .eq("status", "held");
  if (confirmError) {
    if (zoomMeetingId) await attemptBookingCleanup(supabase, {
      bookingId: newBookingId, prospectId: oldBooking.prospect_id, operation: "rollback_new_zoom",
      provider: "zoom", resourceId: zoomMeetingId,
    }, () => cancelZoomMeeting(zoomMeetingId));
    if (googleEventId) await attemptBookingCleanup(supabase, {
      bookingId: newBookingId, prospectId: oldBooking.prospect_id, operation: "rollback_new_calendar",
      provider: "google_calendar", resourceId: googleEventId,
    }, () => deleteCalendarEvent(calendarId, googleEventId));
    await supabase.rpc("fail_booking_hold", { p_booking_id: newBookingId, p_error: "confirm_write_failed" });
    return fail(503, "booking_service_unavailable");
  }

  const { data: retiredOld } = await supabase
    .from("bookings")
    .update({ status: "rescheduled", rescheduled_at: new Date().toISOString(), rescheduled_to_id: newBookingId })
    .eq("id", oldBooking.id)
    .eq("status", "confirmed")
    .select("id")
    .maybeSingle();
  if (!retiredOld) {
    // Old booking was no longer 'confirmed' by the time we got here — most likely a
    // duplicate/double-submitted reschedule request beat this one to it. The new
    // booking we just created is still real and confirmed, so don't discard it, but
    // flag the anomaly instead of silently proceeding as if nothing unusual happened.
    await supabase.from("agent_log").insert({
      agent_name: "booking-reschedule", action: "retire_old_booking", outcome: "escalated",
      prospect_id: oldBooking.prospect_id,
      decision: { old_booking_id: oldBooking.id, new_booking_id: newBookingId, reason: "old_booking_not_confirmed_at_retire" },
    });
  }

  if (oldBooking.zoom_meeting_id) await attemptBookingCleanup(supabase, {
    bookingId: oldBooking.id, prospectId: oldBooking.prospect_id, operation: "retire_old_zoom",
    provider: "zoom", resourceId: oldBooking.zoom_meeting_id,
  }, () => cancelZoomMeeting(oldBooking.zoom_meeting_id));
  if (oldBooking.google_event_id) await attemptBookingCleanup(supabase, {
    bookingId: oldBooking.id, prospectId: oldBooking.prospect_id, operation: "retire_old_calendar",
    provider: "google_calendar", resourceId: oldBooking.google_event_id,
  }, () => deleteCalendarEvent(calendarId, oldBooking.google_event_id));

  await sendRescheduleEmail(supabase, {
    booking: { ...oldBooking, starts_at: newBooking.starts_at, visitor_timezone: visitorTimezone },
    bookingTypeName: bookingType.name,
    joinUrl: zoomJoinUrl,
    manageToken,
  }).catch((error) => console.error("Reschedule email failed", { message: error?.message }));

  return NextResponse.json({
    success: true,
    bookingId: newBookingId,
    startsAt: newBooking.starts_at,
    endsAt: newBooking.ends_at,
    visitorTimezone,
    joinUrl: zoomJoinUrl,
    manageToken,
  });
}
