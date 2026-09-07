import "server-only";
import { createHash } from "node:crypto";
import { EddieError } from "./eddie-error";

export const LEAD_SEARCH_ACTION_TYPES = ["prepare_apollo_search", "run_approved_apollo_search"];

const APOLLO_SENIORITIES = new Set(["owner", "founder", "c_suite", "partner", "vp", "head", "director", "manager", "senior"]);

function clean(value, limit = 300) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);
}

function cleanList(value, limit, itemLimit = 100) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => clean(item, itemLimit)).filter(Boolean))].slice(0, limit);
}

function integer(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : fallback;
}

function searchFingerprint(search) {
  return createHash("sha256").update(JSON.stringify({
    id: search.id,
    status: search.status,
    audience_name: search.audience_name,
    business_purpose: search.business_purpose,
    titles: search.titles,
    industry_keywords: search.industry_keywords,
    seniorities: search.seniorities,
    locations: search.locations,
    employee_min: search.employee_min,
    employee_max: search.employee_max,
    max_contacts: search.max_contacts,
    hard_credit_cap: search.hard_credit_cap,
    updated_at: search.updated_at,
  })).digest("hex");
}

async function searchConfig(db) {
  const { data, error } = await db.from("system_config")
    .select("master_enabled,eddie_apollo_search_enabled,eddie_apollo_search_max_contacts,eddie_apollo_search_daily_run_cap")
    .eq("id", true).maybeSingle();
  if (error || !data) throw new EddieError("lead_search_configuration_unavailable", 503);
  if (!data.master_enabled || !data.eddie_apollo_search_enabled) throw new EddieError("apollo_search_disabled", 409);
  return data;
}

export async function leadSearchContextSlice(db) {
  const [searchesResult, sourcesResult, configResult] = await Promise.all([
    db.from("protected_lead_searches")
      .select("id,provider,audience_name,business_purpose,titles,industry_keywords,seniorities,locations,employee_min,employee_max,max_contacts,estimated_credits,hard_credit_cap,status,returned_count,created_count,duplicate_count,actual_credits,error,approved_at,queued_at,completed_at,updated_at")
      .order("created_at", { ascending: false }).limit(15),
    db.from("apify_approved_sources")
      .select("id,source_name,actor_id,public_source_domain,business_purpose,allowed_input_keys,allowed_output_fields,maximum_items,maximum_cost_cents,enabled,approved_at")
      .eq("enabled", true).order("source_name"),
    db.from("system_config")
      .select("eddie_apollo_search_enabled,eddie_apollo_search_max_contacts,eddie_apollo_search_daily_run_cap")
      .eq("id", true).maybeSingle(),
  ]);
  const error = searchesResult.error || sourcesResult.error || configResult.error;
  return error ? { data: null, error } : { data: {
    apollo: {
      manually_confirmed_search_enabled: Boolean(configResult.data?.eddie_apollo_search_enabled),
      maximum_contacts_per_search: Number(configResult.data?.eddie_apollo_search_max_contacts || 0),
      maximum_runs_per_day: Number(configResult.data?.eddie_apollo_search_daily_run_cap || 0),
      search_credit_cost: 0,
      returns_contact_details: false,
      enrichment_enabled_by_this_command: false,
      outreach_enabled_by_this_command: false,
    },
    searches: searchesResult.data || [],
    apify_approved_sources: sourcesResult.data || [],
    apify_policy: "Deny by default. Only enabled, specifically approved public business sources may run. Consumer-person data collection is prohibited.",
  }, error: null };
}

