import { authorizeWebhook, functionError, serviceClient } from "../_shared/runtime.ts";
import { sendViaResend } from "../_shared/email.ts";
import {
  buildFamilyNurtureEmail,
  buildNurtureEmail,
  FAMILY_NURTURE_STEPS,
  nextFamilyNurtureStep,
  nextNurtureStep,
  NURTURE_STEPS,
} from "../_shared/nurture.ts";

// Don't resurrect leads with a multi-week-old sequence if a run was missed.
const MAX_AGE_HOURS = 30 * 24;

type NurtureDependencies = {
  authorize: typeof authorizeWebhook;
  createClient: typeof serviceClient;
  sendEmail: typeof sendViaResend;
  now: () => number;
};

const defaultDependencies: NurtureDependencies = {
  authorize: authorizeWebhook,
  createClient: serviceClient,
  sendEmail: sendViaResend,
  now: Date.now,
};

export async function handleNurtureRequest(
  request: Request,
  dependencies: NurtureDependencies = defaultDependencies,
) {
  const unauthorized = await dependencies.authorize(request, "NURTURE_WEBHOOK_SECRET");
  if (unauthorized) return unauthorized;
  const supabase = dependencies.createClient();
  const now = dependencies.now();

  const { data: leads, error } = await supabase
    .from("leads")
    .select("*")
    .in("lead_source", ["event_quiz", "michael_family_concierge"])
    .lte("created_at", new Date(now - NURTURE_STEPS[0].minAgeHours * 3600_000).toISOString())
    .gte("created_at", new Date(now - MAX_AGE_HOURS * 3600_000).toISOString());

  if (error) return functionError("nurture_lead_query_failed");
  if (!leads?.length) return Response.json({ processed: 0, sent: 0 });

  let sent = 0;
  for (const lead of leads) {
    const ageHours = (now - new Date(lead.created_at as string).getTime()) / 3600_000;
    const isFamily = lead.audience_type === "family" || lead.lead_source === "michael_family_concierge";
    const steps = isFamily ? FAMILY_NURTURE_STEPS : NURTURE_STEPS;

    const { data: stopReason, error: stopError } = await supabase
      .rpc("lead_nurture_stop_reason", { p_lead_id: lead.id });
    if (stopError) {
      await supabase.from("agent_log").insert({
        agent_name: "inbound-nurture", action: "check_stop_conditions", outcome: "failed",
        prospect_id: lead.prospect_id || null, error: stopError.message,
        decision: { lead_id: lead.id },
      });
      continue;
    }
    if (stopReason) continue;

    const { data: paid, error: paidError } = await supabase
      .rpc("lead_has_paid_hosted_event", { p_lead_id: lead.id });
    if (paidError) {
      await supabase.from("agent_log").insert({
        agent_name: "inbound-nurture", action: "check_paid_conversion", outcome: "failed",
        prospect_id: lead.prospect_id || null, error: paidError.message,
        decision: { lead_id: lead.id },
      });
      continue;
    }
    if (paid) continue;

    const { data: deliveries } = await supabase
      .from("notification_deliveries")
      .select("notification_type,status,attempts")
      .eq("lead_id", lead.id)
      .in("notification_type", steps.map((s) => s.type));
    const byType = new Map((deliveries || []).map((d) => [d.notification_type, d]));
    const sentTypes = new Set((deliveries || []).filter((d) => d.status === "sent").map((d) => d.notification_type));

    const step = isFamily
      ? nextFamilyNurtureStep(ageHours, sentTypes)
      : nextNurtureStep(ageHours, sentTypes);
    if (!step) continue;

    const email = isFamily
      ? buildFamilyNurtureEmail(
        step.type,
        lead,
        Deno.env.get("STRIPE_FAMILY_DEPOSIT_URL") || Deno.env.get("NEXT_PUBLIC_STRIPE_FAMILY_DEPOSIT_URL"),
      )
      : buildNurtureEmail(step.type, lead, Deno.env.get("STRIPE_DEPOSIT_URL"));
    const existing = byType.get(step.type);
    const result = await dependencies.sendEmail(supabase, {
        messageType: "nurture",
        recipient: lead.email,
        idempotencyKey: `nurture/${lead.id}/${step.type}`,
        from: Deno.env.get("RESEND_FROM_EMAIL"),
        to: lead.email,
        reply_to: Deno.env.get("INTERNAL_NOTIFICATION_EMAIL"),
        subject: email.subject,
        html: email.html,
    });
    if (!result.reserved) {
      await supabase.from("agent_log").insert({
          agent_name: "inbound-nurture",
          action: `send_${step.type}`,
          outcome: "blocked",
          prospect_id: lead.prospect_id || null,
          decision: { lead_id: lead.id, reason: result.reason },
      });
      continue;
    }
    await supabase.from("notification_deliveries").upsert({
        lead_id: lead.id,
        notification_type: step.type,
        status: result.sent ? "sent" : "failed",
        provider_message_id: result.providerMessageId,
        attempts: (existing?.attempts || 0) + 1,
        last_error: result.reason,
        updated_at: new Date().toISOString(),
    }, { onConflict: "lead_id,notification_type" });
    await supabase.from("messages").insert({
        prospect_id: lead.prospect_id || null,
        direction: "outbound",
        message_type: "nurture",
        provider: "resend",
        provider_message_id: result.providerMessageId,
        from_address: Deno.env.get("RESEND_FROM_EMAIL") || "",
        to_addresses: [lead.email],
        subject: email.subject,
        body_html: email.html,
        status: result.sent ? "sent" : "failed",
        sent_at: result.sent ? new Date().toISOString() : null,
    });
    if (result.sent) sent++;
  }

  return Response.json({ processed: leads.length, sent });
}
