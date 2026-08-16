import { getSupabaseAdmin } from "@/lib/server/supabase-admin";

function clean(value, max = 10000) {
  return String(value || "").trim().slice(0, max);
}

async function audit(action, user, decision = {}, prospectId = null, outcome = "completed", error = null) {
  const db = getSupabaseAdmin();
  await db.from("agent_log").insert({
    agent_name: "office",
    action,
    outcome,
    prospect_id: prospectId,
    decision: { ...decision, actor: user.email },
    error,
  });
}

export async function refreshGrowthBrief(user) {
  const db = getSupabaseAdmin();
  const { data, error } = await db.rpc("prepare_growth_brief", { p_brief_date: new Date().toISOString().slice(0, 10) });
  await audit("refresh_growth_brief", user, { result: data, automatic_changes: false }, null, error ? "failed" : "completed", error?.message);
  return { ok: !error, errorCode: error ? "refresh_failed" : undefined };
}

export async function reviewGrowthBrief(user, formData) {
  const id = clean(formData.get("id"), 50);
  const db = getSupabaseAdmin();
  const { error } = await db.from("growth_briefs")
    .update({ status: "accepted", reviewed_at: new Date().toISOString(), reviewed_by: user.email })
    .eq("id", id).eq("status", "review");
  await audit("review_growth_brief", user, { brief_id: id }, null, error ? "failed" : "completed", error?.message);
  return { ok: !error, errorCode: error ? "review_failed" : undefined };
}

export async function prepareGrowthExperiments(user) {
  const db = getSupabaseAdmin();
  const { data, error } = await db.rpc("prepare_growth_experiment_queue");
  await audit("prepare_growth_experiments", user, { result: data, automatic_changes: false }, null, error ? "failed" : "completed", error?.message);
  return { ok: !error, errorCode: error ? "experiment_prepare_failed" : undefined };
}

export async function updateGrowthExperiment(user, formData) {
  const id = clean(formData.get("id"), 50);
  if (!id) return { ok: false, errorCode: "experiment_missing" };

  const db = getSupabaseAdmin();
  const decision = clean(formData.get("decision"), 30);
  const notes = clean(formData.get("notes"), 4000) || null;
  const { data, error } = ["continue", "stop", "adopt", "inconclusive"].includes(decision)
    ? await db.rpc("complete_growth_experiment", { p_experiment_id: id, p_decision: decision, p_notes: notes, p_actor: user.email })
    : await db.rpc("record_growth_experiment_transition", {
      p_experiment_id: id, p_decision: decision, p_actor: user.email,
      p_owner_action: clean(formData.get("owner_action"), 2000) || null, p_notes: notes,
    });
  await audit("update_growth_experiment", user, { experiment_id: id, decision, result: data, automatic_changes: false }, null, error ? "failed" : "completed", error?.message);
  return { ok: !error, errorCode: error ? "experiment_update_failed" : undefined };
}
