import { getSupabaseAdmin } from "@/lib/server/supabase-admin";

export function clean(value, max = 10000) {
  return String(value || "").trim().slice(0, max);
}

export function money(value) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

export async function audit(action, user, decision = {}, prospectId = null, outcome = "completed", error = null) {
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
