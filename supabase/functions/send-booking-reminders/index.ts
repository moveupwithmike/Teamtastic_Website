import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { authorizeWebhook, functionError, serviceClient } from "../_shared/runtime.ts";
import { sendViaResend } from "../_shared/email.ts";
import { buildReminderEmail, REMINDER_WINDOWS as WINDOWS } from "../_shared/booking-reminders.ts";

Deno.serve(async (request) => {
  const unauthorized = await authorizeWebhook(request, "BOOKING_REMINDERS_WEBHOOK_SECRET");
  if (unauthorized) return unauthorized;
  const supabase = serviceClient();

  const { data: config, error: configError } = await supabase
    .from("system_config")
    .select("master_enabled,booking_reminders_enabled")
    .eq("id", true)
    .single();
  if (configError) return functionError("config_query_failed");
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

      const { subject, bodyLines } = buildReminderEmail(window.label, booking, bookingTypeName);
      const bodyText = bodyLines.filter((line) => line !== null).join("\n");
      const result = await sendViaResend(supabase, {
        messageType: "booking",
        recipient: booking.email,
        idempotencyKey: `booking-reminder/${booking.id}/${window.label}`,
        from: Deno.env.get("RESEND_FROM_EMAIL"),
        to: booking.email,
        subject,
        text: bodyText,
        timeoutMs: 8000,
      });
      if (!result.reserved) {
        await supabase.from("agent_log").insert({
          agent_name: "booking-reminders", action: `send_${window.label}`, outcome: "blocked",
          prospect_id: booking.prospect_id,
          decision: { booking_id: booking.id, reason: result.reason },
        });
        continue;
      }

      const sendResult = result.sent ? "sent" : "failed";
      const providerMessageId = result.providerMessageId;
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

  // No-show follow-up: no time window needed, just "hasn't been sent yet".
  const { data: noShows, error: noShowError } = await supabase
    .from("bookings")
    .select("id,booking_type_id,prospect_id,name,email,visitor_timezone,starts_at")
    .eq("status", "no_show")
    .is("no_show_followup_sent_at", null);
  if (noShowError) {
    await supabase.from("agent_log").insert({
      agent_name: "booking-reminders", action: "query_no_show", outcome: "failed",
      error: noShowError.message,
    });
  }

  for (const booking of noShows || []) {
    processed++;
    const { data: bookingType } = await supabase
      .from("booking_types").select("name").eq("id", booking.booking_type_id).single();
    const bookingTypeName = bookingType?.name || "planning call";

    const subject = "Sorry we missed each other";
    const bodyText = [
      `Hi ${booking.name},`,
      "",
      `Looks like we missed each other for our ${bookingTypeName} — no worries at all, these things happen.`,
      "",
      "Whenever you're ready to find a new time, we're here: https://www.teamtastic.events/book",
      "",
      "Michael",
    ].join("\n");
    const result = await sendViaResend(supabase, {
      messageType: "booking",
      recipient: booking.email,
      idempotencyKey: `booking-no-show/${booking.id}`,
      from: Deno.env.get("RESEND_FROM_EMAIL"),
      to: booking.email,
      subject,
      text: bodyText,
      timeoutMs: 8000,
    });
    if (!result.reserved) {
      await supabase.from("agent_log").insert({
        agent_name: "booking-reminders", action: "send_no_show", outcome: "blocked",
        prospect_id: booking.prospect_id,
        decision: { booking_id: booking.id, reason: result.reason },
      });
      continue;
    }

    const sendResult = result.sent ? "sent" : "failed";
    const providerMessageId = result.providerMessageId;
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
      await supabase.from("bookings").update({ no_show_followup_sent_at: new Date().toISOString() }).eq("id", booking.id);
      sent++;
    }

    await supabase.from("agent_log").insert({
      agent_name: "booking-reminders", action: "send_no_show", outcome: sendResult,
      prospect_id: booking.prospect_id,
      decision: { booking_id: booking.id, provider_message_id: providerMessageId },
    });
  }

  return Response.json({ processed, sent });
});