export async function prepareLeadSearchAction(db, input) {
  const type = clean(input.action_type, 50);
  if (type === "prepare_apollo_search") {
    const config = await searchConfig(db);
    const audienceName = clean(input.audience_name, 200);
    const businessPurpose = clean(input.business_purpose, 1000);
    const titles = cleanList(input.titles, 12, 100);
    const industryKeywords = cleanList(input.industries, 8, 100);
    const seniorities = cleanList(input.seniorities, 8, 30).filter((value) => APOLLO_SENIORITIES.has(value));
    const locations = cleanList(input.locations, 8, 100);
    const employeeMin = integer(input.employee_min, 25);
    const employeeMax = integer(input.employee_max, 2000);
    const maxContacts = integer(input.max_contacts, Math.min(10, Number(config.eddie_apollo_search_max_contacts)));
    if (audienceName.length < 3 || businessPurpose.length < 20 || !titles.length || !industryKeywords.length
      || !seniorities.length || !locations.length || employeeMin < 1 || employeeMax < employeeMin
      || maxContacts < 1 || maxContacts > Number(config.eddie_apollo_search_max_contacts)) {
      throw new EddieError("apollo_search_details_invalid", 409);
    }
    const action = {
      type, audience_name: audienceName, business_purpose: businessPurpose,
      titles, industry_keywords: industryKeywords, seniorities, locations,
      employee_min: employeeMin, employee_max: employeeMax, max_contacts: maxContacts,
      estimated_credits: 0, hard_credit_cap: 0,
    };
    return {
      action,
      confirmation: {
        title: "Approve and save this Apollo search",
        details: [
          `Audience: ${audienceName}`,
          `Titles: ${titles.join(", ")}`,
          `Industry keywords: ${industryKeywords.join(", ")}`,
          `Seniority: ${seniorities.join(", ")}`,
          `Company locations: ${locations.join(", ")}`,
          `Company size: ${employeeMin.toLocaleString()}–${employeeMax.toLocaleString()} employees`,
          `Maximum results: ${maxContacts}`,
          "Estimated Apollo search credits: 0; hard credit limit: 0.",
          "This only saves an approved search. It does not run it, reveal email or phone details, enrich contacts, create leads, or send messages.",
        ],
      },
    };
  }

  if (type === "run_approved_apollo_search") {
    await searchConfig(db);
    const searchId = clean(input.target_id, 60);
    const { data: search, error } = await db.from("protected_lead_searches").select("*")
      .eq("id", searchId).eq("provider", "apollo").maybeSingle();
    if (error || !search || search.status !== "approved") throw new EddieError("approved_apollo_search_not_found", 409);
    return {
      action: { type, search_id: search.id, expected_fingerprint: searchFingerprint(search) },
      confirmation: {
        title: "Run this approved Apollo search",
        details: [
          `Audience: ${search.audience_name}`,
          `Titles: ${(search.titles || []).join(", ")}`,
          `Industry keywords: ${(search.industry_keywords || []).join(", ")}`,
          `Maximum results: ${search.max_contacts}`,
          `Hard credit limit: ${search.hard_credit_cap}`,
          "Apollo will return research candidates only. No email or phone details will be requested, nobody becomes a lead, and no outreach will be sent.",
        ],
        dangerous: true,
      },
    };
  }

  throw new EddieError("action_not_allowed", 400);
}

export async function runConfirmedLeadSearchAction(db, user, receiptId, action) {
  if (action.type === "prepare_apollo_search") {
    const config = await searchConfig(db);
    if (action.max_contacts > Number(config.eddie_apollo_search_max_contacts)
      || action.estimated_credits !== 0 || action.hard_credit_cap !== 0) {
      throw new EddieError("apollo_search_limit_changed", 409);
    }
    const { data, error } = await db.from("protected_lead_searches").insert({
      provider: "apollo",
      audience_name: action.audience_name,
      business_purpose: action.business_purpose,
      titles: action.titles,
      industry_keywords: action.industry_keywords,
      seniorities: action.seniorities,
      locations: action.locations,
      employee_min: action.employee_min,
      employee_max: action.employee_max,
      max_contacts: action.max_contacts,
      estimated_credits: 0,
      hard_credit_cap: 0,
      search_parameters: { include_similar_titles: true, contact_email_status: "verified", page: 1 },
      status: "approved",
      prepare_receipt_id: receiptId,
      approved_by: user.email,
    }).select("id,audience_name,status,max_contacts,estimated_credits,hard_credit_cap").single();
    if (error || !data) throw new EddieError("apollo_search_save_failed", 503);
    return {
      message: `Done. I saved and approved the Apollo search “${data.audience_name}” with a maximum of ${data.max_contacts} research candidates and a hard limit of ${data.hard_credit_cap} credits. It has not run yet.`,
      record: data,
    };
  }

  if (action.type === "run_approved_apollo_search") {
    await searchConfig(db);
    const { data: search, error } = await db.from("protected_lead_searches").select("*")
      .eq("id", action.search_id).eq("provider", "apollo").maybeSingle();
    if (error || !search || search.status !== "approved" || searchFingerprint(search) !== action.expected_fingerprint) {
      throw new EddieError("apollo_search_changed_since_confirmation", 409);
    }
    const { data, error: queueError } = await db.rpc("queue_approved_apollo_search", {
      p_search_id: search.id,
      p_receipt_id: receiptId,
      p_actor: user.email,
    });
    if (queueError || data?.queued !== true) throw new EddieError("apollo_search_queue_failed", 503);
    return {
      message: `Done. I started the approved Apollo search “${search.audience_name}”. It can return at most ${search.max_contacts} research candidates and cannot consume search credits, reveal contact details, enrich anyone, create leads, or send outreach.`,
      record: { id: search.id, status: "queued", max_contacts: search.max_contacts, hard_credit_cap: search.hard_credit_cap },
    };
  }

  throw new EddieError("action_not_allowed", 400);
}
