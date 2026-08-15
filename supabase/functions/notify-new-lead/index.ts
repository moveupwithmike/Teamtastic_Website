import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { authorizeWebhook, serviceClient, type ServiceClient } from "../_shared/runtime.ts";

const escapeHtml = (value: unknown) => String(value ?? "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

async function syncLeadToCrm(supabase: ServiceClient, lead: Record<string, unknown>) {
  const email = String(lead.email ?? "").trim().toLowerCase();
  let { data: prospect } = await supabase
    .from("prospects")
    .select("id")
    .eq("email_normalized", email)
    .maybeSingle();

  if (!prospect) {
    const inserted = await supabase.from("prospects").insert({
      full_name: lead.name,
      email,
      phone: lead.phone || null,
      source: "inbound",
      status: "new",
      last_inbound_at: lead.created_at,
      metadata: { first_lead_source: lead.lead_source },
    }).select("id").single();
    prospect = inserted.data;
    if (!prospect && inserted.error?.code === "23505") {
      const raced = await supabase.from("prospects").select("id").eq("email_normalized", email).single();
      prospect = raced.data;
    }
  } else {
    await supabase.from("prospects").update({
      full_name: lead.name,
      phone: lead.phone || null,
      last_inbound_at: lead.created_at,
    }).eq("id", prospect.id);
  }

  if (!prospect) throw new Error("Could not create or find CRM prospect");
  await supabase.from("leads").update({ prospect_id: prospect.id }).eq("id", lead.id);

  const taskSource = `inbound_lead:${lead.id}`;
  const { data: existingTask } = await supabase
    .from("tasks").select("id").eq("source", taskSource).maybeSingle();
  if (!existingTask) {
    await supabase.from("tasks").insert({
      prospect_id: prospect.id,
      title: `Review inbound lead: ${lead.name}`,
      description: `Source: ${lead.lead_source}. Company: ${lead.company || "Not provided"}.`,
      priority: "high",
      due_at: new Date(Date.now() + 15 * 60_000).toISOString(),
      source: taskSource,
    });
  }
  return prospect.id;
}

function customerEmail(lead: Record<string, unknown>) {
  const name = escapeHtml(lead.name);
  const source = String(lead.lead_source ?? "");

  if (source === "playable_demo") {
    return {
      subject: "Your Teamtastic free-game link",
      html: `<h1>Nice game, ${name}!</h1><p>Thanks for trying Teamtastic. Here is the same free-game link shown on the website.</p><p><a href="https://teamtastic.games">Launch a free game lobby</a> whenever your team is ready.</p>`,
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
  if (["holiday_party_money_page", "year_end_celebration_page", "large_holiday_event_page"].includes(source)) {
    return {
      subject: "We received your Teamtastic holiday event request",
      html: `<h1>Your holiday event request is in, ${name}!</h1><p>Michael will review your dates, time zone, team size, and format preferences and follow up with availability and the best-fit experience.</p><p>If you are ready to reserve a date, you can return to Teamtastic and place the $200 date-hold deposit.</p>`,
    };
  }
  return {
    subject: "Your Teamtastic recommendation is ready",
    html: `<h1>Thanks, ${name}!</h1><p>We received your Teamtastic event details and saved your recommendation.</p><p>Return to Teamtastic to reserve a hosted event or launch a free game.</p>`,
  };
}

Deno.serve(async (request) => {
  const unauthorized = authorizeWebhook(request, "LEAD_NOTIFICATION_WEBHOOK_SECRET");
  if (unauthorized) return unauthorized;

  const { lead_id } = await request.json();
  const supabase = serviceClient();
  const { data: lead, error } = await supabase.from("leads").select("*").eq("id", lead_id).single();
  if (error || !lead) return new Response("Lead not found", { status: 404 });

  let prospectId: string;
  try {
    prospectId = await syncLeadToCrm(supabase, lead);
  } catch (crmError) {
    await supabase.from("agent_log").insert({
      agent_name: "inbound-speed-to-lead",
      action: "sync_lead_to_crm",
      outcome: "failed",
      error: String(crmError).slice(0, 1000),
      decision: { lead_id: lead.id },
    });
    return new Response("CRM sync failed", { status: 500 });
  }

  const summary = [
    `Source: ${lead.lead_source}`,
    `Name: ${lead.name}`,
    `Email: ${lead.email}`,
    `Company: ${lead.company || "Not provided"}`,
    `Team size: ${lead.team_size || "Not provided"}`,
    `Vibe: ${lead.vibe || "Not provided"}`,
    `Occasion: ${lead.occasion || "Not provided"}`,
    `Recommendation: ${lead.recommendation_key || "Not provided"}`,
    `Preferred date: ${lead.preferred_event_date || "Not provided"}`,
    `Alternate date: ${lead.alternate_event_date || "Not provided"}`,
    `Time zone: ${lead.event_timezone || "Not provided"}`,
    `Preferred time: ${lead.preferred_time || "Not provided"}`,
    `Budget: ${lead.budget_range || "Not provided"}`,
    `Package: ${lead.package_interest || "Not provided"}`,
    `Decision timeline: ${lead.decision_timeline || "Not provided"}`,
    `Phone: ${lead.phone || "Not provided"}`,
    `Landing page: ${lead.landing_page || "Unknown"}`,
  ].join("\n");
  const confirmation = customerEmail(lead);

  // Certification leads exercise the real CRM sync and database triggers, but
  // must never consume quota or contact either the synthetic buyer or staff.
  if ((lead.context as Record<string, unknown> | null)?.synthetic_test === true) {
    for (const notificationType of ["customer_confirmation", "internal_email"]) {
      await supabase.from("notification_deliveries").upsert({
        lead_id: lead.id,
        notification_type: notificationType,
        status: "test_suppressed",
        attempts: 0,
        last_error: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "lead_id,notification_type" });
    }
    await supabase.from("agent_log").insert({
      agent_name: "b2b-certification",
      action: "suppress_synthetic_notifications",
      outcome: "completed",
      prospect_id: prospectId,
      decision: { lead_id: lead.id, external_send: false },
    });
    return Response.json({ success: true, synthetic_test: true, external_send: false });
  }

  const notifications = [
    {
      type: "customer_confirmation",
      messageType: "inbound_confirmation",
      to: lead.email,
      subject: confirmation.subject,
      html: confirmation.html,
    },
    {
      type: "internal_email",
      messageType: "internal_notification",
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

    const { data: reservation, error: reservationError } = await supabase.rpc("reserve_email_send", {
      p_message_type: notification.messageType,
      p_recipient: notification.to,
    });
    if (reservationError || reservation?.allowed !== true) {
      await supabase.from("agent_log").insert({
        agent_name: "inbound-speed-to-lead",
        action: `send_${notification.type}`,
        outcome: "blocked",
        prospect_id: prospectId,
        decision: { lead_id: lead.id, reservation, error: reservationError?.message || null },
      });
      continue;
    }

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
      await supabase.rpc("record_email_send_result", {
        p_message_type: notification.messageType,
        p_sent: mail.ok,
      });
      await supabase.from("notification_deliveries").upsert({
        lead_id: lead.id,
        notification_type: notification.type,
        status: mail.ok ? "sent" : "failed",
        provider_message_id: result.id || null,
        attempts: (existing?.attempts || 0) + 1,
        last_error: mail.ok ? null : JSON.stringify(result).slice(0, 1000),
        updated_at: new Date().toISOString(),
      }, { onConflict: "lead_id,notification_type" });
      await supabase.from("messages").insert({
        prospect_id: prospectId,
        direction: "outbound",
        message_type: notification.messageType,
        provider: "resend",
        provider_message_id: result.id || null,
        from_address: Deno.env.get("RESEND_FROM_EMAIL") || "",
        to_addresses: [notification.to],
        subject: notification.subject,
        body_html: notification.html,
        status: mail.ok ? "sent" : "failed",
        sent_at: mail.ok ? new Date().toISOString() : null,
      });
    } catch (sendError) {
      await supabase.rpc("record_email_send_result", {
        p_message_type: notification.messageType,
        p_sent: false,
      });
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
