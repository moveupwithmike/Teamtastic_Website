import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { authorizeWebhook, errorText, functionError, serviceClient } from "../_shared/runtime.ts";
import { PLATFORM_SYNCERS, snapshotDate } from "../_shared/marketing-performance.ts";

// Read-only reporting only. Nothing in this file calls a write/mutate
// endpoint on any platform -- matches collectEddieContext()'s existing
// advertising_permissions (can_launch/can_pause/can_change_budget/can_spend
// all false). Each platform is independently try/caught below so one
// platform's failure (or simply not being connected yet) never blocks the
// others -- same isolation principle as generate-daily-voice-brief.

Deno.serve(async (request) => {
  const unauthorized = await authorizeWebhook(request, "MARKETING_PERFORMANCE_SYNC_WEBHOOK_SECRET");
  if (unauthorized) return unauthorized;
  const supabase = serviceClient();

  const { data: config, error: configError } = await supabase
    .from("system_config")
    .select("master_enabled,marketing_reporting_sync_enabled")
    .eq("id", true)
    .single();
  if (configError) return functionError("config_query_failed");
  if (!config.master_enabled || !config.marketing_reporting_sync_enabled) {
    return Response.json({ synced: false, skipped: true, reason: "marketing_sync_disabled" });
  }

  const date = snapshotDate();
  const results: Record<string, string> = {};

  for (const { platform, sync } of PLATFORM_SYNCERS) {
    try {
      const metrics = await sync();
      if (metrics === null) {
        results[platform] = "not_connected";
        continue;
      }
      await supabase.from("marketing_performance_snapshots").upsert({
        platform,
        snapshot_date: date,
        metrics,
        fetched_at: new Date().toISOString(),
        error: null,
      }, { onConflict: "platform,snapshot_date" });
      results[platform] = "synced";
    } catch (error) {
      const message = errorText(error);
      console.error(`marketing-performance-sync ${platform} failed:`, message);
      await supabase.from("marketing_performance_snapshots").upsert({
        platform,
        snapshot_date: date,
        metrics: {},
        fetched_at: new Date().toISOString(),
        error: message.slice(0, 1000),
      }, { onConflict: "platform,snapshot_date" });
      results[platform] = "failed";
    }
  }

  return Response.json({ synced: true, snapshot_date: date, results });
});
