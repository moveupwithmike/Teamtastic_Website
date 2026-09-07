// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseAdminMock } from "@/test/supabase-admin-mock";

vi.mock("server-only", () => ({}));

const getSupabaseAdmin = vi.fn();
vi.mock("@/lib/server/supabase-admin", () => ({ getSupabaseAdmin: () => getSupabaseAdmin() }));

const createSalesResponseDraft = vi.fn();
const approveAndSendSalesResponse = vi.fn();
vi.mock("./sales-response", () => ({
  createSalesResponseDraft: (...args) => createSalesResponseDraft(...args),
  approveAndSendSalesResponse: (...args) => approveAndSendSalesResponse(...args),
}));

const USER = { id: "owner_1", email: "michael@teamtastic.com" };
const originalEnv = { ...process.env };

function baseTables(overrides = {}) {
  return {
    daily_reports: { data: { report_date: "2026-09-05", summary: { leads: 2 }, transcript: "Two leads need attention." }, error: null },
    prospects: { data: [{ id: "p1", full_name: "Jordan Rivera", email: "jordan@example.com", status: "new", score: 88 }], error: null },
    leads: { data: [{ id: "l1", prospect_id: "p1", name: "Jordan Rivera", email: "jordan@example.com", lead_score: 88 }], error: null },
    tasks: { data: [], error: null },
    sales_response_drafts: { data: [], error: null },
    deals: { data: [], error: null },
    messages: { data: [], error: null },
    production_incidents: { data: [], error: null },
    marketing_recommendations: { data: [], error: null },
    growth_experiments: { data: [], error: null },
    marketing_asset_drafts: { data: [], error: null },
    advertising_campaign_controls: { data: [], error: null },
    system_config: { data: {
      advertising_master_enabled: false,
      advertising_safety_monitor_enabled: false,
      google_ads_write_enabled: false,
      meta_ads_write_enabled: false,
      google_ads_daily_cap_cents: 1500,
      meta_ads_daily_cap_cents: 1000,
      sales_reporting_since: null,
    }, error: null },
    production_record_classification_status: { data: [
      { record_type: "prospect", record_id: "p1", classification: "production", classified_at: null },
      { record_type: "lead", record_id: "l1", classification: "production", classified_at: null },
    ], error: null },
    launch_readiness_snapshots: { data: { status: "ready", blocker_count: 0, warning_count: 0, checks: [], created_at: "2026-09-05T12:00:00Z" }, error: null },
    agent_log: { data: null, error: null },
    ...overrides,
  };
}

function modelResponse(input) {
  return Promise.resolve(new Response(JSON.stringify({
    content: [{ type: "tool_use", name: "respond_to_owner", input }],
  }), { status: 200, headers: { "content-type": "application/json" } }));
}

