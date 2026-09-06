import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { authorizeServiceRole, authorizeWebhook, errorText, functionError, serviceClient } from "../_shared/runtime.ts";

const GOOGLE_ADS_API_VERSION = "v25";
const EASTERN_TIME_ZONE = "America/New_York";

type CampaignControl = {
  id: string;
  platform: "google_ads" | "meta_ads";
  external_campaign_id: string;
  external_budget_id: string | null;
  status: "active";
  hard_daily_cap_cents: number;
  auto_pause_at: string | null;
};

function digits(value: string | undefined | null) {
  const result = String(value || "").replaceAll(/[^0-9]/g, "");
  if (!result) throw new Error("campaign_mapping_invalid");
  return result;
}

function easternDate() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: EASTERN_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

async function responseJson(response: Response, code: string) {
  const text = await response.text();
  if (!response.ok) throw new Error(`${code}_${response.status}`);
  try { return text ? JSON.parse(text) : {}; } catch { return {}; }
}

async function googleAccessToken() {
  const clientId = Deno.env.get("GOOGLE_MARKETING_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_MARKETING_CLIENT_SECRET");
  const refreshToken = Deno.env.get("GOOGLE_MARKETING_REFRESH_TOKEN");
  if (!clientId || !clientSecret || !refreshToken) throw new Error("google_credentials_missing");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }),
    signal: AbortSignal.timeout(15_000),
  });
  const data = await responseJson(response, "google_token");
  if (!data.access_token) throw new Error("google_token_missing");
  return String(data.access_token);
}

async function googleRequest(path: string, body: Record<string, unknown>) {
  const customerId = digits(Deno.env.get("GOOGLE_ADS_CUSTOMER_ID"));
  const developerToken = Deno.env.get("GOOGLE_ADS_DEVELOPER_TOKEN");
  if (!developerToken) throw new Error("google_developer_token_missing");
  const headers: Record<string, string> = {
    authorization: `Bearer ${await googleAccessToken()}`,
    "developer-token": developerToken,
    "content-type": "application/json",
  };
  const loginId = Deno.env.get("GOOGLE_ADS_LOGIN_CUSTOMER_ID");
  if (loginId) headers["login-customer-id"] = digits(loginId);
  return responseJson(await fetch(`https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${customerId}/${path}`, {
    method: "POST", headers, body: JSON.stringify(body), signal: AbortSignal.timeout(20_000),
  }), "google_ads");
}

async function googleSpendCents(control: CampaignControl) {
  const campaignId = digits(control.external_campaign_id);
  const data = await googleRequest("googleAds:search", {
    query: `SELECT metrics.cost_micros FROM campaign WHERE campaign.id = ${campaignId} AND segments.date = '${easternDate()}' LIMIT 1`,
  });
  return Math.max(0, Math.round(Number(data.results?.[0]?.metrics?.costMicros || 0) / 10_000));
}

async function pauseGoogle(control: CampaignControl) {
  const customerId = digits(Deno.env.get("GOOGLE_ADS_CUSTOMER_ID"));
  await googleRequest("campaigns:mutate", { operations: [{ update: { resourceName: `customers/${customerId}/campaigns/${digits(control.external_campaign_id)}`, status: "PAUSED" }, updateMask: "status" }] });
}

function metaConfig() {
  const token = Deno.env.get("META_MARKETING_ACCESS_TOKEN");
  const version = Deno.env.get("META_GRAPH_API_VERSION");
  if (!token || !/^v\d+\.\d+$/.test(version || "")) throw new Error("meta_credentials_missing");
  return { token, version: String(version) };
}

async function metaSpendCents(control: CampaignControl) {
  const { token, version } = metaConfig();
  const params = new URLSearchParams({ access_token: token, date_preset: "today", fields: "spend", limit: "1" });
  const data = await responseJson(await fetch(`https://graph.facebook.com/${version}/${digits(control.external_campaign_id)}/insights?${params.toString()}`, { signal: AbortSignal.timeout(20_000) }), "meta_insights");
  return Math.max(0, Math.round(Number(data.data?.[0]?.spend || 0) * 100));
}

async function pauseMeta(control: CampaignControl) {
  const { token, version } = metaConfig();
  await responseJson(await fetch(`https://graph.facebook.com/${version}/${digits(control.external_campaign_id)}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ status: "PAUSED", access_token: token }),
    signal: AbortSignal.timeout(20_000),
  }), "meta_pause");
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!(await authorizeServiceRole(request))) {
    const unauthorized = await authorizeWebhook(request, "ADVERTISING_SAFETY_WEBHOOK_SECRET");
    if (unauthorized) return unauthorized;
  }

  const supabase = serviceClient();
  const { data: config, error: configError } = await supabase.from("system_config")
    .select("advertising_master_enabled,advertising_safety_monitor_enabled,google_ads_write_enabled,meta_ads_write_enabled")
    .eq("id", true).single();
  if (configError) return functionError("config_query_failed");
  if (!config.advertising_safety_monitor_enabled) return Response.json({ checked: false, reason: "safety_monitor_disabled" });

  const { data, error } = await supabase.from("advertising_campaign_controls").select("id,platform,external_campaign_id,external_budget_id,status,hard_daily_cap_cents,auto_pause_at").eq("status", "active");
  if (error) return functionError("campaign_query_failed");

  const outcomes: Record<string, string> = {};
  for (const control of (data || []) as CampaignControl[]) {
    try {
      const platformEnabled = control.platform === "google_ads" ? config.google_ads_write_enabled : config.meta_ads_write_enabled;
      const due = Boolean(control.auto_pause_at && new Date(control.auto_pause_at).getTime() <= Date.now());
      let spendCents = 0;
      let trackingFailed = false;
      try {
        spendCents = control.platform === "google_ads" ? await googleSpendCents(control) : await metaSpendCents(control);
      } catch {
        trackingFailed = true;
      }
      await supabase.from("advertising_campaign_controls").update({ spend_date: easternDate(), today_spend_cents: spendCents }).eq("id", control.id);
      const mustPause = !config.advertising_master_enabled || !platformEnabled || due || trackingFailed || spendCents >= control.hard_daily_cap_cents;
      if (!mustPause) {
        outcomes[control.id] = "within_limits";
        continue;
      }
      if (control.platform === "google_ads") await pauseGoogle(control); else await pauseMeta(control);
      await supabase.from("advertising_campaign_controls").update({ status: "paused", auto_pause_at: null, provider_updated_at: new Date().toISOString(), last_error: trackingFailed ? "tracking_failed_fail_safe_pause" : null }).eq("id", control.id);
      outcomes[control.id] = trackingFailed ? "paused_tracking_failed" : due ? "paused_end_of_day" : spendCents >= control.hard_daily_cap_cents ? "paused_daily_cap" : "paused_master_switch";
    } catch (failure) {
      const message = errorText(failure).slice(0, 500);
      await supabase.from("advertising_campaign_controls").update({ last_error: message }).eq("id", control.id);
      outcomes[control.id] = "pause_failed";
    }
  }

  return Response.json({ checked: true, outcomes });
});

