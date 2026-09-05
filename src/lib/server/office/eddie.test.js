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
});