describe("Eddie conversation", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv, VERCEL_OIDC_TOKEN: "oidc_test", SUPABASE_SERVICE_ROLE_KEY: "signing_test" };
    getSupabaseAdmin.mockReset();
    createSalesResponseDraft.mockReset();
    approveAndSendSalesResponse.mockReset();
  });

  afterEach(() => { process.env = { ...originalEnv }; });

  it("answers from bounded live context without preparing a write", async () => {
    const db = createSupabaseAdminMock({ tables: baseTables() });
    const fetchImpl = vi.fn((_url, _options) => modelResponse({ answer: "Jordan is the highest-scoring lead at 88.", action_type: "none" }));
    const { askEddie } = await import("./eddie");

    const result = await askEddie({ db, user: USER, messages: [{ role: "user", content: "Who is hottest?" }], fetchImpl });

    expect(result).toEqual({ message: "Jordan is the highest-scoring lead at 88.", pendingAction: null });
    const request = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(request.tool_choice).toEqual({ type: "tool", name: "respond_to_owner" });
    expect(request.system).toContain("SALES_ENGINE_DATA");
    expect(request.system).toContain("Jordan Rivera");
  });

  it("keeps pre-baseline and non-production sales records out of Eddie's context", async () => {
    const db = createSupabaseAdminMock({ tables: baseTables({
      daily_reports: { data: { report_date: "2026-09-06", transcript: "Old fake pipeline report.", sent_at: "2026-09-06T12:00:00Z" }, error: null },
      prospects: { data: [
        { id: "p-old", full_name: "Old Test Prospect", created_at: "2026-09-06T12:00:00Z" },
        { id: "p-live", full_name: "New Live Prospect", created_at: "2026-09-07T16:01:00Z" },
      ], error: null },
      leads: { data: [
        { id: "l-test", prospect_id: "p-old", name: "Fake Lead", created_at: "2026-09-06T12:00:00Z", context: {} },
        { id: "l-live", prospect_id: "p-live", name: "Real Lead", created_at: "2026-09-07T16:02:00Z", context: {} },
      ], error: null },
      tasks: { data: [
        { id: "t-launch", title: "B2B launch readiness status", source: "launch_watchlist", created_at: "2026-09-07T16:03:00Z" },
        { id: "t-test", title: "Fake task", source: "eddie", created_at: "2026-09-07T16:03:00Z" },
      ], error: null },
      deals: { data: [
        { id: "d-test", title: "Fake deal", created_at: "2026-09-07T16:03:00Z" },
      ], error: null },
      system_config: { data: {
        advertising_master_enabled: false, advertising_safety_monitor_enabled: false,
        google_ads_write_enabled: false, meta_ads_write_enabled: false,
        google_ads_daily_cap_cents: 1500, meta_ads_daily_cap_cents: 1000,
        sales_reporting_since: "2026-09-07T16:00:00Z",
      }, error: null },
      production_record_classification_status: { data: [
        { record_type: "prospect", record_id: "p-old", classification: "test_qa", classified_at: "2026-09-07T16:00:00Z" },
        { record_type: "prospect", record_id: "p-live", classification: "production", classified_at: null },
        { record_type: "lead", record_id: "l-test", classification: "test_qa", classified_at: "2026-09-07T16:00:00Z" },
        { record_type: "lead", record_id: "l-live", classification: "production", classified_at: null },
        { record_type: "task", record_id: "t-launch", classification: "production", classified_at: null },
        { record_type: "task", record_id: "t-test", classification: "test_qa", classified_at: "2026-09-07T16:00:00Z" },
        { record_type: "deal", record_id: "d-test", classification: "certification", classified_at: null },
      ], error: null },
      launch_readiness_snapshots: { data: { status: "blocked", blocker_count: 1, warning_count: 0, checks: [{ key: "final_certification", blocking: true }] }, error: null },
    }) });
    const { collectEddieContext } = await import("./eddie");

    const context = await collectEddieContext(db);

    expect(context.reporting_baseline).toBe("2026-09-07T16:00:00Z");
    expect(context.latest_report).toBeNull();
    expect(context.prospects.map((row) => row.id)).toEqual(["p-live"]);
    expect(context.leads.map((row) => row.id)).toEqual(["l-live"]);
    expect(context.open_tasks).toEqual([]);
    expect(context.open_deals).toEqual([]);
    expect(context.launch_readiness).toMatchObject({ status: "blocked", blocker_count: 1 });
  });

  it("uses Vercel's runtime OIDC request token when no static gateway key exists", async () => {
    delete process.env.AI_GATEWAY_API_KEY;
    delete process.env.VERCEL_OIDC_TOKEN;
    const db = createSupabaseAdminMock({ tables: baseTables() });
    const fetchImpl = vi.fn((_url, options) => {
      expect(options.headers.authorization).toBe("Bearer runtime_oidc_test");
      return modelResponse({ answer: "Eddie is connected.", action_type: "none" });
    });
    const { askEddie } = await import("./eddie");

    await expect(askEddie({
      db,
      user: USER,
      messages: [{ role: "user", content: "Are you connected?" }],
      fetchImpl,
      gatewayToken: "runtime_oidc_test",
    })).resolves.toMatchObject({ message: "Eddie is connected." });
  });

  it("prepares but does not execute a task until the signed token is confirmed", async () => {
    const taskInserts = [];
    const receiptUpdates = [];
    let storedReceipt = null;
    const db = createSupabaseAdminMock({ tables: baseTables({
      prospects: ({ calls }) => calls.some((call) => call.method === "eq")
        ? { data: { id: "p1", full_name: "Jordan Rivera", email: "jordan@example.com", status: "new" }, error: null }
        : { data: [{ id: "p1", full_name: "Jordan Rivera", email: "jordan@example.com", status: "new", score: 88 }], error: null },
      tasks: ({ calls }) => {
        const insert = calls.find((call) => call.method === "insert");
        if (insert) {
          taskInserts.push(insert.args[0]);
          return { data: { id: "t1", ...insert.args[0] }, error: null };
        }
        return { data: [], error: null };
      },
      eddie_action_receipts: ({ calls }) => {
        const insert = calls.find((call) => call.method === "insert");
        if (insert) {
          if (storedReceipt) return { data: null, error: { code: "23505" } };
          storedReceipt = insert.args[0];
          return { data: null, error: null };
        }
        const update = calls.find((call) => call.method === "update");
        if (update) {
          receiptUpdates.push(update.args[0]);
          storedReceipt = { ...storedReceipt, ...update.args[0] };
          return { data: null, error: null };
        }
        return { data: storedReceipt, error: null };
      },
    }) });
    getSupabaseAdmin.mockReturnValue(db);
    const fetchImpl = vi.fn(() => modelResponse({
      answer: "I can prepare that follow-up.", action_type: "create_task", target_id: "p1",
      title: "Call Jordan", description: "Discuss the family game-show date.", priority: "high", due_at: "2026-09-06T14:00:00.000Z",
    }));
    const { askEddie, executeEddieAction } = await import("./eddie");

    const proposed = await askEddie({ db, user: USER, messages: [{ role: "user", content: "Create a task to call Jordan tomorrow." }], fetchImpl });
    expect(proposed.pendingAction.title).toBe("Create a sales task");
    expect(taskInserts).toHaveLength(0);

    const completed = await executeEddieAction({ db, user: USER, token: proposed.pendingAction.token });
    expect(completed.message).toContain("I created the task");
    expect(taskInserts).toHaveLength(1);
    expect(taskInserts[0]).toMatchObject({ prospect_id: "p1", title: "Call Jordan", priority: "high", source: "eddie" });
    expect(receiptUpdates).toContainEqual(expect.objectContaining({ status: "completed" }));

    const replay = await executeEddieAction({ db, user: USER, token: proposed.pendingAction.token });
    expect(replay.replayed).toBe(true);
    expect(taskInserts).toHaveLength(1);
  });

  it("rejects a changed confirmation token before touching the database", async () => {
    const db = createSupabaseAdminMock({ tables: baseTables() });
    const { executeEddieAction } = await import("./eddie");
    await expect(executeEddieAction({ db, user: USER, token: "changed.signature" })).rejects.toMatchObject({ code: "invalid_confirmation" });
    expect(db.from).not.toHaveBeenCalled();
  });

  it("stops an email when the draft changed after the owner reviewed it", async () => {
    let directDraftReads = 0;
    const receiptUpdates = [];
    const db = createSupabaseAdminMock({ tables: baseTables({
      sales_response_drafts: ({ calls }) => {
        if (!calls.some((call) => call.method === "eq")) return { data: [], error: null };
        directDraftReads += 1;
        return { data: {
          id: "d1", recipient_email: "jordan@example.com", subject: "Your event",
          body_text: directDraftReads === 1 ? "Original reviewed body" : "Body changed later",
          status: "draft", updated_at: directDraftReads === 1 ? "2026-09-05T12:00:00Z" : "2026-09-05T12:01:00Z",
        }, error: null };
      },
      eddie_action_receipts: ({ calls }) => {
        const update = calls.find((call) => call.method === "update");
        if (update) receiptUpdates.push(update.args[0]);
        return { data: null, error: null };
      },
    }) });
    getSupabaseAdmin.mockReturnValue(db);
    const fetchImpl = vi.fn(() => modelResponse({ answer: "The draft is ready.", action_type: "send_response_draft", target_id: "d1" }));
    const { askEddie, executeEddieAction } = await import("./eddie");

    const proposed = await askEddie({ db, user: USER, messages: [{ role: "user", content: "Send Jordan's existing draft." }], fetchImpl });
    await expect(executeEddieAction({ db, user: USER, token: proposed.pendingAction.token }))
      .rejects.toMatchObject({ code: "draft_changed_since_confirmation" });
    expect(approveAndSendSalesResponse).not.toHaveBeenCalled();
    expect(receiptUpdates).toContainEqual(expect.objectContaining({ status: "failed", error: "draft_changed_since_confirmation" }));
  });

  it("requires confirmation and never launches an approved advertising recommendation", async () => {
    const recommendation = {
      id: "r1", recommendation_type: "advertising", title: "Test family-reunion demand",
      target_customer: "Family reunion planners", occasion: "Family reunion",
      platform: "Google Ads — recommendation only", suggested_daily_budget_cents: 1500, test_days: 14,
      proposed_keywords: ["virtual family reunion games"], proposed_audience: "Active searchers",
      advertisement_text: "Bring the whole family together.", creative_brief: "A real family game moment.",
      landing_page: "/virtual-family-reunion-game-show", expected_result: "Establish a baseline.",
      reason: "The dedicated landing page is live.", evidence: {}, status: "approved", updated_at: "2026-09-05T12:00:00Z",
    };
    const assetInserts = [];
    let receipt = null;
    const db = createSupabaseAdminMock({ tables: baseTables({
      marketing_recommendations: ({ calls }) => {
        if (calls.some((call) => call.method === "update")) return { data: null, error: null };
        if (calls.some((call) => call.method === "eq")) return { data: recommendation, error: null };
        return { data: [recommendation], error: null };
      },
      marketing_asset_drafts: ({ calls }) => {
        const insert = calls.find((call) => call.method === "insert");
        if (!insert) return { data: [], error: null };
        assetInserts.push(insert.args[0]);
        return { data: { id: "a1", ...insert.args[0], status: "draft" }, error: null };
      },
      eddie_action_receipts: ({ calls }) => {
        const insert = calls.find((call) => call.method === "insert");
        if (insert) { receipt = insert.args[0]; return { data: null, error: null }; }
        const update = calls.find((call) => call.method === "update");
        if (update) receipt = { ...receipt, ...update.args[0] };
        return { data: receipt, error: null };
      },
    }) });
    getSupabaseAdmin.mockReturnValue(db);
    const fetchImpl = vi.fn(() => modelResponse({ answer: "I can prepare that campaign for review.", action_type: "prepare_ad_campaign", target_id: "r1" }));
    const { askEddie, executeEddieAction } = await import("./eddie");

    const proposed = await askEddie({ db, user: USER, messages: [{ role: "user", content: "Prepare the approved family-reunion campaign." }], fetchImpl });
    expect(proposed.pendingAction.details.join(" ")).toContain("$15.00 per day");
    expect(assetInserts).toHaveLength(0);

    const completed = await executeEddieAction({ db, user: USER, token: proposed.pendingAction.token });
    expect(completed.message).toContain("Nothing was published, launched, or funded");
    expect(assetInserts).toHaveLength(1);
    expect(assetInserts[0]).toMatchObject({ draft_type: "advertising_campaign", recommendation_id: "r1" });
  });

  it("blocks campaign preparation until the owner approves the recommendation", async () => {
    const recommendation = {
      id: "r-proposed", recommendation_type: "advertising", title: "Proposed family campaign",
      target_customer: "Family reunion planners", occasion: "Family reunion",
      platform: "Google Ads — recommendation only", suggested_daily_budget_cents: 1500, test_days: 14,
      proposed_keywords: ["virtual family reunion games"], proposed_audience: "Active searchers",
      advertisement_text: "Bring the whole family together.", creative_brief: "A real family game moment.",
      landing_page: "/virtual-family-reunion-game-show", expected_result: "Establish a baseline.",
      reason: "Measure demand safely.", evidence: {}, status: "proposed", updated_at: "2026-09-05T12:00:00Z",
    };
    const assetInserts = [];
    const db = createSupabaseAdminMock({ tables: baseTables({
      marketing_recommendations: ({ calls }) => calls.some((call) => call.method === "eq")
        ? { data: recommendation, error: null }
        : { data: [recommendation], error: null },
      marketing_asset_drafts: ({ calls }) => {
        const insert = calls.find((call) => call.method === "insert");
        if (insert) assetInserts.push(insert.args[0]);
        return { data: [], error: null };
      },
    }) });
    const fetchImpl = vi.fn(() => modelResponse({ answer: "I can prepare that campaign.", action_type: "prepare_ad_campaign", target_id: "r-proposed" }));
    const { askEddie } = await import("./eddie");

    const result = await askEddie({ db, user: USER, messages: [{ role: "user", content: "Prepare the proposed family campaign." }], fetchImpl });
    expect(result.pendingAction).toBeNull();
    expect(result.message).toContain("couldn't safely prepare that action");
    expect(assetInserts).toHaveLength(0);
  });

  it("shows exact spend controls and changes only the confirmed mapped Google campaign", async () => {
    process.env.GOOGLE_MARKETING_CLIENT_ID = "client";
    process.env.GOOGLE_MARKETING_CLIENT_SECRET = "secret";
    process.env.GOOGLE_MARKETING_REFRESH_TOKEN = "refresh";
    process.env.GOOGLE_ADS_CUSTOMER_ID = "1234567890";
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN = "developer";
    const control = {
      id: "c1", platform: "google_ads", name: "Family Reunion Search",
      external_campaign_id: "222", external_budget_id: "333", status: "paused",
      daily_budget_cents: 1000, hard_daily_cap_cents: 1500, currency: "USD",
      time_zone: "America/New_York", write_enabled: true, auto_pause_at: null,
      spend_date: "2026-09-06", today_spend_cents: 0, updated_at: "2026-09-06T13:00:00Z",
    };
    const enabledConfig = {
      advertising_master_enabled: true, advertising_safety_monitor_enabled: true,
      google_ads_write_enabled: true, meta_ads_write_enabled: false,
      google_ads_daily_cap_cents: 1500, meta_ads_daily_cap_cents: 1000,
    };
    let receipt = null;
    const requests = [];
    const controlUpdates = [];
    const db = createSupabaseAdminMock({ tables: baseTables({
      advertising_campaign_controls: ({ calls }) => {
        const update = calls.find((call) => call.method === "update");
        if (update) {
          controlUpdates.push(update.args[0]);
          return { data: { ...control, ...update.args[0] }, error: null };
        }
        return calls.some((call) => call.method === "eq") ? { data: control, error: null } : { data: [control], error: null };
      },
      system_config: { data: enabledConfig, error: null },
      advertising_control_requests: ({ calls }) => {
        const insert = calls.find((call) => call.method === "insert");
        if (insert) { requests.push(insert.args[0]); return { data: { id: "q1" }, error: null }; }
        return { data: null, error: null };
      },
      eddie_action_receipts: ({ calls }) => {
        const insert = calls.find((call) => call.method === "insert");
        if (insert) { receipt = insert.args[0]; return { data: null, error: null }; }
        const update = calls.find((call) => call.method === "update");
        if (update) receipt = { ...receipt, ...update.args[0] };
        return { data: receipt, error: null };
      },
    }) });
    getSupabaseAdmin.mockReturnValue(db);
    const providerFetch = vi.fn((url) => url.includes("oauth2.googleapis.com")
      ? Promise.resolve(new Response(JSON.stringify({ access_token: "access" }), { status: 200 }))
      : Promise.resolve(new Response(JSON.stringify({ results: [{}] }), { status: 200 })));
    const modelFetch = vi.fn(() => modelResponse({ answer: "I can turn that campaign on for today.", action_type: "set_ad_campaign_status", target_id: "c1", desired_status: "active" }));
    const { askEddie, executeEddieAction } = await import("./eddie");

    const proposed = await askEddie({ db, user: USER, messages: [{ role: "user", content: "Turn on Google Search for today." }], fetchImpl: modelFetch });
    expect(proposed.pendingAction.dangerous).toBe(true);
    expect(proposed.pendingAction.details.join(" ")).toContain("$10.00 per day");
    expect(proposed.pendingAction.details.join(" ")).toContain("$15.00 today");
    expect(requests).toHaveLength(0);

    const completed = await executeEddieAction({ db, user: USER, token: proposed.pendingAction.token, fetchImpl: providerFetch });
    expect(completed.message).toContain("turned on");
    expect(requests[0]).toMatchObject({ campaign_control_id: "c1", requested_status: "active", daily_budget_cents: 1000, hard_daily_cap_cents: 1500 });
    expect(controlUpdates).toContainEqual(expect.objectContaining({ status: "active", last_error: null }));
  });

  it("refuses to prepare an activation while the safety switches are locked", async () => {
    const control = {
      id: "c-locked", platform: "meta_ads", name: "Family Parties",
      external_campaign_id: "444", external_budget_id: "555", status: "paused",
      daily_budget_cents: 1000, hard_daily_cap_cents: 1000, write_enabled: false,
      spend_date: null, today_spend_cents: 0, updated_at: "2026-09-06T13:00:00Z",
    };
    const db = createSupabaseAdminMock({ tables: baseTables({
      advertising_campaign_controls: ({ calls }) => calls.some((call) => call.method === "eq") ? { data: control, error: null } : { data: [control], error: null },
    }) });
    const modelFetch = vi.fn(() => modelResponse({ answer: "I found the campaign.", action_type: "set_ad_campaign_status", target_id: "c-locked", desired_status: "active" }));
    const { askEddie } = await import("./eddie");

    const result = await askEddie({ db, user: USER, messages: [{ role: "user", content: "Turn on the Meta campaign." }], fetchImpl: modelFetch });
    expect(result.pendingAction).toBeNull();
    expect(result.message).toContain("activation is still locked");
  });

  it("computes the automatic stop at the next Eastern midnight", async () => {
    const { nextEasternMidnight } = await import("./eddie");
    expect(nextEasternMidnight(new Date("2026-09-06T14:00:00Z"))).toBe("2026-09-07T04:00:00.000Z");
    expect(nextEasternMidnight(new Date("2026-12-06T14:00:00Z"))).toBe("2026-12-07T05:00:00.000Z");
  });
});
