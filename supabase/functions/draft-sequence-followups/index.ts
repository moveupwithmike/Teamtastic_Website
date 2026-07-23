import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.106.1";

const PROMPT_VERSION = "sequence-followups-v1";
const MAX_STEPS = 3;
const STEP_DELAY_DAYS = 4; // delay before the *next* step after this one drafts

function firstName(prospect: Record<string, unknown>) {
  const explicit = String(prospect.first_name || "").trim();
  if (explicit) return explicit;
  return String(prospect.full_name || "there").trim().split(/\s+/)[0] || "there";
}

async function fingerprint(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

// Short, honest, no invented specifics beyond company name — matches
// TEAMTASTIC_OUTREACH_VOICE.md's "personalize only from stored evidence" rule. Much
// shorter than a first touch; bump/breakup emails read poorly if they're as long as
// the original.
function followUpCopy(prospect: Record<string, unknown>, companyName: string, step: number) {
  if (step === 2) {
    return {
      subject: `Following up — ${companyName}`.slice(0, 120),
      bodyText: [
        `Hi ${firstName(prospect)},`,
        "",
        `Wanted to make sure this didn't get lost in the shuffle — I'd sent a note about bringing a hosted Teamtastic experience to the ${companyName} team.`,
        "",
        "Still worth a quick look, or is now just not the right time?",
        "",
        "Michael",
      ].join("\n"),
    };
  }
  return {
    subject: `Last note from me — ${companyName}`.slice(0, 120),
    bodyText: [
      `Hi ${firstName(prospect)},`,
      "",
      "I don't want to keep showing up in your inbox, so I'll leave this as my last note for now.",
      "",
      `If the timing's ever right for ${companyName} to do something fun together as a team, just reply — happy to pick this back up anytime.`,
      "",
      "Michael",
    ].join("\n"),
  };
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (request.headers.get("x-webhook-secret") !== Deno.env.get("DRAFT_SEQUENCE_FOLLOWUPS_WEBHOOK_SECRET")) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: config, error: configError } = await supabase
    .from("system_config")
    .select("master_enabled,prospecting_enabled,sequence_followups_enabled,outbound_auto_paused")
    .eq("id", true)
    .single();
  if (configError) return new Response(`Config failed: ${configError.message}`, { status: 500 });
  if (!config.master_enabled) return Response.json({ drafted: 0, reason: "master_kill_switch" });
  if (!config.prospecting_enabled) return Response.json({ drafted: 0, reason: "prospecting_disabled" });
  if (!config.sequence_followups_enabled) return Response.json({ drafted: 0, reason: "sequence_followups_disabled" });
  if (config.outbound_auto_paused) return Response.json({ drafted: 0, reason: "outbound_auto_paused" });

  // Anyone who replied or booked is already excluded here — automation.handle_inbound_message
  // and automation.on_booking_confirmed already flip status away from 'active' on those events.
  const { data: enrollments, error: enrollmentsError } = await supabase
    .from("sequence_enrollments")
    .select("id,current_step,prospect_id,prospects(id,first_name,full_name,email,email_normalized,status,company_id,companies(name))")
    .eq("status", "active")
    .lte("next_action_at", new Date().toISOString())
    .limit(50);
  if (enrollmentsError) return new Response(`Query failed: ${enrollmentsError.message}`, { status: 500 });
  if (!enrollments?.length) return Response.json({ drafted: 0, reason: "no_due_enrollments" });

  let drafted = 0;
  let skipped = 0;

  for (const enrollment of enrollments) {
    const prospect = enrollment.prospects as Record<string, unknown> | null;
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
    if (nextStep > MAX_STEPS) {
      await supabase.from("sequence_enrollments").update({ status: "completed", next_action_at: null }).eq("id", enrollment.id);
      continue;
    }

    const company = Array.isArray(prospect.companies) ? prospect.companies[0] : prospect.companies;
    const companyName = String((company as Record<string, unknown> | null)?.name || "your team").trim();
    const { subject, bodyText } = followUpCopy(prospect, companyName, nextStep);
    const draftFingerprint = await fingerprint(`${prospect.id}|step${nextStep}|${PROMPT_VERSION}`);

    const { data: draft, error: draftError } = await supabase.from("outreach_drafts").upsert({
      prospect_id: prospect.id,
      sequence_enrollment_id: enrollment.id,
      sequence_step: nextStep,
      subject,
      body_text: bodyText,
      personalization_evidence: [{ signal_type: "sequence_followup", evidence: `Scheduled follow-up, step ${nextStep} of ${MAX_STEPS}.` }],
      status: "review",
      model: "deterministic-template",
      prompt_version: PROMPT_VERSION,
      fingerprint: draftFingerprint,
    }, { onConflict: "fingerprint", ignoreDuplicates: true }).select("id").maybeSingle();
    if (draftError) throw draftError;

    const isFinalStep = nextStep >= MAX_STEPS;
    await supabase.from("sequence_enrollments").update(
      isFinalStep
        ? { status: "completed", current_step: nextStep, next_action_at: null }
        : { current_step: nextStep, next_action_at: new Date(Date.now() + STEP_DELAY_DAYS * 86400_000).toISOString() },
    ).eq("id", enrollment.id);

    if (draft) drafted++;
    await supabase.from("agent_log").insert({
      agent_name: "draft-sequence-followups", action: "draft_followup", outcome: draft ? "completed" : "skipped",
      prospect_id: prospect.id, decision: { enrollment_id: enrollment.id, step: nextStep, draft_id: draft?.id || null },
    });
  }

  return Response.json({ processed: enrollments.length, drafted, skipped });
});
