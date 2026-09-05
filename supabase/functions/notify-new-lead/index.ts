import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { authorizeWebhook, serviceClient } from "../_shared/runtime.ts";
import { sendViaResend } from "../_shared/email.ts";
import { provenanceBlocksDelivery } from "../_shared/lead-notifications.ts";

const escapeHtml = (value: unknown) => String(value ?? "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

// deno-lint-ignore no-explicit-any -- the untyped Supabase client's generic
// SupabaseClient<...> shape doesn't survive being passed as an explicit
// cross-function parameter type without a version-resolution mismatch; every
// other function in this codebase just calls serviceClient() inline instead
// of extracting a typed helper, which avoids the issue entirely.
async function syncLeadToCrm(supabase: any, lead: Record<string, unknown>) {
  const email = String(lead.email ?? "").trim().toLowerCase();
  const leadAudience = ["family", "friends", "other_private_event"].includes(String(lead.audience_type))
    ? String(lead.audience_type)
    : "corporate";
  let { data: prospect } = await supabase
    .from("prospects")
    .select("id,audience_type")
    .eq("email_normalized", email)
    .maybeSingle();

  if (!prospect) {
    const inserted = await supabase.from("prospects").insert({
      full_name: lead.name,
      email,
      phone: lead.phone || null,
      source: "inbound",
      status: "new",
      audience_type: leadAudience,
      last_inbound_at: lead.created_at,
      metadata: { first_lead_source: lead.lead_source },
    }).select("id,audience_type").single();
    prospect = inserted.data;
    if (!prospect && inserted.error?.code === "23505") {
      const raced = await supabase.from("prospects").select("id,audience_type").eq("email_normalized", email).single();
      prospect = raced.data;
    }
  } else {
    const currentAudience = String(prospect.audience_type || "corporate");
    await supabase.from("prospects").update({
      full_name: lead.name,
      phone: lead.phone || null,
      last_inbound_at: lead.created_at,
      audience_type: currentAudience === leadAudience || currentAudience === "mixed"
        ? currentAudience
        : "mixed",
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
      description: leadAudience === "corporate"
        ? `Source: ${lead.lead_source}. Company: ${lead.company || "Not provided"}.`
        : `Source: ${lead.lead_source}. Private group: ${lead.group_name || "Not provided"}.`,
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
  const unauthorized = await authorizeWebhook(request, "LEAD_NOTIFICATION_WEBHOOK_SECRET");
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
    `Audience: ${lead.audience_type || "corporate"}`,
    `Name: ${lead.name}`,
    `Email: ${lead.email}`,
    `Company: ${lead.company || "Not provided"}`,
    `Family / group name: ${lead.group_name || "Not provided"}`,
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
  // Authoritative provenance (the classification ledger) is consulted in
  // addition to the native context marker so late-classified or mixed-
  // lineage leads fail closed even if their context was never flagged.
  let classificationBlocked = false;
  {
    const recordTypes: Array<[string, string]> = [["lead", String(lead.id)]];
    if (lead.prospect_id) recordTypes.push(["prospect", String(lead.prospect_id)]);
    for (const [recordType, recordId] of recordTypes) {
      const { data: status } = await supabase
        .from("production_record_classification_status")
        .select("classification")
        .eq("record_type", recordType)
        .eq("record_id", recordId)
        .maybeSingle();
      if (provenanceBlocksDelivery(status?.classification)) {
        classificationBlocked = true;
        break;
      }
    }
  }

  if (
    (lead.context as Record<string, unknown> | null)?.synthetic_test === true ||
    classificationBlocked
  ) {
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

    const result = await sendViaResend(supabase, {
      messageType: notification.messageType,
      recipient: notification.to,
      idempotencyKey: `lead-notification/${lead.id}/${notification.type}`,
      from: Deno.env.get("RESEND_FROM_EMAIL"),
      to: notification.to,
      subject: notification.subject,
      html: notification.html,
    });
    if (!result.reserved) {
      await supabase.from("agent_log").insert({
        agent_name: "inbound-speed-to-lead",
        action: `send_${notification.type}`,
        outcome: "blocked",
        prospect_id: prospectId,
        decision: { lead_id: lead.id, reason: result.reason },
      });
      continue;
    }

    try {
      await supabase.from("notification_deliveries").upsert({
        lead_id: lead.id,
        notification_type: notification.type,
        status: result.sent ? "sent" : "failed",
        provider_message_id: result.providerMessageId,
        attempts: (existing?.attempts || 0) + 1,
        last_error: result.reason,
        updated_at: new Date().toISOString(),
      }, { onConflict: "lead_id,notification_type" });
      await supabase.from("messages").insert({
        prospect_id: prospectId,
        direction: "outbound",
        message_type: notification.messageType,
        provider: "resend",
        provider_message_id: result.providerMessageId,
        from_address: Deno.env.get("RESEND_FROM_EMAIL") || "",
        to_addresses: [notification.to],
        subject: notification.subject,
        body_html: notification.html,
        status: result.sent ? "sent" : "failed",
        sent_at: result.sent ? new Date().toISOString() : null,
      });
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
