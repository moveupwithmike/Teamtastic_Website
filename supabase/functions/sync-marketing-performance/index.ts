import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { authorizeWebhook, errorText, functionError, serviceClient } from "../_shared/runtime.ts";

// Read-only reporting only. Nothing in this file calls a write/mutate
// endpoint on any platform -- matches collectEddieContext()'s existing
// advertising_permissions (can_launch/can_pause/can_change_budget/can_spend
// all false). Each platform is independently try/caught below so one
// platform's failure (or simply not being connected yet) never blocks the
// others -- same isolation principle as generate-daily-voice-brief.

const LOOKBACK_DAYS = 7;
// Current supported major version as of September 2026. Keep this explicit so
// Google Ads can be upgraded independently without changing any permissions.
const GOOGLE_ADS_API_VERSION = "v25";

function snapshotDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// Shared by Google Analytics, Search Console, and Google Ads -- one OAuth
// client with combined read-only scopes, separate from the Calendar
// integration's own client/refresh token (src/lib/server/google-calendar.js
// is the pattern this mirrors; it cannot reuse that client because it's
// scoped to Calendar only).
async function getGoogleMarketingAccessToken(): Promise<string> {
  const clientId = Deno.env.get("GOOGLE_MARKETING_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_MARKETING_CLIENT_SECRET");
  const refreshToken = Deno.env.get("GOOGLE_MARKETING_REFRESH_TOKEN");
  if (!clientId || !clientSecret || !refreshToken) throw new Error("google_marketing_credentials_missing");

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`google_marketing_token_${response.status}`);
  const data = await response.json();
  if (!data.access_token) throw new Error("google_marketing_token_missing");
  return data.access_token;
}

