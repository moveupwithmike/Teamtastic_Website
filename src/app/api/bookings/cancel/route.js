import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import { deleteCalendarEvent } from "@/lib/server/google-calendar";
import { cancelZoomMeeting } from "@/lib/server/zoom";
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

async function sendCancelEmail(supabase, booking, bookingTypeName) {
  const whenText = new Intl.DateTimeFormat("en-US", {
    timeZone: booking.visitor_timezone, dateStyle: "full", timeStyle: "short",
  }).format(new Date(booking.starts_at));
  const subject = `Canceled: ${bookingTypeName} with Teamtastic`;
  const bodyText = [
    `Hi ${booking.name},`,
    "",
    `Your ${bookingTypeName} on ${whenText} (${booking.visitor_timezone.replaceAll("_", " ")}) has been canceled.`,
    "",
    "Whenever you're ready to find a new time, we're here: https://www.teamtastic.events/book",
    "",
    "Michael",
  ].join("\n");

  const { reserved, sent, providerMessageId } = await sendViaResend(supabase, {
    messageType: "booking",
    recipient: booking.email,
    subject,
    text: bodyText,
    idempotencyKey: `booking-cancel/${booking.id}`,
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
  const reason = clean(body.reason, 500) || null;
  if (!token) return fail(400, "invalid_request");
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
  if (rateLimited(hashKey("cancel", ip, token))) return fail(429, "rate_limited");
  try {
    if (!(await verifyTurnstile(clean(body.turnstileToken, 2048), ip))) return fail(400, "bot_verification_failed");
  } catch {
    return fail(503, "verification_unavailable");
  }
  const tokenHash = hashKey(token);

  const supabase = getSupabaseAdmin();
  const { booking: currentBooking, error: lookupError } = await resolveManagedBooking(
    supabase,
    tokenHash,
    "id,status,starts_at",
  );
  if (lookupError) return fail(503, "booking_service_unavailable");
  if (!currentBooking || currentBooking.status !== "confirmed" || new Date(currentBooking.starts_at) <= new Date()) {
    return fail(409, "booking_not_found_or_not_cancellable");
  }
  const { data: booking, error: updateError } = await supabase
    .from("bookings")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString(), cancellation_reason: reason })
    .eq("id", currentBooking.id)
    .eq("status", "confirmed")
    .gt("starts_at", new Date().toISOString())
    .select("id,name,email,visitor_timezone,starts_at,prospect_id,booking_type_id,zoom_meeting_id,google_event_id")
    .maybeSingle();
  if (updateError) {
    console.error("Booking cancel update failed", { code: updateError.code });
    return fail(503, "booking_service_unavailable");
  }
  if (!booking) return fail(409, "booking_not_found_or_not_cancellable");

  const { data: settings } = await supabase.from("booking_settings").select("google_calendar_id").eq("id", true).single();
  const calendarId = settings?.google_calendar_id || "primary";
  if (booking.zoom_meeting_id) await attemptBookingCleanup(supabase, {
    bookingId: booking.id, prospectId: booking.prospect_id, operation: "cancel_zoom",
    provider: "zoom", resourceId: booking.zoom_meeting_id,
  }, () => cancelZoomMeeting(booking.zoom_meeting_id));
  if (booking.google_event_id) await attemptBookingCleanup(supabase, {
    bookingId: booking.id, prospectId: booking.prospect_id, operation: "delete_calendar_event",
    provider: "google_calendar", resourceId: booking.google_event_id,
  }, () => deleteCalendarEvent(calendarId, booking.google_event_id));

  const { data: bookingType } = await supabase.from("booking_types").select("name").eq("id", booking.booking_type_id).single();
  await sendCancelEmail(supabase, booking, bookingType?.name || "call")
    .catch((error) => console.error("Booking cancel email failed", { message: error?.message }));

  return NextResponse.json({ success: true });
}
