import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { authorizeWebhook, functionError, serviceClient } from "../_shared/runtime.ts";

const PROMPT_VERSION = "sequence-followups-v2-data-driven";

function firstName(prospect: Record<string, unknown>) {
  const explicit = String(prospect.first_name || "").trim();
  if (explicit) return explicit;
  return String(prospect.full_name || "there").trim().split(/\s+/)[0] || "there";
}

async function fingerprint(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function render(template: string, prospect: Record<string, unknown>, companyName: string) {
  return template
    .replaceAll("{{first_name}}", firstName(prospect))
    .replaceAll("{{company}}", companyName);
}

Deno.serve(async (request) => {
  const unauthorized = await authorizeWebhook(request, "DRAFT_SEQUENCE_FOLLOWUPS_WEBHOOK_SECRET");
  if (unauthorized) return unauthorized;
  const supabase = serviceClient();

  const { data: config, error: configError } = await supabase
    .from("system_config")
    .select("master_enabled,prospecting_enabled,sequence_followups_enabled,outbound_auto_paused")
    .eq("id", true)
    .single();
  if (configError) return functionError("config_query_failed");
  if (!config.master_enabled) return Response.json({ drafted: 0, reason: "master_kill_switch" });
  if (!config.prospecting_enabled) return Response.json({ drafted: 0, reason: "prospecting_disabled" });
  if (!config.sequence_followups_enabled) return Response.json({ drafted: 0, reason: "sequence_followups_disabled" });
  if (config.outbound_auto_paused) return Response.json({ drafted: 0, reason: "outbound_auto_paused" });

  // Anyone who replied or booked is already excluded here — automation.handle_inbound_message
  // and automation.on_booking_confirmed already flip status away from 'active' on those events.
  const { data: enrollments, error: enrollmentsError } = await supabase
    .from("sequence_enrollments")
    .select("id,sequence_id,current_step,prospect_id,prospects(id,first_name,full_name,email,email_normalized,status,company_id,companies(name))")
    .eq("status", "active")
    .lte("next_action_at", new Date().toISOString())
    .limit(50);
  if (enrollmentsError) return functionError("sequence_enrollment_query_failed");
  if (!enrollments?.length) return Response.json({ drafted: 0, reason: "no_due_enrollments" });

  let drafted = 0;
  let skipped = 0;

  for (const enrollment of enrollments) {
    const prospectRaw = enrollment.prospects as unknown;
    const prospect = (Array.isArray(prospectRaw) ? prospectRaw[0] : prospectRaw) as Record<string, unknown> | null;
    if (!prospect?.email_normalized) {
      skipped++;
      continue;
    }

    const { data: suppression } = await supabase.from("suppression_list").select("id")
      .eq("email_normalized", prospect.email_normalized as string).maybeSingle();
    if (suppression) {
      await supabase.from("sequence_enrollments").update({ status: "stopped_suppressed", stopped_reason: "suppressed" }).eq("id", enrollment.id);
      skipped++;
      continue;
    }

    const nextStep = Number(enrollment.current_step || 1) + 1;
    const { data: step } = await supabase.from("sequence_steps")
      .select("id,step_number,delay_minutes,subject_template,body_template")
      .eq("sequence_id", enrollment.sequence_id)
      .eq("step_number", nextStep)
      .eq("status", "approved")
      .maybeSingle();
    if (!step) {
      await supabase.from("sequence_enrollments").update({ status: "completed", next_action_at: null }).eq("id", enrollment.id);
      continue;
    }

    const company = Array.isArray(prospect.companies) ? prospect.companies[0] : prospect.companies;
    const companyName = String((company as Record<string, unknown> | null)?.name || "your team").trim();
    const subject = render(step.subject_template, prospect, companyName).slice(0, 120);
    const bodyText = render(step.body_template, prospect, companyName);
    const draftFingerprint = await fingerprint(`${prospect.id}|${step.id}|${PROMPT_VERSION}`);

    const { data: draft, error: draftError } = await supabase.from("outreach_drafts").upsert({
      prospect_id: prospect.id,
      sequence_enrollment_id: enrollment.id,
      sequence_step: nextStep,
      subject,
      body_text: bodyText,
      personalization_evidence: [{ signal_type: "sequence_followup", evidence: `Scheduled follow-up from sequence step ${step.id}.` }],
      status: "review",
      model: "deterministic-template",
      prompt_version: PROMPT_VERSION,
      fingerprint: draftFingerprint,
    }, { onConflict: "fingerprint", ignoreDuplicates: true }).select("id").maybeSingle();
    if (draftError) throw draftError;

    const { data: followingStep } = await supabase.from("sequence_steps")
      .select("delay_minutes")
      .eq("sequence_id", enrollment.sequence_id)
      .eq("step_number", nextStep + 1)
      .eq("status", "approved")
      .maybeSingle();
    const isFinalStep = !followingStep;
    await supabase.from("sequence_enrollments").update(
      isFinalStep
        ? { status: "completed", current_step: nextStep, next_action_at: null }
        : { current_step: nextStep, next_action_at: new Date(Date.now() + Number(followingStep.delay_minutes) * 60_000).toISOString() },
    ).eq("id", enrollment.id);

    if (draft) drafted++;
    await supabase.from("agent_log").insert({
      agent_name: "draft-sequence-followups", action: "draft_followup", outcome: draft ? "completed" : "skipped",
      prospect_id: prospect.id, decision: { enrollment_id: enrollment.id, step: nextStep, draft_id: draft?.id || null },
    });
  }

  return Response.json({ processed: enrollments.length, drafted, skipped });
});