async function syncGoogleAnalytics(): Promise<Record<string, unknown> | null> {
  const propertyId = Deno.env.get("GOOGLE_ANALYTICS_PROPERTY_ID");
  if (!propertyId) return null;

  const accessToken = await getGoogleMarketingAccessToken();
  // Verify the current stable Analytics Data API version before enabling in
  // production -- v1beta has been stable for a long time but re-check.
  const response = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(propertyId)}:runReport`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
      body: JSON.stringify({
        dateRanges: [{ startDate: `${LOOKBACK_DAYS}daysAgo`, endDate: "yesterday" }],
        dimensions: [{ name: "sessionDefaultChannelGroup" }],
        metrics: [{ name: "sessions" }, { name: "conversions" }, { name: "totalUsers" }],
      }),
      signal: AbortSignal.timeout(20_000),
    },
  );
  if (!response.ok) throw new Error(`ga4_report_${response.status}: ${(await response.text()).slice(0, 400)}`);
  const data = await response.json();
  const rows = (data.rows || []).map((row: { dimensionValues?: { value?: string }[]; metricValues?: { value?: string }[] }) => ({
    channel: row.dimensionValues?.[0]?.value || "unknown",
    sessions: Number(row.metricValues?.[0]?.value || 0),
    conversions: Number(row.metricValues?.[1]?.value || 0),
    total_users: Number(row.metricValues?.[2]?.value || 0),
  }));
  return { lookback_days: LOOKBACK_DAYS, channels: rows };
}

async function syncSearchConsole(): Promise<Record<string, unknown> | null> {
  const siteUrl = Deno.env.get("GOOGLE_SEARCH_CONSOLE_SITE_URL");
  if (!siteUrl) return null;

  const accessToken = await getGoogleMarketingAccessToken();
  const end = new Date(Date.now() - 24 * 60 * 60_000).toISOString().slice(0, 10);
  const start = new Date(Date.now() - (LOOKBACK_DAYS + 1) * 24 * 60 * 60_000).toISOString().slice(0, 10);
  const response = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
      body: JSON.stringify({
        startDate: start,
        endDate: end,
        dimensions: ["query"],
        rowLimit: 20,
      }),
      signal: AbortSignal.timeout(20_000),
    },
  );
  if (!response.ok) throw new Error(`search_console_query_${response.status}: ${(await response.text()).slice(0, 400)}`);
  const data = await response.json();
  const rows = (data.rows || []).map((row: { keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number }) => ({
    query: row.keys?.[0] || "unknown",
    clicks: row.clicks || 0,
    impressions: row.impressions || 0,
    ctr: row.ctr || 0,
    position: row.position || 0,
  }));
  return { lookback_days: LOOKBACK_DAYS, top_queries: rows };
}

async function syncGoogleAds(): Promise<Record<string, unknown> | null> {
  const customerId = Deno.env.get("GOOGLE_ADS_CUSTOMER_ID");
  const developerToken = Deno.env.get("GOOGLE_ADS_DEVELOPER_TOKEN");
  if (!customerId || !developerToken) return null;

  const accessToken = await getGoogleMarketingAccessToken();
  // GOOGLE_ADS_LOGIN_CUSTOMER_ID is optional -- only needed when the
  // reporting account is managed under a manager (MCC) account.
  const loginCustomerId = Deno.env.get("GOOGLE_ADS_LOGIN_CUSTOMER_ID");
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "developer-token": developerToken,
    "content-type": "application/json",
  };
  if (loginCustomerId) headers["login-customer-id"] = loginCustomerId;

  const response = await fetch(
    `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${encodeURIComponent(customerId)}/googleAds:search`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        query: `SELECT campaign.name, metrics.cost_micros, metrics.clicks, metrics.conversions, metrics.impressions
                 FROM campaign
                 WHERE segments.date DURING LAST_${LOOKBACK_DAYS}_DAYS
                 ORDER BY metrics.cost_micros DESC
                 LIMIT 20`,
      }),
      signal: AbortSignal.timeout(20_000),
    },
  );
  if (!response.ok) throw new Error(`google_ads_search_${response.status}: ${(await response.text()).slice(0, 400)}`);
  const data = await response.json();
  const campaigns = (data.results || []).map((result: { campaign?: { name?: string }; metrics?: { costMicros?: string; clicks?: string; conversions?: number; impressions?: string } }) => ({
    campaign: result.campaign?.name || "unknown",
    cost_usd: Number(result.metrics?.costMicros || 0) / 1_000_000,
    clicks: Number(result.metrics?.clicks || 0),
    conversions: Number(result.metrics?.conversions || 0),
    impressions: Number(result.metrics?.impressions || 0),
  }));
  return { lookback_days: LOOKBACK_DAYS, campaigns };
}

async function syncMetaAds(): Promise<Record<string, unknown> | null> {
  const adAccountId = Deno.env.get("META_AD_ACCOUNT_ID");
  const accessToken = Deno.env.get("META_MARKETING_ACCESS_TOKEN");
  if (!adAccountId || !accessToken) return null;

  // Long-lived System User token -- no refresh flow needed, unlike Google.
  // Verify the current stable Graph API version before enabling in
  // production.
  const params = new URLSearchParams({
    access_token: accessToken,
    level: "campaign",
    date_preset: `last_${LOOKBACK_DAYS}d`,
    fields: "campaign_name,spend,clicks,impressions,actions",
    limit: "20",
  });
  const response = await fetch(
    `https://graph.facebook.com/v21.0/act_${encodeURIComponent(adAccountId)}/insights?${params.toString()}`,
    { signal: AbortSignal.timeout(20_000) },
  );
  if (!response.ok) throw new Error(`meta_insights_${response.status}: ${(await response.text()).slice(0, 400)}`);
  const data = await response.json();
  const campaigns = (data.data || []).map((row: { campaign_name?: string; spend?: string; clicks?: string; impressions?: string; actions?: { action_type?: string; value?: string }[] }) => ({
    campaign: row.campaign_name || "unknown",
    spend_usd: Number(row.spend || 0),
    clicks: Number(row.clicks || 0),
    impressions: Number(row.impressions || 0),
    results: (row.actions || []).reduce((sum, action) => sum + Number(action.value || 0), 0),
  }));
  return { lookback_days: LOOKBACK_DAYS, campaigns };
}

const PLATFORM_SYNCERS: { platform: string; sync: () => Promise<Record<string, unknown> | null> }[] = [
  { platform: "google_analytics", sync: syncGoogleAnalytics },
  { platform: "google_search_console", sync: syncSearchConsole },
  { platform: "google_ads", sync: syncGoogleAds },
  { platform: "meta_ads", sync: syncMetaAds },
];

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
