// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const originalEnv = { ...process.env };

function ok(body = {}) {
  return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } }));
}

describe("protected advertising provider controls", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = {
      ...originalEnv,
      GOOGLE_MARKETING_CLIENT_ID: "client",
      GOOGLE_MARKETING_CLIENT_SECRET: "secret",
      GOOGLE_MARKETING_REFRESH_TOKEN: "refresh",
      GOOGLE_ADS_CUSTOMER_ID: "123-456-7890",
      GOOGLE_ADS_DEVELOPER_TOKEN: "developer",
      META_MARKETING_ACCESS_TOKEN: "meta-token",
      META_GRAPH_API_VERSION: "v25.0",
    };
  });

  afterEach(() => { process.env = { ...originalEnv }; });

  it("sets the fixed Google budget before enabling the exact mapped campaign", async () => {
    const fetchImpl = vi.fn((url, _options = {}) => url.includes("oauth2.googleapis.com") ? ok({ access_token: "access" }) : ok({ results: [{}] }));
    const { changeAdvertisingCampaignStatus } = await import("./advertising-controls");
    const result = await changeAdvertisingCampaignStatus({ platform: "google_ads", external_campaign_id: "222", external_budget_id: "333", daily_budget_cents: 1000 }, "active", fetchImpl);

    expect(result).toMatchObject({ platform: "google_ads", campaign_id: "222", status: "active" });
    expect(fetchImpl).toHaveBeenCalledTimes(4);
    const budgetCall = fetchImpl.mock.calls[1];
    expect(budgetCall?.[0]).toContain("campaignBudgets:mutate");
    expect(JSON.parse(budgetCall?.[1]?.body).operations[0].update.amountMicros).toBe("10000000");
    const campaignCall = fetchImpl.mock.calls[3];
    expect(JSON.parse(campaignCall?.[1]?.body).operations[0].update.status).toBe("ENABLED");
  });

  it("pauses Google without changing its budget", async () => {
    const fetchImpl = vi.fn((url, _options = {}) => url.includes("oauth2.googleapis.com") ? ok({ access_token: "access" }) : ok({ results: [{}] }));
    const { changeAdvertisingCampaignStatus } = await import("./advertising-controls");
    await changeAdvertisingCampaignStatus({ platform: "google_ads", external_campaign_id: "222", external_budget_id: "333", daily_budget_cents: 1000 }, "paused", fetchImpl);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[1][0]).toContain("campaigns:mutate");
  });

  it("sets the Meta ad-set budget before activating the campaign", async () => {
    const fetchImpl = vi.fn((_url, _options = {}) => ok({ success: true }));
    const { changeAdvertisingCampaignStatus } = await import("./advertising-controls");
    await changeAdvertisingCampaignStatus({ platform: "meta_ads", external_campaign_id: "444", external_budget_id: "555", daily_budget_cents: 1000 }, "active", fetchImpl);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[0]?.[0]).toContain("/555");
    expect(fetchImpl.mock.calls[0]?.[1]?.body.get("daily_budget")).toBe("1000");
    expect(fetchImpl.mock.calls[1]?.[1]?.body.get("status")).toBe("ACTIVE");
  });

  it("fails closed when a Meta write version was not explicitly configured", async () => {
    delete process.env.META_GRAPH_API_VERSION;
    const { changeAdvertisingCampaignStatus } = await import("./advertising-controls");
    await expect(changeAdvertisingCampaignStatus({ platform: "meta_ads", external_campaign_id: "444", external_budget_id: "555", daily_budget_cents: 1000 }, "active", vi.fn()))
      .rejects.toMatchObject({ code: "meta_ads_write_not_configured" });
  });
});
