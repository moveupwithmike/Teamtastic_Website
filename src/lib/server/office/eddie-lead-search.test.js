// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createSupabaseAdminMock } from "@/test/supabase-admin-mock";

vi.mock("server-only", () => ({}));

const USER = { email: "michael@teamtastic.com" };
const CONFIG = {
  master_enabled: true,
  eddie_apollo_search_enabled: true,
  eddie_apollo_search_max_contacts: 25,
  eddie_apollo_search_daily_run_cap: 3,
};
const INPUT = {
  action_type: "prepare_apollo_search",
  audience_name: "People leaders at growing remote companies",
  business_purpose: "Find relevant B2B companies that may need hosted virtual team activities.",
  titles: ["Head of People", "Employee Experience Director"],
  industries: ["software", "professional services"],
  seniorities: ["head", "director"],
  locations: ["United States"],
  employee_min: 50,
  employee_max: 1000,
  max_contacts: 10,
};

describe("protected Eddie lead searches", () => {
  it("shows the full zero-credit Apollo search before saving anything", async () => {
    const db = createSupabaseAdminMock({ tables: { system_config: { data: CONFIG, error: null } } });
    const { prepareLeadSearchAction } = await import("./eddie-lead-search");

    const prepared = await prepareLeadSearchAction(db, INPUT);

    expect(prepared.action).toMatchObject({
      type: "prepare_apollo_search", max_contacts: 10, estimated_credits: 0, hard_credit_cap: 0,
    });
    expect(prepared.confirmation.details.join(" ")).toContain("Head of People");
    expect(prepared.confirmation.details.join(" ")).toContain("hard credit limit: 0");
    expect(db.from.mock.calls.map(([table]) => table)).not.toContain("protected_lead_searches");
  });

  it("refuses a search above the fixed contact maximum", async () => {
    const db = createSupabaseAdminMock({ tables: { system_config: { data: { ...CONFIG, eddie_apollo_search_max_contacts: 5 }, error: null } } });
    const { prepareLeadSearchAction } = await import("./eddie-lead-search");

    await expect(prepareLeadSearchAction(db, { ...INPUT, max_contacts: 10 }))
      .rejects.toMatchObject({ code: "apollo_search_details_invalid" });
  });

  it("saves an approved search only after the first confirmed receipt", async () => {
    const inserts = [];
    const db = createSupabaseAdminMock({ tables: {
      system_config: { data: CONFIG, error: null },
      protected_lead_searches: ({ calls }) => {
        const insert = calls.find((call) => call.method === "insert");
        if (insert) {
          inserts.push(insert.args[0]);
          return { data: { id: "search-1", ...insert.args[0] }, error: null };
        }
        return { data: [], error: null };
      },
    } });
    const { runConfirmedLeadSearchAction } = await import("./eddie-lead-search");

    const result = await runConfirmedLeadSearchAction(db, USER, "receipt-prepare", {
      type: "prepare_apollo_search",
      audience_name: INPUT.audience_name,
      business_purpose: INPUT.business_purpose,
      titles: INPUT.titles,
      industry_keywords: INPUT.industries,
      seniorities: INPUT.seniorities,
      locations: INPUT.locations,
      employee_min: INPUT.employee_min,
      employee_max: INPUT.employee_max,
      max_contacts: INPUT.max_contacts,
      estimated_credits: 0,
      hard_credit_cap: 0,
    });

    expect(result.message).toContain("It has not run yet");
    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toMatchObject({
      provider: "apollo", status: "approved", prepare_receipt_id: "receipt-prepare",
      approved_by: USER.email, hard_credit_cap: 0,
    });
  });

  it("queues only the unchanged approved search after a second confirmation", async () => {
    const search = {
      id: "search-1", provider: "apollo", status: "approved",
      audience_name: INPUT.audience_name, business_purpose: INPUT.business_purpose,
      titles: INPUT.titles, industry_keywords: INPUT.industries,
      seniorities: INPUT.seniorities, locations: INPUT.locations,
      employee_min: 50, employee_max: 1000, max_contacts: 10,
      hard_credit_cap: 0, updated_at: "2026-09-07T16:00:00Z",
    };
    const db = createSupabaseAdminMock({ tables: {
      system_config: { data: CONFIG, error: null },
      protected_lead_searches: { data: search, error: null },
    }, rpc: {
      queue_approved_apollo_search: (args) => ({ data: { queued: true, search_id: args.p_search_id }, error: null }),
    } });
    const { prepareLeadSearchAction, runConfirmedLeadSearchAction } = await import("./eddie-lead-search");

    const prepared = await prepareLeadSearchAction(db, { action_type: "run_approved_apollo_search", target_id: search.id });
    const result = await runConfirmedLeadSearchAction(db, USER, "receipt-run", prepared.action);

    expect(prepared.confirmation.dangerous).toBe(true);
    expect(result.message).toContain("cannot consume search credits");
    expect(db.rpc).toHaveBeenCalledWith("queue_approved_apollo_search", {
      p_search_id: search.id, p_receipt_id: "receipt-run", p_actor: USER.email,
    });
  });

  it("exposes no Apify source until a specific source is enabled", async () => {
    const db = createSupabaseAdminMock({ tables: {
      protected_lead_searches: { data: [], error: null },
      apify_approved_sources: { data: [], error: null },
      system_config: { data: CONFIG, error: null },
    } });
    const { leadSearchContextSlice } = await import("./eddie-lead-search");

    const result = await leadSearchContextSlice(db);

    expect(result.data.apify_approved_sources).toEqual([]);
    expect(result.data.apify_policy).toContain("Deny by default");
  });
});
