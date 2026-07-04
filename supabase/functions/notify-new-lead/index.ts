import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const escapeHtml = (value: unknown) => String(value ?? "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

function customerEmail(lead: Record<string, unknown>) {
  const name = escapeHtml(lead.name);
  const source = String(lead.lead_source ?? "");

  if (source === "playable_demo") {
    return {
      subject: "Your Teamtastic free-game link",
      html: `<h1>Nice game, ${name}!</h1><p>Your Teamtastic confirmation is complete.</p><p><a href="https://teamtastic.games">Launch a free game lobby</a> whenever your team is ready.</p>`,
    };
  }
  if (source === "michael_family_concierge") {
    return {
      subject: "We received your family game-night details",
      html: `<h1>Thanks, ${name}!</h1><p>Michael received your family event details and will follow up with personalized ideas within one business day.</p>`,
    };
  }
  if (source === "michael_event_concierge") {
    return {
      subject: "We received your Teamtastic event brief",
      html: `<h1>Thanks, ${name}!</h1><p>Michael received your event brief and will follow up with recommendations within one business day.</p>`,
    };
  }
  return {
    subject: "Your Teamtastic recommendation is ready",
    html: `<h1>Thanks, ${name}!</h1><p>We received your Teamtastic event details and saved your recommendation.</p><p>Return to Teamtastic to reserve a hosted event or launch a free game.</p>`,
  };
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (request.headers.get("x-webhook-secret") !== Deno.env.get("LEAD_NOTIFICATION_WEBHOOK_SECRET")) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { lead_id } = await request.json();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const { data: lead, error } = await supabase.from("leads").select("*").eq("id", lead_id).single();
  if (error || !lead) return new Response("Lead not found", { status: 404 });

  const summary = [
    `Source: ${lead.lead_source}`,
    `Name: ${lead.name}`,
    `Email: ${lead.email}`,
    `Company: ${lead.company || "Not provided"}`,
    `Team size: ${lead.team_size || "Not provided"}`,
    `Vibe: ${lead.vibe || "Not provided"}`,
    `Occasion: ${lead.occasion || "Not provided"}`,
    `Recommendation: ${lead.recommendation_key || "Not provided"}`,
    `Landing page: ${lead.landing_page || "Unknown"}`,
  ].join("\n");
  const confirmation = customerEmail(lead);

  const notifications = [
    {
      type: "customer_confirmation",
      to: lead.email,
      subject: confirmation.subject,
      html: confirmation.html,
    },
    {
      type: "internal_email",
      to: Deno.env.get("INTERNAL_NOTIFICATION_EMAIL"),
      subject: `New Teamtastic lead: ${lead.name}`,
      html: `<h1>New Teamtastic lead</h1><pre>${escapeHtml(summary)}</pre>`,
    },
  ];

  for (const notification of notifications) {
    if (!notification.to) continue;
    const { data: existing } = await supabase
      .from("notification_deliveries")
      .select("status,attempts")
      .eq("lead_id", lead.id)
      .eq("notification_type", notification.type)
      .maybeSingle();
    if (existing?.status === "sent") continue;

    try {
      const mail = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: Deno.env.get("RESEND_FROM_EMAIL"),
          to: [notification.to],
          subject: notification.subject,
          html: notification.html,
        }),
      });
      const result = await mail.json().catch(() => ({}));
      await supabase.from("notification_deliveries").upsert({
        lead_id: lead.id,
        notification_type: notification.type,
        status: mail.ok ? "sent" : "failed",
        provider_message_id: result.id || null,
        attempts: (existing?.attempts || 0) + 1,
        last_error: mail.ok ? null : JSON.stringify(result).slice(0, 1000),
        updated_at: new Date().toISOString(),
      }, { onConflict: "lead_id,notification_type" });
    } catch (sendError) {
      await supabase.from("notification_deliveries").upsert({
        lead_id: lead.id,
        notification_type: notification.type,
        status: "failed",
        attempts: (existing?.attempts || 0) + 1,
        last_error: String(sendError).slice(0, 1000),
        updated_at: new Date().toISOString(),
      }, { onConflict: "lead_id,notification_type" });
    }
  }

  return Response.json({ success: true });
});
