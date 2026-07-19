import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.106.1";

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

function scoreProspect(prospect: Record<string, any>) {
  const company = Array.isArray(prospect.companies) ? prospect.companies[0] : prospect.companies;
  let companyFit = 0;
  if (company) {
    if (Number(company.employee_count) >= 25 && Number(company.employee_count) <= 2000) companyFit += 20;
    if (company.domain) companyFit += 5;
    if (company.industry) companyFit += 5;
    if (["prospect", "qualified", "opportunity"].includes(company.lifecycle_stage)) companyFit += 5;
  }

  const title = String(prospect.job_title || "");
  let roleFit = 0;
  if (/(chief people|people operations|human resources|employee experience|culture|events?|office manager|workplace|executive assistant|chief of staff)/i.test(title)) roleFit = 25;
  else if (/(director|head|vice president|vp|manager|founder|owner|president|coordinator)/i.test(title)) roleFit = 15;
  else if (title) roleFit = 5;

  const activeSignals = (company?.signals || []).filter((signal: Record<string, unknown>) =>
    !signal.expires_at || new Date(String(signal.expires_at)) > new Date()
  );
  const strongestSignal = activeSignals.reduce(
    (strongest: number, signal: Record<string, unknown>) => Math.max(strongest, Number(signal.strength || 0)),
    0,
  );
  const signalFit = Math.round(strongestSignal * 30 * 1000) / 1000;
  const rawIntent = Number(prospect.metadata?.posthog_intent_score || 0);
  const intentFit = Number.isFinite(rawIntent) ? Math.min(10, Math.max(0, rawIntent)) : 0;
  const score = Math.min(100, companyFit + roleFit + signalFit + intentFit);
  const reasons = [
    { component: "company_fit", points: companyFit },
    { component: "role_fit", points: roleFit },
    { component: "signal_fit", points: signalFit, strongest_signal: strongestSignal },
    { component: "intent_fit", points: intentFit },
  ];
  return { score, companyFit, roleFit, signalFit, intentFit, reasons };
}

function errorText(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) return String((error as { message: unknown }).message);
  try { return JSON.stringify(error); } catch { return String(error); }
}

async function fingerprint(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (request.headers.get("x-webhook-secret") !== Deno.env.get("PHASE3_PIPELINE_WEBHOOK_SECRET")) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: config, error: configError } = await supabase.from("system_config").select(
    "master_enabled,prospecting_enabled,phase3_scoring_enabled,phase3_drafting_enabled,phase3_minimum_score,phase3_max_drafts_per_run",
  ).eq("id", true).single();
  if (configError) return new Response(`Config failed: ${configError.message}`, { status: 500 });

  const { data: run, error: runError } = await supabase.from("source_runs").insert({
    run_type: "outreach_drafting",
    provider: "teamtastic",
    status: "started",
    decision: { prompt_version: PROMPT_VERSION, send_enabled: false },
  }).select("id").single();
  if (runError || !run) return new Response(`Run creation failed: ${runError?.message}`, { status: 500 });

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
      .select("id,email_normalized,job_title,status,metadata,companies(id,domain,industry,employee_count,lifecycle_stage,signals(strength,expires_at))")
      .not("email_normalized", "is", null)
      .not("company_id", "is", null)
      .not("status", "in", "(suppressed,not_interested,converted,disqualified)")
      .limit(100);
    if (scoringError) throw scoringError;

    let scored = 0;
    for (const candidate of scoringCandidates || []) {
      const { data: suppression } = await supabase.from("suppression_list").select("id")
        .eq("email_normalized", candidate.email_normalized).maybeSingle();
      if (suppression) continue;
      const result = scoreProspect(candidate);
      const nextStatus = result.score >= 65 && ["new", "researching"].includes(candidate.status)
        ? "qualified"
        : candidate.status;
      const { error: updateError } = await supabase.from("prospects").update({
        score: result.score,
        score_reasons: result.reasons,
        status: nextStatus,
      }).eq("id", candidate.id);
      if (updateError) throw updateError;
      const { error: historyError } = await supabase.from("prospect_score_history").insert({
        prospect_id: candidate.id,
        score: result.score,
        company_fit: result.companyFit,
        role_fit: result.roleFit,
        signal_fit: result.signalFit,
        intent_fit: result.intentFit,
        reasons: result.reasons,
      });
      if (historyError) throw historyError;
      scored++;
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
      const signals = (company?.signals || [])
        .filter((signal: Record<string, unknown>) => !signal.expires_at || new Date(String(signal.expires_at)) > new Date())
        .sort((a: Record<string, unknown>, b: Record<string, unknown>) => Number(b.strength) - Number(a.strength));
      const signal = signals[0];
      if (!company || !signal) {
        missingSignal++;
        continue;
      }

      const evidence = cleanEvidence(signal.evidence);
      if (!evidence) {
        missingSignal++;
        continue;
      }
      const companyName = String(company.name || "your team").trim();
      const { subject, bodyText } = outreachCopy(
        prospect,
        companyName,
        String(signal.signal_type || ""),
        evidence,
      );
      const draftFingerprint = await fingerprint(`${prospect.id}|${signal.id}|${PROMPT_VERSION}`);
      const { data: draft, error: draftError } = await supabase.from("outreach_drafts").upsert({
        prospect_id: prospect.id,
        signal_id: signal.id,
        source_run_id: run.id,
        subject,
        body_text: bodyText,
        personalization_evidence: [{
          signal_type: signal.signal_type,
          evidence,
          observed_at: signal.observed_at,
        }],
        status: "review",
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
        send_enabled: false,
      },
    }).eq("id", run.id);
    await supabase.from("agent_log").insert({
      agent_name: "phase3-draft-pipeline",
      action: "score_and_draft",
      outcome: "completed",
      decision: { scored, drafted, suppressed, missing_signal: missingSignal, send_enabled: false },
    });
    return Response.json({ scored, drafted, suppressed, missing_signal: missingSignal, send_enabled: false });
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
