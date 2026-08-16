// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseAdminMock } from "@/test/supabase-admin-mock";

const getSupabaseAdmin = vi.fn();
const redirect = vi.fn((path) => { throw new Error(`REDIRECT:${path}`); });
const audit = vi.fn();
const revalidatePath = vi.fn();

vi.mock("@/lib/server/supabase-admin", () => ({ getSupabaseAdmin: () => getSupabaseAdmin() }));
vi.mock("@/lib/server/office-auth", () => ({ requireOfficeUser: () => Promise.resolve({ email: "owner@example.com" }) }));
vi.mock("next/navigation", () => ({ redirect: (path) => redirect(path) }));
vi.mock("next/cache", () => ({ revalidatePath: (...args) => revalidatePath(...args) }));
vi.mock("./shared", () => ({
  audit: (...args) => audit(...args),
  clean: (value, limit = 10000) => String(value ?? "").trim().slice(0, limit),
}));
vi.mock("@/lib/server/booking-time", () => ({
  validTimeZone: (value) => value === "America/New_York",
  zonedWallTimeToUtc: () => new Date("2026-12-10T20:00:00.000Z"),
}));
vi.mock("@/lib/server/organic-intent", () => ({
  scoreOrganicIntent: () => ({ score: 90, reasons: ["large_group"], confidence: "high" }),
  organicFingerprint: () => "organic-fingerprint",
  createHelpfulDraft: () => ({ bodyText: "Helpful answer", trackedUrl: "https://teamtastic.events/holiday?t=token" }),
}));

const form = (entries = {}) => ({ get: (key) => entries[key] ?? null });
const expectRedirect = async (promise, path) => expect(promise).rejects.toThrow(`REDIRECT:${path}`);

