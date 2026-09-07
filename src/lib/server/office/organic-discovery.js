import "server-only";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import { requireOfficeUser } from "@/lib/server/office-auth";
import { audit } from "./shared";

const COLLECTOR_FUNCTION = "collect-organic-opportunities";

export function discoveryGateReason(config) {
  if (!config?.master_enabled) return "master_off";
  if (!config?.organic_reddit_commercial_approval_confirmed) return "reddit_commercial_approval_not_confirmed";
  if (!config?.organic_research_enabled) return "discovery_off";
  if (!config?.organic_scoring_enabled) return "scoring_off";
  return null;
}

// Phase 8 delegates collection, filtering, daily caps, deduplication, scoring,
// and review-only drafting to the established authenticated Edge Function.
// Keeping one collector prevents competing Reddit requests and duplicate rows.
/** @param {{ db: any, trigger?: string }} arg */
export async function runOrganicDiscovery(arg) {
  const { db, trigger = "office" } = arg;
  const configResult = await db.from("system_config")
    .select("master_enabled,organic_reddit_commercial_approval_confirmed,organic_research_enabled,organic_scoring_enabled")
    .eq("id", true).maybeSingle();
  if (configResult.error || !configResult.data) {
    return { enabled: false, reason: "discovery_config_unavailable" };
  }

  const gateReason = discoveryGateReason(configResult.data);
  if (gateReason) return { enabled: false, reason: gateReason, status: "skipped" };

  const { data, error } = await db.functions.invoke(COLLECTOR_FUNCTION, {
    body: { trigger, requested_by: "teamtastic-office" },
  });
  if (error || data?.error) {
    return { enabled: false, reason: "discovery_failed", status: "failed" };
  }
  if (data?.skipped) {
    return {
      enabled: false,
      reason: data.reason || "discovery_skipped",
      status: "skipped",
      records_scanned: Number(data.scanned || 0),
      records_created: Number(data.created || 0),
    };
  }
  return {
    enabled: true,
    status: "completed",
    records_scanned: Number(data?.scanned || 0),
    records_created: Number(data?.created || 0),
    duplicates: Number(data?.duplicates || 0),
    filtered: Number(data?.filtered || 0),
  };
}

export async function runOrganicDiscoveryAction() {
  const user = await requireOfficeUser();
  const db = getSupabaseAdmin();
  const result = await runOrganicDiscovery({ db, trigger: "office" });
  const failed = result.reason === "discovery_failed" || result.reason === "discovery_config_unavailable";
  await audit("run_organic_discovery", user, { ...result, automatic_publishing: false }, null, failed ? "failed" : "completed", failed ? result.reason : null);
  revalidatePath("/office/organic");
  if (failed) return redirect("/office/organic?error=discovery_failed");
  if (!result.enabled) return redirect(`/office/organic?success=discovery:${result.reason}`);
  return redirect(`/office/organic?success=discovery_completed:${result.records_created}`);
}
