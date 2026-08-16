// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseAdminMock } from "@/test/supabase-admin-mock";

const getSupabaseAdmin = vi.fn(), redirect = vi.fn((path) => { throw new Error(`REDIRECT:${path}`); });
const audit = vi.fn(), revalidatePath = vi.fn();
const growth = { refreshGrowthBrief: vi.fn(), reviewGrowthBrief: vi.fn(), prepareGrowthExperiments: vi.fn(), updateGrowthExperiment: vi.fn() };
const sales = { createSalesResponseDraft: vi.fn(), approveAndSendSalesResponse: vi.fn() };
vi.mock("@/lib/server/supabase-admin", () => ({ getSupabaseAdmin: () => getSupabaseAdmin() }));
vi.mock("@/lib/server/office-auth", () => ({ requireOfficeUser: () => Promise.resolve({ email: "owner@example.com" }) }));
vi.mock("next/navigation", () => ({ redirect: (path) => redirect(path) }));
vi.mock("next/cache", () => ({ revalidatePath: (...args) => revalidatePath(...args) }));
vi.mock("./shared", () => ({ audit: (...args) => audit(...args), clean: (value, limit) => String(value ?? "").trim().slice(0, limit), money: (value) => Number.isFinite(Number(value)) ? Number(value) : null }));
vi.mock("@/lib/server/office/growth-experiments", () => growth);
vi.mock("@/lib/server/office/sales-response", () => sales);

const form = (entries = {}) => ({ get: (key) => entries[key] ?? null });
const expectRedirect = async (promise, path) => expect(promise).rejects.toThrow(`REDIRECT:${path}`);

describe("previously uncovered office actions", () => {
  beforeEach(() => {
    vi.resetModules(); vi.clearAllMocks();
    getSupabaseAdmin.mockReturnValue(createSupabaseAdminMock({
      tables: { agent_log: { data: null, error: null } },
      rpc: new Proxy({}, { get: () => () => ({ data: { recorded: true }, error: null }) }),
    }));
    Object.values(growth).forEach(fn => fn.mockResolvedValue({ ok: true }));
    Object.values(sales).forEach(fn => fn.mockResolvedValue({ ok: true }));
  });

  it("routes growth wrapper outcomes", async () => {
    const actions = await import("./growth-actions");
    await expectRedirect(actions.refreshGrowthBrief(), "/office/growth?success=refreshed");
    await expectRedirect(actions.reviewGrowthBrief(form()), "/office/growth?success=reviewed");
    await expectRedirect(actions.prepareGrowthExperiments(), "/office/growth?success=experiments_prepared");
    await expectRedirect(actions.updateGrowthExperiment(form()), "/office/growth?success=experiment_updated");
    await expectRedirect(actions.saveCampaignAdSpend(form()), "/office/roi?error=invalid_spend");
    await expectRedirect(actions.overrideLeadScore(form()), "/office/scoring?error=invalid_override");
  });

  it("validates capacity actions", async () => {
    const actions = await import("./capacity");
    await expectRedirect(actions.createEventCapacityHold(form()), "/office/capacity?error=invalid_hold");
    await expectRedirect(actions.updateEventCapacityHost(form()), "/office/capacity?error=invalid_host_settings");
    await expectRedirect(actions.releaseEventCapacityHold(form({ id: "missing" })), "/office/capacity?error=hold_release_failed");
  });

  it("validates warm relationship signals", async () => {
    const actions = await import("./relationship-signals");
    await expectRedirect(actions.configureWarmRelationshipSignals(form({ reactivation_days: "3" })), "/office/warm-signals?error=invalid_settings");
    await expectRedirect(actions.recordWarmRelationshipSignal(form()), "/office/warm-signals?error=invalid_signal");
    await expectRedirect(actions.reviewWarmRelationshipSignal(form()), "/office/warm-signals?error=invalid_review");
  });

  it("refreshes incident, SLA, and intelligence data through RPC actions", async () => {
    const incidents = await import("./incidents");
    const sla = await import("./sla");
    const intelligence = await import("./intelligence");
    await expectRedirect(incidents.refreshProductionIncidents(), "/office/incidents?success=refreshed");
    await expectRedirect(incidents.updateProductionIncident(form()), "/office/incidents?error=update_incomplete");
    await expectRedirect(sla.refreshHolidaySlaEscalations(), "/office/sla?success=escalations_refreshed");
    await expectRedirect(sla.resolveHolidayEscalation(form()), "/office/sla?error=escalation_missing");
    await expectRedirect(intelligence.refreshAudienceIntelligence(), "/office/audience?success=refreshed");
    await expectRedirect(intelligence.refreshDailyGrowthAgenda(), "/office/roadmap?success=refreshed");
  });

  it("updates configuration and guards deliverability resumption", async () => {
    const configuration = await import("./configuration");
    const deliverability = await import("./deliverability");
    await expectRedirect(configuration.updateSystemConfig(form({ settings_scope: "proposal", daily_proposal_cap: "12", proposal_email_enabled: "on" })), "/office/settings?success=1");
    await expectRedirect(deliverability.resumeOutboundAfterDeliverabilityReview(form()), "/office/deliverability?error=resume_checklist_required");
  });

  it("reviews outreach drafts and routes sales response actions", async () => {
    const outreach = await import("./outreach");
    const salesActions = await import("./sales-response-actions");
    await expect(outreach.reviewOutreachDraft(form())).resolves.toBeUndefined();
    await expectRedirect(salesActions.createSalesResponseDraft(form()), "/office/respond?success=draft_created");
    await expectRedirect(salesActions.approveAndSendSalesResponse(form()), "/office/respond?success=response_sent");
  });

  it("covers certification maintenance actions and organic validation", async () => {
    const certification = await import("./certification");
    const organic = await import("./organic");
    await expectRedirect(certification.refreshFinalCertification(form({ id: "cert_1" })), "/office/final-certification?success=refreshed");
    await expectRedirect(certification.signOffFinalCertification(form({ id: "cert_1" })), "/office/final-certification?success=signed_off");
    await expectRedirect(certification.recordFinalCertificationAttestation(form({ id: "cert_1", evidence_key: "payments", passed: "on" })), "/office/final-certification?success=attestation_recorded");
    await expectRedirect(organic.createOrganicOpportunity(form()), "/office/organic?error=incomplete");
  });

  it("maps known and unknown office errors", async () => {
    const { officeErrorMessage } = await import("../office-errors");
    expect(officeErrorMessage("invalid_hold")).toContain("valid date");
    expect(officeErrorMessage("unknown")).toContain("could not be completed");
  });
});