describe("remaining Office action success paths", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("creates, releases, and updates event capacity records", async () => {
    const writes = [];
    getSupabaseAdmin.mockReturnValue(createSupabaseAdminMock({
      rpc: { check_event_capacity: () => ({ data: { available: true, host_id: "host_1" }, error: null }) },
      tables: {
        leads: () => ({ data: { id: "lead_1", prospect_id: "prospect_1", name: "Taylor", company: "Acme" }, error: null }),
        deals: () => ({ data: { id: "deal_1" }, error: null }),
        event_capacity_holds: ({ calls }) => {
          const write = calls.find((call) => ["insert", "update"].includes(call.method));
          if (write) writes.push({ table: "holds", method: write.method, value: write.args[0] });
          return calls.some((call) => call.method === "select")
            ? { data: { prospect_id: "prospect_1" }, error: null }
            : { data: null, error: null };
        },
        event_capacity_hosts: ({ calls }) => {
          const update = calls.find((call) => call.method === "update");
          if (update) writes.push({ table: "hosts", method: "update", value: update.args[0] });
          return { data: null, error: null };
        },
      },
    }));
    const capacity = await import("./capacity");
    await expectRedirect(capacity.createEventCapacityHold(form({ lead_id: "lead_1", date: "2026-12-10", time: "15:00", timezone: "America/New_York", duration_minutes: "60", hold_hours: "48" })), "/office/capacity?success=hold_created");
    await expectRedirect(capacity.releaseEventCapacityHold(form({ id: "hold_1" })), "/office/capacity?success=hold_released");
    await expectRedirect(capacity.updateEventCapacityHost(form({ id: "host_1", max_concurrent_events: "3", timezone: "America/New_York", blocked_dates: "2026-12-24, bad" })), "/office/capacity?success=host_updated");
    expect(writes).toEqual(expect.arrayContaining([
      expect.objectContaining({ table: "holds", method: "insert", value: expect.objectContaining({ host_id: "host_1", deal_id: "deal_1" }) }),
      expect.objectContaining({ table: "holds", method: "update", value: expect.objectContaining({ status: "released" }) }),
      expect.objectContaining({ table: "hosts", value: expect.objectContaining({ max_concurrent_events: 3, blocked_dates: ["2026-12-24"] }) }),
    ]));
  });

  it("configures, records, and reviews warm relationship signals", async () => {
    const writes = [];
    getSupabaseAdmin.mockReturnValue(createSupabaseAdminMock({
      rpc: {
        queue_closed_lost_reactivations: () => ({ data: { queued: 2 }, error: null }),
        record_warm_relationship_signal: () => ({ data: { recorded: true, id: "signal_1" }, error: null }),
      },
      tables: {
        system_config: ({ calls }) => { writes.push(calls.find((call) => call.method === "update")?.args[0]); return { data: null, error: null }; },
        warm_relationship_signals: ({ calls }) => { writes.push(calls.find((call) => call.method === "update")?.args[0]); return { data: { prospect_id: "prospect_1" }, error: null }; },
        tasks: ({ calls }) => { writes.push(calls.find((call) => call.method === "update")?.args[0]); return { data: null, error: null }; },
      },
    }));
    const signals = await import("./relationship-signals");
    await expectRedirect(signals.configureWarmRelationshipSignals(form({ enabled: "on", reactivation_days: "90" })), "/office/warm-signals?success=settings_saved");
    await expectRedirect(signals.recordWarmRelationshipSignal(form({ prospect_id: "prospect_1", signal_type: "promotion", evidence: "Promoted to VP", source_url: "https://example.com" })), "/office/warm-signals?success=signal_recorded");
    await expectRedirect(signals.reviewWarmRelationshipSignal(form({ id: "signal_1", status: "actioned" })), "/office/warm-signals?success=review_saved");
    expect(writes).toEqual(expect.arrayContaining([
      expect.objectContaining({ warm_relationship_signals_enabled: true, closed_lost_reactivation_days: 90 }),
      expect.objectContaining({ status: "actioned" }),
      expect.objectContaining({ status: "completed" }),
    ]));
  });

  it("resumes outbound sending after a healthy deliverability review", async () => {
    let update;
    getSupabaseAdmin.mockReturnValue(createSupabaseAdminMock({
      rpc: { check_outbound_deliverability: () => ({ data: { paused: false, bounce_rate: 0.01 }, error: null }) },
      tables: { system_config: ({ calls }) => { update = calls.find((call) => call.method === "update")?.args[0]; return { data: null, error: null }; } },
    }));
    const { resumeOutboundAfterDeliverabilityReview } = await import("./deliverability");
    await expectRedirect(resumeOutboundAfterDeliverabilityReview(form({ domains_confirmed: "on", failures_reviewed: "on", suppressions_reviewed: "on" })), "/office/deliverability?success=resumed");
    expect(update).toMatchObject({ outbound_auto_paused: false, updated_by: "owner@example.com" });
  });

  it("approves an outreach draft with reviewed content", async () => {
    let update;
    getSupabaseAdmin.mockReturnValue(createSupabaseAdminMock({ tables: {
      outreach_drafts: ({ calls }) => {
        const write = calls.find((call) => call.method === "update");
        if (write) update = write.args[0];
        return calls.some((call) => call.method === "select")
          ? { data: { id: "draft_1", prospect_id: "prospect_1", status: "review" }, error: null }
          : { data: null, error: null };
      },
    } }));
    const { reviewOutreachDraft } = await import("./outreach");
    await reviewOutreachDraft(form({ id: "draft_1", decision: "approve", subject: "Hello", body_text: "Useful message", notes: "Reviewed" }));
    expect(update).toMatchObject({ status: "approved", subject: "Hello", body_text: "Useful message", approved_by: "owner@example.com" });
    expect(audit).toHaveBeenCalledWith("review_outreach_draft", expect.anything(), expect.objectContaining({ decision: "approve" }), "prospect_1", "completed", undefined);
  });

  it("creates a high-intent organic opportunity and deterministic response draft", async () => {
    const writes = [];
    getSupabaseAdmin.mockReturnValue(createSupabaseAdminMock({ tables: {
      organic_sources: () => ({ data: { id: "source_1" }, error: null }),
      system_config: () => ({ data: { organic_min_draft_score: 80 }, error: null }),
      organic_opportunities: ({ calls }) => {
        const write = calls.find((call) => ["upsert", "update"].includes(call.method));
        if (write) writes.push({ table: "opportunity", method: write.method, value: write.args[0] });
        return calls.some((call) => call.method === "upsert")
          ? { data: { id: "opp_1", tracking_token: "token", intent_score: 90 }, error: null }
          : { data: null, error: null };
      },
      organic_response_drafts: ({ calls }) => { writes.push({ table: "draft", value: calls.find((call) => call.method === "upsert")?.args[0] }); return { data: null, error: null }; },
    } }));
    const { createOrganicOpportunity } = await import("./organic");
    await expectRedirect(createOrganicOpportunity(form({ source_url: "https://example.com/post", title: "Event for 100 people", excerpt: "We need a large group holiday event", community: "peopleops" })), "/office/organic?success=created");
    expect(writes).toEqual(expect.arrayContaining([
      expect.objectContaining({ table: "opportunity", method: "upsert", value: expect.objectContaining({ intent_score: 90, status: "review" }) }),
      expect.objectContaining({ table: "draft", value: expect.objectContaining({ opportunity_id: "opp_1", status: "review" }) }),
      expect.objectContaining({ table: "opportunity", method: "update", value: expect.objectContaining({ status: "drafted" }) }),
    ]));
  });

  it("approves organic content and saves bounded source configuration", async () => {
    const writes = [];
    getSupabaseAdmin.mockReturnValue(createSupabaseAdminMock({ tables: new Proxy({}, { get: (_, table) => ({ calls }) => {
      const write = calls.find((call) => call.method === "update");
      if (write) writes.push({ table, value: write.args[0] });
      return { data: null, error: null };
    } }) }));
    const organic = await import("./organic");
    await organic.reviewOrganicOpportunity(form({ opportunity_id: "opp_1", draft_id: "draft_1", decision: "approve", body_text: "Approved helpful answer" }));
    await expectRedirect(organic.updateOrganicSourceConfig(form({ queries: "virtual event\nteam building", excluded_terms: "spam", blocked_communities: "ads", minimum_capture_score: "150", maximum_post_age_days: "0" })), "/office/organic?success=source_config_saved");
    expect(writes).toEqual(expect.arrayContaining([
      expect.objectContaining({ table: "organic_response_drafts", value: expect.objectContaining({ status: "approved" }) }),
      expect.objectContaining({ table: "organic_opportunities", value: expect.objectContaining({ status: "approved" }) }),
      expect.objectContaining({ table: "organic_sources", value: expect.objectContaining({ config: expect.objectContaining({ minimum_capture_score: 100, maximum_post_age_days: 1 }) }) }),
    ]));
  });

  it("resolves a production incident and records its resolution update", async () => {
    const writes = [];
    getSupabaseAdmin.mockReturnValue(createSupabaseAdminMock({ tables: {
      production_incidents: ({ calls }) => {
        const write = calls.find((call) => call.method === "update");
        if (write) writes.push({ table: "incident", value: write.args[0] });
        return calls.some((call) => call.method === "select") ? { data: { id: "incident_1", status: "open", prospect_id: "prospect_1" }, error: null } : { data: null, error: null };
      },
      production_incident_updates: ({ calls }) => { writes.push({ table: "updates", value: calls.find((call) => call.method === "insert")?.args[0] }); return { data: null, error: null }; },
    } }));
    const { updateProductionIncident } = await import("./incidents");
    await expectRedirect(updateProductionIncident(form({ incident_id: "incident_1", status: "resolved", note: "Queue recovered", owner: "michael" })), "/office/incidents?success=updated");
    expect(writes).toEqual(expect.arrayContaining([
      expect.objectContaining({ table: "incident", value: expect.objectContaining({ status: "resolved", resolution: "Queue recovered" }) }),
      expect.objectContaining({ table: "updates", value: expect.objectContaining({ update_type: "resolved", actor: "owner@example.com" }) }),
    ]));
  });

  it("completes an open holiday SLA escalation", async () => {
    let update;
    getSupabaseAdmin.mockReturnValue(createSupabaseAdminMock({ tables: {
      tasks: ({ calls }) => {
        const write = calls.find((call) => call.method === "update");
        if (write) update = write.args[0];
        return calls.some((call) => call.method === "select")
          ? { data: { id: "task_1", prospect_id: "prospect_1", source: "holiday_sla_escalation", status: "open" }, error: null }
          : { data: null, error: null };
      },
    } }));
    const { resolveHolidayEscalation } = await import("./sla");
    await expectRedirect(resolveHolidayEscalation(form({ task_id: "task_1" })), "/office/sla?success=escalation_resolved");
    expect(update).toMatchObject({ status: "completed" });
  });
});
