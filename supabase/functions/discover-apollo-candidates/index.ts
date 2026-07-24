import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { authorizeWebhook, errorText, functionError, serviceClient } from "../_shared/runtime.ts";

const TITLES = [
  "people operations", "human resources", "employee experience", "workplace experience",
  "culture", "chief people officer", "head of people", "office manager", "chief of staff",
];
const SENIORITIES = ["manager", "director", "head", "vp", "c_suite"];

function clean(value: unknown, limit = 300) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, limit) || null;
}

Deno.serve(async (request) => {
  const unauthorized = authorizeWebhook(request, "APOLLO_DISCOVERY_WEBHOOK_SECRET");
  if (unauthorized) return unauthorized;
  const apiKey = Deno.env.get("APOLLO_API_KEY");
  if (!apiKey) return Response.json({ discovered: 0, reason: "apollo_key_missing", credits_consumed: 0 }, { status: 500 });

  const supabase = serviceClient();
  const { data: config, error: configError } = await supabase.from("system_config")
    .select("master_enabled,phase3_apollo_discovery_enabled,phase3_apollo_results_per_run,prospecting_enabled")
    .eq("id", true).single();
  if (configError) return functionError("config_query_failed");

  const { data: run, error: runError } = await supabase.from("source_runs").insert({
    run_type: "apollo_enrichment",
    provider: "apollo",
    status: "started",
    decision: { discovery_only: true, enrichment_performed: false, credits_consumed: 0, send_enabled: false },
  }).select("id").single();
  if (runError || !run) return functionError("source_run_creation_failed");

  if (!config.master_enabled || !config.phase3_apollo_discovery_enabled) {
    await supabase.from("source_runs").update({
      status: "skipped", completed_at: new Date().toISOString(),
      decision: { reason: "apollo_discovery_disabled", credits_consumed: 0, send_enabled: false },
    }).eq("id", run.id);
    return Response.json({ discovered: 0, skipped: true, credits_consumed: 0, send_enabled: false });
  }

  try {
    const limit = Math.min(Number(config.phase3_apollo_results_per_run || 10), 25);
    const url = new URL("https://api.apollo.io/api/v1/mixed_people/api_search");
    for (const title of TITLES) url.searchParams.append("person_titles[]", title);
    for (const seniority of SENIORITIES) url.searchParams.append("person_seniorities[]", seniority);
    url.searchParams.append("organization_locations[]", "United States");
    url.searchParams.append("organization_num_employees_ranges[]", "25,2000");
    url.searchParams.set("contact_email_status[]", "verified");
    url.searchParams.set("include_similar_titles", "true");
    url.searchParams.set("page", "1");
    url.searchParams.set("per_page", String(limit));

    const response = await fetch(url, {
      method: "POST",
      headers: { "Accept": "application/json", "Content-Type": "application/json", "Cache-Control": "no-cache", "x-api-key": apiKey },
      body: "{}",
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`Apollo search ${response.status}: ${(await response.text()).slice(0, 300)}`);
    const payload = await response.json();
    const people = Array.isArray(payload?.people) ? payload.people : [];
    let created = 0;
    let duplicates = 0;
    for (const person of people) {
      if (!person?.id) continue;
      const organization = person.organization || {};
      const { data: inserted, error } = await supabase.from("apollo_candidates").upsert({
        apollo_person_id: String(person.id),
        apollo_organization_id: clean(person.organization_id || organization.id, 100),
        first_name: clean(person.first_name, 100),
        last_name: clean(person.last_name, 100),
        full_name: clean(person.name || `${person.first_name || ""} ${person.last_name || ""}`, 200),
        job_title: clean(person.title, 200),
        linkedin_url: clean(person.linkedin_url, 500),
        location: clean([person.city, person.state, person.country].filter(Boolean).join(", "), 300),
        company_name: clean(organization.name || person.organization_name, 200),
        company_domain: clean(organization.primary_domain || organization.website_url, 300),
        company_employee_count: Number(organization.estimated_num_employees || 0) || null,
        discovery_query: { titles: TITLES, seniorities: SENIORITIES, organization_location: "United States", employee_range: "25,2000" },
        provider_summary: { has_email: Boolean(person.has_email), email_status: person.email_status || null, photo_url_present: Boolean(person.photo_url) },
      }, { onConflict: "apollo_person_id", ignoreDuplicates: true }).select("id").maybeSingle();
      if (error) throw error;
      if (inserted) created++; else duplicates++;
    }

    await supabase.from("source_runs").update({
      status: "completed", records_scanned: people.length, records_created: created, completed_at: new Date().toISOString(),
      decision: { discovery_only: true, returned: people.length, created, duplicates, enrichment_performed: false, credits_consumed: 0, prospecting_enabled: config.prospecting_enabled, send_enabled: false },
    }).eq("id", run.id);
    await supabase.from("agent_log").insert({
      agent_name: "phase3-apollo-discovery", action: "discover_candidates", outcome: "completed",
      decision: { returned: people.length, created, duplicates, enrichment_performed: false, credits_consumed: 0, send_enabled: false },
    });
    return Response.json({ returned: people.length, created, duplicates, enrichment_performed: false, credits_consumed: 0, send_enabled: false });
  } catch (error) {
    const failure = errorText(error).slice(0, 1000);
    await supabase.from("source_runs").update({ status: "failed", error: failure, completed_at: new Date().toISOString() }).eq("id", run.id);
    return new Response("Apollo discovery failed", { status: 500 });
  }
});
