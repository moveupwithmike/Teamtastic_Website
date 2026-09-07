import "server-only";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import { requireOfficeUser } from "@/lib/server/office-auth";
import { buildMorningProposals, easternGenerationDate } from "./social-generator";
import { runOrganicDiscovery } from "./organic-discovery";
import { rollSocialMeasurementSnapshot } from "./social-measurement";
import { audit } from "./shared";

const DISTRIBUTION_PATH = "/office/distribution";

export function isAutopilotGateEnabled(config) {
  return Boolean(config?.master_enabled && config?.desk_autopilot_enabled);
}

// Runs the review-only daily loop: morning generator, Reddit conversation
// discovery, and the measurement roll. Each step is independently gated and
// idempotent; the switch only gates the scheduled (vercel_cron) trigger, so an
// owner running "Run all steps now" can exercise the loop before enabling it.
export async function runDailyAutopilot({ db, now = new Date(), trigger = "office" }) {
  const generationDate = easternGenerationDate(now);
  const configResult = await db.from("system_config").select("master_enabled,desk_autopilot_enabled").eq("id", true).maybeSingle();
  if (configResult.error) return { enabled: false, reason: "autopilot_config_unavailable" };
  if (!configResult.data?.master_enabled) {
    return { enabled: false, reason: "master_off" };
  }
  if (trigger === "vercel_cron" && !isAutopilotGateEnabled(configResult.data)) {
    return { enabled: false, reason: "autopilot_off" };
  }

  const existingResult = await db.from("autopilot_runs").select("id,status").eq("generation_date", generationDate).maybeSingle();
  if (existingResult.error) return { enabled: false, reason: "autopilot_lookup_failed" };
  if (existingResult.data && ["running", "completed"].includes(existingResult.data.status)) {
    return { enabled: true, skipped: true, reason: "already_ran", generation_date: generationDate, status: existingResult.data.status };
  }

  const { data: runRow, error: startError } = await db.from("autopilot_runs")
    .insert({ trigger, generation_date: generationDate, status: "running", steps: {} })
    .select("id,generation_date").single();
  if (startError || !runRow) return { enabled: false, reason: "autopilot_start_failed" };

  const steps = [];
  const generator = await guardedStep("morning_generator", () => buildMorningProposals({ db, now, trigger }));
  steps.push(generator);
  const discovery = await guardedStep("discovery", () => runOrganicDiscovery({ db, trigger }));
  steps.push(discovery);
  const measurement = await guardedStep("measurement", () => rollSocialMeasurementSnapshot({ db, date: String(runRow.generation_date) }));
  steps.push(measurement);

  const failed = steps.some((step) => step.error);
  const gated = steps.filter((step) => !step.error && step.enabled === false).map((s) => s.step);
  const status = failed ? "failed" : "completed";

  const { error: finalizeError } = await db.from("autopilot_runs")
    .update({ status, steps, completed_at: new Date().toISOString() }).eq("id", runRow.id);
  if (finalizeError) {
    return {
      enabled: true,
      generation_date: generationDate,
      status: "failed",
      reason: "autopilot_finalize_failed",
      steps,
      gated,
    };
  }

  return {
    enabled: true,
    generation_date: generationDate,
    status,
    steps,
    gated,
  };
}

async function guardedStep(name, run) {
  try {
    return { step: name, ...(await run()) };
  } catch (error) {
    return { step: name, error: error?.message || `${name}_failed` };
  }
}

export async function toggleOfficeAutopilot(formData) {
  const user = await requireOfficeUser();
  const enabled = formData.get("enabled") === "on";
  const db = getSupabaseAdmin();
  const { error } = await db.from("system_config")
    .update({ desk_autopilot_enabled: enabled, updated_at: new Date().toISOString() }).eq("id", true);
  await audit("toggle_office_autopilot", user, { enabled, automatic_publishing: false }, null, error ? "failed" : "completed", error ? "autopilot_switch_failed" : null);
  revalidatePath(DISTRIBUTION_PATH);
  return redirect(error
    ? `${DISTRIBUTION_PATH}?error=autopilot_switch_failed`
    : `${DISTRIBUTION_PATH}?success=${enabled ? "autopilot_on" : "autopilot_off"}`);
}

export async function runOfficeAutopilot() {
  const user = await requireOfficeUser();
  const result = await runDailyAutopilot({ db: getSupabaseAdmin(), now: new Date(), trigger: "office" });
  const failed = result.enabled === false;
  await audit("run_office_autopilot", user, { ...result, automatic_publishing: false }, null, failed ? "failed" : "completed", failed ? result.reason : null);
  revalidatePath(DISTRIBUTION_PATH);
  if (failed) return redirect(`${DISTRIBUTION_PATH}?error=autopilot_failed`);
  return redirect(`${DISTRIBUTION_PATH}?success=autopilot:${result.skipped ? "skipped" : result.status}`);
}
