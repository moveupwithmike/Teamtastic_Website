import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { authorizeWebhook, errorText, functionError, serviceClient } from "../_shared/runtime.ts";

const PROMPT_VERSION = "phase3-v3.1-teamtastic-voice";

function firstName(prospect: Record<string, unknown>) {
  const explicit = String(prospect.first_name || "").trim();
  if (explicit) return explicit;
  return String(prospect.full_name || "there").trim().split(/\s+/)[0] || "there";
}

function cleanEvidence(value: unknown) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, 240);
}

function outreachCopy(
  prospect: Record<string, unknown>,
  companyName: string,
  signalType: string,
  evidence: string,
) {
  const remoteSignal = /(remote|workplace|office|expansion)/i.test(signalType);
  const hiringSignal = /(hiring|job|growth)/i.test(signalType);
  const hiringObservations = [
    "A new hire can learn the org chart from a document. Learning who turns trivia into a championship sport takes a better kind of introduction.",
    "A new role can fill a seat. The harder part is helping the person behind it feel like part of the team.",
    "Onboarding explains how work gets done. Shared experiences help people discover who they’re doing it with.",
  ];
  const companyKey = Array.from(companyName).reduce((sum, character) => sum + character.charCodeAt(0), 0);
  const observation = remoteSignal
    ? "Remote teams rarely need another forced happy hour. They need a reason to laugh, compete a little, and meet someone outside their usual circle."
    : hiringSignal
    ? hiringObservations[companyKey % hiringObservations.length]
    : "A good team event should create more than a group photo. It should give people a reason to talk, laugh, and discover something new about each other.";

  return {
    subject: `An idea for the ${companyName} team`.slice(0, 120),
    bodyText: [
      `Hi ${firstName(prospect)},`,
      "",
      `${evidence}`,
      "",
      observation,
      "",
      "That’s what Teamtastic is built for: a polished, facilitated experience where the team gets to laugh, participate, and connect—and the organizer never has to rescue the event.",
      "",
      "Worth sending over two or three ideas?",
      "",
      "Michael",
    ].join("\n"),
  };
}

// Used only when no active company signal exists. Never invents a specific fact about the
// company or prospect — stays honest per TEAMTASTIC_OUTREACH_VOICE.md's "personalize only
// from stored evidence" rule, using real data we actually have (company name, industry).
function genericOutreachCopy(prospect: Record<string, unknown>, companyName: string, industry: string | null) {
  const observations = [
    "Remote and hybrid teams rarely need another forced happy hour. They need a reason to laugh, compete a little, and meet someone outside their usual circle.",
    "A new hire can learn the org chart from a document. Learning who turns trivia into a championship sport takes a better kind of introduction.",
    "A good team event should create more than a group photo. It should give people a reason to talk, laugh, and discover something new about each other.",
  ];
  const reasons = [
    `I've been reaching out to teams at companies like ${companyName}${industry ? ` in ${industry}` : ""} that are growing fast enough to need a reason to actually get together.`,
    `${companyName} came up while I was looking at teams that could use a break from the usual happy hour rotation.`,
    `I came across ${companyName} and figured it's worth a note, even without a specific reason beyond "your team probably deserves a good event."`,
  ];
  const key = Array.from(companyName).reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return {
    subject: `An idea for the ${companyName} team`.slice(0, 120),
    bodyText: [
      `Hi ${firstName(prospect)},`,
      "",
      reasons[key % reasons.length],
      "",
      observations[key % observations.length],
      "",
      "That’s what Teamtastic is built for: a polished, facilitated experience where the team gets to laugh, participate, and connect—and the organizer never has to rescue the event.",
      "",
      "Worth sending over two or three ideas?",
      "",
      "Michael",
    ].join("\n"),
  };
}

