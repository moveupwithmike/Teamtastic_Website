import { Webhook } from "svix";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";

export const runtime = "nodejs";

const DELIVERY_STATUS = {
  "email.delivered": "delivered",
  "email.bounced": "bounced",
  "email.complained": "complained",
};

export async function POST(request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return new Response("Resend webhook is not configured", { status: 503 });

  const payload = await request.text();
  const headers = {
    "svix-id": request.headers.get("svix-id"),
    "svix-timestamp": request.headers.get("svix-timestamp"),
    "svix-signature": request.headers.get("svix-signature"),
  };
  let event;
  try {
    event = new Webhook(secret).verify(payload, headers);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  const svixId = headers["svix-id"];
  const providerMessageId = event?.data?.email_id || null;
  const recipient = Array.isArray(event?.data?.to) ? event.data.to[0] : event?.data?.to || null;
  const db = getSupabaseAdmin();

  const { error: logError } = await db.from("resend_webhook_events").insert({
    svix_id: svixId,
    event_type: event.type,
    provider_message_id: providerMessageId,
    recipient,
    raw_payload: event,
  });
  if (logError && logError.code !== "23505") {
    return new Response(`Failed to log webhook event: ${logError.message}`, { status: 500 });
  }
  if (logError?.code === "23505") {
    return Response.json({ received: true, duplicate: true });
  }

  const deliveryStatus = DELIVERY_STATUS[event.type];
  if (deliveryStatus && providerMessageId) {
    await db.from("messages").update({ status: deliveryStatus })
      .eq("provider", "resend").eq("provider_message_id", providerMessageId);
  } else {
    await db.from("agent_log").insert({
      agent_name: "resend-webhook",
      action: "receive_event",
      outcome: "completed",
      decision: { event_type: event.type, provider_message_id: providerMessageId },
    });
  }

  const bounceType = event?.data?.bounce_type || event?.data?.bounce?.type;
  const isHardBounce = event.type === "email.bounced" && bounceType !== "Soft" && bounceType !== "Transient";
  const isComplaint = event.type === "email.complained";
  if ((isHardBounce || isComplaint) && recipient) {
    await db.from("suppression_list").upsert({
      email: recipient,
      reason: isComplaint ? "complaint" : "hard_bounce",
      source: "resend_webhook",
      provider_event_id: providerMessageId,
    }, { onConflict: "email_normalized", ignoreDuplicates: true });
    await db.rpc("check_outbound_deliverability");
  }

  return Response.json({ received: true });
}
