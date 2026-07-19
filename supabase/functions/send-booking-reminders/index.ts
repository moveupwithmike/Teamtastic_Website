import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.106.1";

// Each window is wider than the 15-minute cron cadence so a booking is never
// missed between runs; reminder_*_sent_at makes re-checking it idempotent.
const WINDOWS = [
  { column: "reminder_24h_sent_at", minHours: 23.75, maxHours: 24.25, label: "24h" },
  { column: "reminder_1h_sent_at", minHours: 0.75, maxHours: 1.25, label: "1h" },
] as const;

function buildEmail(label: "24h" | "1h", booking: Record<string, unknown>, bookingTypeName: string) {
  const whenText = new Intl.DateTimeFormat("en-US", {
    timeZone: booking.visitor_timezone as string, dateStyle: "full", timeStyle: "short",
  }).format(new Date(booking.starts_at as string));
  const joinLine = booking.zoom_join_url ? `Join link: ${booking.zoom_join_url}` : null;

  if (label === "24h") {
    return {
      subject: `Tomorrow: your ${bookingTypeName} with Teamtastic`,
      bodyLines: [
        `Hi ${booking.name},`,
        "",
        `Quick reminder — our ${bookingTypeName} is tomorrow, ${whenText} (${(booking.visitor_timezone as string).replaceAll("_", " ")}).`,
        "",
        joinLine,
        "",
        "Come with your team in mind — we'll map out the rest together.",
        "",
        "Need to reschedule? Just reply to this email.",
        "",
        "Michael",
      ],
    };
  }
  return {
    subject: "Starting soon: your Teamtastic call",
    bodyLines: [
      `Hi ${booking.name},`,
      "",
      `Just a heads up — our ${bookingTypeName} starts in about an hour, at ${whenText}.`,
      "",
      joinLine,
      "",
      "See you soon!",
      "",
      "Michael",
    ],
  };
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (request.headers.get("x-webhook-secret") !== Deno.env.get("BOOKING_REMINDERS_WEBHOOK_SECRET")) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: config, error: configError } = await supabase
    .from("system_config")
    .select("master_enabled,booking_reminders_enabled")
    .eq("id", true)
    .single();
  if (configError) return new Response(`Config failed: ${configError.message}`, { status: 500 });
  if (!config.master_enabled || !config.booking_reminders_enabled) {
    return Response.json({ processed: 0, sent: 0, skipped: true, reason: "booking_reminders_disabled" });
  }

  let processed = 0;
  let sent = 0;

  for (const window of WINDOWS) {
    const now = Date.now();
    const minStart = new Date(now + window.minHours * 3_600_000).toISOString();
    const maxStart = new Date(now + window.maxHours * 3_600_000).toISOString();

    const { data: bookings, error: bookingsError } = await supabase
      .from("bookings")
      .select("id,booking_type_id,prospect_id,name,email,visitor_timezone,starts_at,zoom_join_url")
      .eq("status", "confirmed")
      .is(window.column, null)
      .gte("starts_at", minStart)
      .lte("starts_at", maxStart);
    if (bookingsError) {
      await supabase.from("agent_log").insert({
        agent_name: "booking-reminders", action: `query_${window.label}`, outcome: "failed",
        error: bookingsError.message,
      });
      continue;
    }

    for (const booking of bookings || []) {
      processed++;
      const { data: bookingType } = await supabase
        .from("booking_types").select("name").eq("id", booking.booking_type_id).single();
      const bookingTypeName = bookingType?.name || "planning call";

      const { data: reservation, error: reservationError } = await supabase.rpc("reserve_email_send", {
        p_message_type: "booking",
        p_recipient: booking.email,
      });
      if (reservationError || reservation?.allowed !== true) {
        await supabase.from("agent_log").insert({
          agent_name: "booking-reminders", action: `send_${window.label}`, outcome: "blocked",
          prospect_id: booking.prospect_id,
          decision: { booking_id: booking.id, reservation, error: reservationError?.message || null },
        });
        continue;
      }

      const { subject, bodyLines } = buildEmail(window.label, booking, bookingTypeName);
      const bodyText = bodyLines.filter((line) => line !== null).join("\n");

      let sendResult = "failed";
      let providerMessageId: string | null = null;
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: Deno.env.get("RESEND_FROM_EMAIL"),
            to: booking.email,
            subject,
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
        from_address: Deno.env.get("RESEND_FROM_EMAIL") || "",
        to_addresses: [booking.email],
        subject,
        body_text: bodyText,
        status: sendResult,
        sent_at: sendResult === "sent" ? new Date().toISOString() : null,
      });

      if (sendResult === "sent") {
        await supabase.from("bookings").update({ [window.column]: new Date().toISOString() }).eq("id", booking.id);
        sent++;
      }

      await supabase.from("agent_log").insert({
        agent_name: "booking-reminders", action: `send_${window.label}`, outcome: sendResult,
        prospect_id: booking.prospect_id,
        decision: { booking_id: booking.id, provider_message_id: providerMessageId },
      });
    }
  }

  return Response.json({ processed, sent });
});
