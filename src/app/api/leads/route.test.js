// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseAdminMock } from "@/test/supabase-admin-mock";

const getSupabaseAdmin = vi.fn();
vi.mock("@/lib/server/supabase-admin", () => ({
  getSupabaseAdmin: () => getSupabaseAdmin(),
}));

const captureServerEvent = vi.fn((..._args) => Promise.resolve());
vi.mock("@/lib/server/posthog", () => ({
  captureServerEvent: (...args) => captureServerEvent(...args),
}));

const VALID_SUBMISSION_ID = "11111111-1111-1111-1111-111111111111";

function leadPayload(overrides = {}) {
  return {
    submissionId: VALID_SUBMISSION_ID,
    source: "event_quiz",
    name: "Jordan Rivera",
    email: "jordan@example.com",
    vibe: "social",
    turnstileToken: "development-bypass",
    ...overrides,
  };
}

async function postLead(body, headers = {}) {
  const { POST } = await import("./route.js");
  const request = new Request("https://teamtastic.com/api/leads", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.5", ...headers },
    body: JSON.stringify(body),
  });
  return POST(request);
}

describe("lead capture", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    delete process.env.TURNSTILE_SECRET_KEY; // enables the development-bypass path
    getSupabaseAdmin.mockReset();
    captureServerEvent.mockClear();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("rejects a payload with a missing email", async () => {
    const response = await postLead(leadPayload({ email: "" }));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.code).toBe("VALIDATION_ERROR");
  });

  it("rejects a payload with a source not in the allowed list", async () => {
    const response = await postLead(leadPayload({ source: "totally_made_up_source" }));
    expect(response.status).toBe(400);
  });

  it("rejects when bot verification fails", async () => {
    const response = await postLead(leadPayload({ turnstileToken: "not-the-bypass-token" }));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.code).toBe("BOT_VERIFICATION_FAILED");
  });

  it("persists a new lead, fires the analytics event, and returns its recommendation", async () => {
    const supabase = createSupabaseAdminMock({
      tables: {
        leads: ({ calls }) => {
          if (calls.some((c) => c.method === "insert")) return { data: null, error: null };
          return { data: null, error: null }; // no existing row for this submissionId
        },
      },
    });
    getSupabaseAdmin.mockReturnValue(supabase);

    const response = await postLead(leadPayload());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.submissionId).toBe(VALID_SUBMISSION_ID);
    expect(body.recommendation).toBeTruthy();

    const insertCall = supabase.from.mock.results
      .map((r) => r.value)
      .find((builder) => builder.insert.mock.calls.length > 0);
    expect(insertCall.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        submission_id: VALID_SUBMISSION_ID,
        email: "jordan@example.com",
        lead_source: "event_quiz",
        status: "new",
      }),
    );
    expect(captureServerEvent).toHaveBeenCalledWith(
      "lead_persisted",
      VALID_SUBMISSION_ID,
      expect.objectContaining({ source: "event_quiz" }),
    );
  });

  it("persists holiday scheduling and qualification details", async () => {
    const supabase = createSupabaseAdminMock({
      tables: { leads: ({ calls }) => calls.some((c) => c.method === "insert") ? { data: null, error: null } : { data: null, error: null } },
    });
    getSupabaseAdmin.mockReturnValue(supabase);

    const response = await postLead(leadPayload({
      source: "holiday_party_money_page",
      preferredEventDate: "2026-12-10",
      alternateEventDate: "2026-12-11",
      timeZone: "America/New_York",
      preferredTime: "afternoon",
      budgetRange: "2500-5000",
      packageInterest: "custom-year-in-review",
      decisionTimeline: "this-week",
      phone: "+1 555 010 0199",
    }));

    expect(response.status).toBe(200);
    const insertCall = supabase.from.mock.results.map((r) => r.value).find((builder) => builder.insert.mock.calls.length > 0);
    expect(insertCall.insert).toHaveBeenCalledWith(expect.objectContaining({
      preferred_event_date: "2026-12-10",
      alternate_event_date: "2026-12-11",
      event_timezone: "America/New_York",
      budget_range: "2500-5000",
      decision_timeline: "this-week",
      phone: "+1 555 010 0199",
    }));
  });

  it("treats a resubmitted submissionId as a no-op duplicate instead of erroring", async () => {
    const supabase = createSupabaseAdminMock({
      tables: {
        leads: () => ({ data: { submission_id: VALID_SUBMISSION_ID, recommendation_key: "competitive" }, error: null }),
      },
    });
    getSupabaseAdmin.mockReturnValue(supabase);

    const response = await postLead(leadPayload());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.duplicate).toBe(true);
    expect(captureServerEvent).not.toHaveBeenCalled();
  });

  it("returns a retryable 503 when the database is unavailable", async () => {
    const supabase = createSupabaseAdminMock({
      tables: {
        leads: () => {
          throw new Error("connection refused");
        },
      },
    });
    getSupabaseAdmin.mockReturnValue(supabase);

    const response = await postLead(leadPayload({ email: "outage@example.com" }));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.code).toBe("LEAD_SERVICE_UNAVAILABLE");
    expect(body.retryable).toBe(true);
  });

  it("rate-limits repeated submissions from the same IP and email", async () => {
    const supabase = createSupabaseAdminMock({
      tables: { leads: () => ({ data: null, error: null }) },
    });
    getSupabaseAdmin.mockReturnValue(supabase);

    const email = `ratelimit-${Date.now()}@example.com`;
    let last;
    for (let i = 0; i < 6; i += 1) {
      last = await postLead(
        leadPayload({ email, submissionId: `1111111${i}-1111-1111-1111-11111111111${i}` }),
      );
    }
    expect(last.status).toBe(429);
  });

  it("rejects malformed and oversized JSON payloads", async () => {
    const { POST } = await import("./route.js");
    const malformed = await POST(new Request("https://teamtastic.com/api/leads", { method: "POST", body: "{" }));
    expect(malformed.status).toBe(400);
    const oversized = await postLead(leadPayload({ context: { text: "x".repeat(26_000) } }));
    expect(oversized.status).toBe(413);
  });

  it("treats a unique-conflict insert as an idempotent duplicate", async () => {
    const supabase = createSupabaseAdminMock({ tables: { leads: ({ calls }) => calls.some(c => c.method === "insert")
      ? { data: null, error: { code: "23505" } }
      : { data: null, error: null } } });
    getSupabaseAdmin.mockReturnValue(supabase);
    const response = await postLead(leadPayload({ email: "conflict@example.com" }));
    expect(await response.json()).toMatchObject({ success: true, duplicate: true });
  });

  it("keeps a persisted lead successful when analytics fails", async () => {
    captureServerEvent.mockRejectedValueOnce(Object.assign(new Error("analytics down"), { code: "DOWN" }));
    getSupabaseAdmin.mockReturnValue(createSupabaseAdminMock({ tables: { leads: { data: null, error: null } } }));
    const response = await postLead(leadPayload({ email: "analytics-failure@example.com" }));
    expect(response.status).toBe(200);
  });
});
