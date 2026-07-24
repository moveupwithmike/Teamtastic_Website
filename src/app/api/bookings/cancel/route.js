import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import { deleteCalendarEvent } from "@/lib/server/google-calendar";
import { cancelZoomMeeting } from "@/lib/server/zoom";
import { verifyTurnstile } from "@/lib/server/turnstile";
import { rateLimited } from "@/lib/server/rate-limit";
import { attemptBookingCleanup } from "@/lib/server/booking-cleanup";
import { resolveManagedBooking } from "@/lib/server/booking-manage";

export const runtime = "nodejs";

function clean(value, max = 300) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function fail(status, reason) {
  return NextResponse.json({ success: false, reason }, { status });
}

async function sendCancelEmail(supabase, booking, bookingTypeName) {
  const { data: reservation } = await supabase.rpc("reserve_email_send", {
    p_message_type: "booking",
    p_recipient: booking.email,
  });
  if (!reservation?.allowed) return;

  const whenText = new Intl.DateTimeFormat("en-US", {
    timeZone: booking.visitor_timezone, dateStyle: "full", timeStyle: "short",
  }).format(new Date(booking.starts_at));
  const bodyText = [
    `Hi ${booking.name},`,
    "",
    `Your ${bookingTypeName} on ${whenText} (${booking.visitor_timezone.replaceAll("_", " ")}) has been canceled.`,
    "",
    "Whenever you're ready to find a new time, we're here: https://www.teamtastic.events/book",
    "",
    "Michael",
  ].join("\n");

  let sendResult = "failed";
  let providerMessageId = null;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL,
        to: booking.email,
        subject: `Canceled: ${bookingTypeName} with Teamtastic`,
        text: bodyText,
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
    subject: `Canceled: ${bookingTypeName} with Teamtastic`,
    body_text: bodyText,
    status: sendResult,
    sent_at: sendResult === "sent" ? new Date().toISOString() : null,
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
  if (rateLimited(createHash("sha256").update(`cancel:${ip}:${token}`).digest("hex"))) return fail(429, "rate_limited");
  try {
    if (!(await verifyTurnstile(clean(body.turnstileToken, 2048), ip))) return fail(400, "bot_verification_failed");
  } catch {
    return fail(503, "verification_unavailable");
  }
  const tokenHash = createHash("sha256").update(token).digest("hex");

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