async function fingerprint(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (request) => {
  const unauthorized = await authorizeWebhook(request, "PHASE3_PIPELINE_WEBHOOK_SECRET");
  if (unauthorized) return unauthorized;
  const supabase = serviceClient();
  const { data: config, error: configError } = await supabase.from("system_config").select(
    "master_enabled,prospecting_enabled,outbound_mode,phase3_scoring_enabled,phase3_drafting_enabled,phase3_minimum_score,phase3_max_drafts_per_run",
  ).eq("id", true).single();
  if (configError) return functionError("config_query_failed");

  const { data: run, error: runError } = await supabase.from("source_runs").insert({
    run_type: "outreach_drafting",
    provider: "teamtastic",
    status: "started",
    decision: { prompt_version: PROMPT_VERSION, send_enabled: false },
  }).select("id").single();
  if (runError || !run) return functionError("source_run_creation_failed");

  if (!config.master_enabled || !config.phase3_scoring_enabled || !config.phase3_drafting_enabled) {
    await supabase.from("source_runs").update({
      status: "skipped",
      completed_at: new Date().toISOString(),
      decision: { reason: "phase3_pipeline_disabled", send_enabled: false },
    }).eq("id", run.id);
    return Response.json({ drafted: 0, skipped: true, reason: "phase3_pipeline_disabled" });
  }

  try {
    const { data: scoringCandidates, error: scoringError } = await supabase.from("prospects")
      .select("id")
      .not("email_normalized", "is", null)
      .not("company_id", "is", null)
      .not("status", "in", "(suppressed,not_interested,converted,disqualified)")
      .limit(100);
    if (scoringError) throw scoringError;

    let scored = 0;
    for (const candidate of scoringCandidates || []) {
      const { data: result, error: scoreError } = await supabase.rpc("score_prospect", {
        p_prospect_id: candidate.id,
      });
      if (scoreError) throw scoreError;
      if (result?.scored) scored++;
    }

    const minimumScore = Number(config.phase3_minimum_score || 65);
    const draftLimit = Math.min(Number(config.phase3_max_drafts_per_run || 10), 100);
    const { data: candidates, error: candidateError } = await supabase.from("prospects").select(
      "id,first_name,full_name,email,email_normalized,job_title,score,status,company_id,companies(id,name,industry,signals(id,signal_type,evidence,strength,observed_at,expires_at))",
    )
      .gte("score", minimumScore)
      .not("email_normalized", "is", null)
      .not("company_id", "is", null)
      .not("status", "in", "(suppressed,not_interested,converted,disqualified)")
      .order("score", { ascending: false })
      .limit(draftLimit * 3);
    if (candidateError) throw candidateError;

    let drafted = 0;
    let suppressed = 0;
    let missingSignal = 0;
    for (const prospect of candidates || []) {
      if (drafted >= draftLimit) break;
      const { data: suppression } = await supabase.from("suppression_list").select("id")
        .eq("email_normalized", prospect.email_normalized).maybeSingle();
      if (suppression) {
        suppressed++;
        continue;
      }

      const company = Array.isArray(prospect.companies) ? prospect.companies[0] : prospect.companies;
      if (!company) {
        missingSignal++;
        continue;
      }
      const signals = (company?.signals || [])
        .filter((signal: Record<string, unknown>) => !signal.expires_at || new Date(String(signal.expires_at)) > new Date())
        .sort((a: Record<string, unknown>, b: Record<string, unknown>) => Number(b.strength) - Number(a.strength));
      const signal = signals[0];
      const evidence = signal ? cleanEvidence(signal.evidence) : null;
      const companyName = String(company.name || "your team").trim();

      const { subject, bodyText } = signal && evidence
        ? outreachCopy(prospect, companyName, String(signal.signal_type || ""), evidence)
        : genericOutreachCopy(prospect, companyName, company.industry || null);
      const draftFingerprint = signal && evidence
        ? await fingerprint(`${prospect.id}|${signal.id}|${PROMPT_VERSION}`)
        : await fingerprint(`${prospect.id}|generic|${PROMPT_VERSION}`);
      const autonomous = config.outbound_mode === "autonomous" && config.prospecting_enabled;
      const { data: draft, error: draftError } = await supabase.from("outreach_drafts").upsert({
        prospect_id: prospect.id,
        signal_id: signal && evidence ? signal.id : null,
        source_run_id: run.id,
        subject,
        body_text: bodyText,
        personalization_evidence: signal && evidence
          ? [{ signal_type: signal.signal_type, evidence, observed_at: signal.observed_at }]
          : [{ signal_type: "generic", evidence: "No active company signal — used a generic, honest opener." }],
        status: autonomous ? "approved" : "review",
        approved_at: autonomous ? new Date().toISOString() : null,
        approved_by: autonomous ? "automation:phase3-draft-pipeline" : null,
        model: "deterministic-template",
        prompt_version: PROMPT_VERSION,
        fingerprint: draftFingerprint,
      }, { onConflict: "fingerprint", ignoreDuplicates: true }).select("id").maybeSingle();
      if (draftError) throw draftError;
      if (draft) drafted++;
    }

    await supabase.from("source_runs").update({
      status: "completed",
      records_scanned: scoringCandidates?.length || 0,
      records_created: drafted,
      completed_at: new Date().toISOString(),
      decision: {
        scored,
        drafted,
        suppressed,
        missing_signal: missingSignal,
        minimum_score: minimumScore,
        prompt_version: PROMPT_VERSION,
        prospecting_enabled: config.prospecting_enabled,
        send_enabled: config.outbound_mode === "autonomous",
        outbound_mode: config.outbound_mode,
      },
    }).eq("id", run.id);
    await supabase.from("agent_log").insert({
      agent_name: "phase3-draft-pipeline",
      action: "score_and_draft",
      outcome: "completed",
      decision: {
        scored,
        drafted,
        suppressed,
        missing_signal: missingSignal,
        send_enabled: config.outbound_mode === "autonomous",
        outbound_mode: config.outbound_mode,
      },
    });
    return Response.json({
      scored,
      drafted,
      suppressed,
      missing_signal: missingSignal,
      send_enabled: config.outbound_mode === "autonomous",
      outbound_mode: config.outbound_mode,
    });
  } catch (error) {
    const failure = errorText(error).slice(0, 1000);
    await supabase.from("source_runs").update({
      status: "failed",
      error: failure,
      completed_at: new Date().toISOString(),
    }).eq("id", run.id);
    await supabase.from("agent_log").insert({
      agent_name: "phase3-draft-pipeline",
      action: "score_and_draft",
      outcome: "failed",
      error: failure,
      decision: { send_enabled: false },
    });
    return new Response("Phase 3 pipeline failed", { status: 500 });
  }
});
