import "server-only";

const GOOGLE_ADS_API_VERSION = "v25";

export class AdvertisingControlError extends Error {
  constructor(code, status = 503) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

function digits(value) {
  const result = String(value || "").replaceAll(/[^0-9]/g, "");
  if (!result) throw new AdvertisingControlError("ad_campaign_mapping_invalid", 409);
  return result;
}

async function providerJson(response, errorCode) {
  const text = await response.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { /* Provider returned a non-JSON error. */ }
  if (!response.ok) {
    console.error("Advertising provider request failed", { code: errorCode, status: response.status });
    throw new AdvertisingControlError(errorCode, response.status >= 500 ? 503 : 409);
  }
  return data;
}

async function googleAccessToken(fetchImpl) {
  const clientId = process.env.GOOGLE_MARKETING_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_MARKETING_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_MARKETING_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) throw new AdvertisingControlError("google_ads_write_not_configured", 409);
  const response = await fetchImpl("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }),
    signal: AbortSignal.timeout(15_000),
  });
  const data = await providerJson(response, "google_ads_token_failed");
  if (!data.access_token) throw new AdvertisingControlError("google_ads_token_failed");
  return data.access_token;
}

async function googleRequest(path, body, fetchImpl) {
  const customerId = digits(process.env.GOOGLE_ADS_CUSTOMER_ID);
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  if (!developerToken) throw new AdvertisingControlError("google_ads_write_not_configured", 409);
  const accessToken = await googleAccessToken(fetchImpl);
  const headers = { authorization: `Bearer ${accessToken}`, "developer-token": developerToken, "content-type": "application/json" };
  if (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID) headers["login-customer-id"] = digits(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID);
  const response = await fetchImpl(`https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${customerId}/${path}`, {
    method: "POST", headers, body: JSON.stringify(body), signal: AbortSignal.timeout(20_000),
  });
  return providerJson(response, "google_ads_change_failed");
}

async function changeGoogle(control, desiredStatus, fetchImpl) {
  const customerId = digits(process.env.GOOGLE_ADS_CUSTOMER_ID);
  const campaignId = digits(control.external_campaign_id);
  if (desiredStatus === "active") {
    const budgetId = digits(control.external_budget_id);
    await googleRequest("campaignBudgets:mutate", {
      operations: [{ update: { resourceName: `customers/${customerId}/campaignBudgets/${budgetId}`, amountMicros: String(control.daily_budget_cents * 10_000) }, updateMask: "amountMicros" }],
    }, fetchImpl);
  }
  await googleRequest("campaigns:mutate", {
    operations: [{ update: { resourceName: `customers/${customerId}/campaigns/${campaignId}`, status: desiredStatus === "active" ? "ENABLED" : "PAUSED" }, updateMask: "status" }],
  }, fetchImpl);
  return { platform: "google_ads", campaign_id: campaignId, status: desiredStatus };
}

function metaConfiguration() {
  const token = process.env.META_MARKETING_ACCESS_TOKEN;
  const version = process.env.META_GRAPH_API_VERSION;
  if (!token || !/^v\d+\.\d+$/.test(version || "")) throw new AdvertisingControlError("meta_ads_write_not_configured", 409);
  return { token, version };
}

async function metaPost(objectId, values, fetchImpl) {
  const { token, version } = metaConfiguration();
  const response = await fetchImpl(`https://graph.facebook.com/${version}/${digits(objectId)}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ ...values, access_token: token }),
    signal: AbortSignal.timeout(20_000),
  });
  return providerJson(response, "meta_ads_change_failed");
}

async function changeMeta(control, desiredStatus, fetchImpl) {
  if (desiredStatus === "active") {
    if (!control.external_budget_id) throw new AdvertisingControlError("ad_campaign_mapping_invalid", 409);
    await metaPost(control.external_budget_id, { daily_budget: String(control.daily_budget_cents), status: "ACTIVE" }, fetchImpl);
  }
  await metaPost(control.external_campaign_id, { status: desiredStatus === "active" ? "ACTIVE" : "PAUSED" }, fetchImpl);
  return { platform: "meta_ads", campaign_id: digits(control.external_campaign_id), status: desiredStatus };
}

export async function changeAdvertisingCampaignStatus(control, desiredStatus, fetchImpl = fetch) {
  if (!control || !["active", "paused"].includes(desiredStatus)) throw new AdvertisingControlError("ad_campaign_change_invalid", 409);
  if (control.platform === "google_ads") return changeGoogle(control, desiredStatus, fetchImpl);
  if (control.platform === "meta_ads") return changeMeta(control, desiredStatus, fetchImpl);
  throw new AdvertisingControlError("ad_platform_not_supported", 409);
}
