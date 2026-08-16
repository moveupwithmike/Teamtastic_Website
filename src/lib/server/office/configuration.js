"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import { requireOfficeUser } from "@/lib/server/office-auth";
import { audit, clean } from "./shared";


export async function updateSystemConfig(formData) {
  const user = await requireOfficeUser();
  const db = getSupabaseAdmin();

  const dailyCapRaw = Number(formData.get("daily_prospecting_cap"));
  const proposalCapRaw = Number(formData.get("daily_proposal_cap"));
  const organicCapRaw = Number(formData.get("organic_daily_opportunity_cap"));
  const organicScoreRaw = Number(formData.get("organic_min_draft_score"));
  const scope = clean(formData.get("settings_scope"), 30);
  const update = scope === "organic" ? {
    organic_reddit_commercial_approval_confirmed: formData.get("organic_reddit_commercial_approval_confirmed") === "on",
    organic_research_enabled: formData.get("organic_reddit_commercial_approval_confirmed") === "on" && formData.get("organic_research_enabled") === "on",
    organic_scoring_enabled: formData.get("organic_scoring_enabled") === "on",
    organic_drafting_enabled: formData.get("organic_drafting_enabled") === "on",
    organic_attribution_enabled: formData.get("organic_attribution_enabled") === "on",
    organic_daily_opportunity_cap: Number.isFinite(organicCapRaw) ? Math.min(250, Math.max(0, Math.round(organicCapRaw))) : 25,
    organic_min_draft_score: Number.isFinite(organicScoreRaw) ? Math.min(100, Math.max(0, Math.round(organicScoreRaw))) : 80,
    updated_by: user.email,
  } : scope === "proposal" ? {
    proposal_email_enabled: formData.get("proposal_email_enabled") === "on",
    daily_proposal_cap: Number.isFinite(proposalCapRaw) ? Math.min(50, Math.max(0, Math.round(proposalCapRaw))) : 10,
    updated_by: user.email,
  } : {
    prospecting_from_email: clean(formData.get("prospecting_from_email"), 320) || null,
    prospecting_enabled: formData.get("prospecting_enabled") === "on",
    daily_prospecting_cap: Number.isFinite(dailyCapRaw) ? Math.min(500, Math.max(0, Math.round(dailyCapRaw))) : 5,
    sequence_followups_enabled: formData.get("sequence_followups_enabled") === "on",
    updated_by: user.email,
  };
  if (scope === "prospecting" && formData.get("resume_sending") === "on") update.outbound_auto_paused = false;

  const { error } = await db.from("system_config").update(update).eq("id", true);
  let sourceError = null;
  if (!error && scope === "organic") {
    const sourceUpdate = await db.from("organic_sources").update({
      enabled: update.organic_reddit_commercial_approval_confirmed && update.organic_research_enabled,
      updated_at: new Date().toISOString(),
    }).eq("source_key", "reddit-approved-api");
    sourceError = sourceUpdate.error;
  }
  await audit("update_system_config", user, update, null, error || sourceError ? "failed" : "completed", error?.message || sourceError?.message);
  if (error || sourceError) redirect("/office/settings?error=settings_save_failed");
  revalidatePath("/office/settings");
  redirect("/office/settings?success=1");
}
