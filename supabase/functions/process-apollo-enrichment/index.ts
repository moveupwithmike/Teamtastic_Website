import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { authorizeWebhook, errorText, functionError, serviceClient } from "../_shared/runtime.ts";

function clean(value: unknown, limit = 300) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, limit) || null;
}

function domainFrom(value: unknown) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return null;
  try { return new URL(raw.includes("://") ? raw : `https://${raw}`).hostname.replace(/^www\./, ""); }
  catch { return null; }
}

Deno.serve(async (request) => {
  const unauthorized = await authorizeWebhook(request, "APOLLO_ENRICHMENT_WEBHOOK_SECRET");
  if (unauthorized) return unauthorized;
  const apiKey = Deno.env.get("APOLLO_API_KEY");
  const supabase = serviceClient();
  const { data: config, error: configError } = await supabase.from("system_config")
    .select("master_enabled,phase3_enrichment_enabled,phase3_apollo_enrichment_daily_cap,prospecting_enabled")
    .eq("id", true).single();
  if (configError) return functionError("config_query_failed");

  const { data: run, error: runError } = await supabase.from("source_runs").insert({
    run_type: "apollo_enrichment", provider: "apollo", status: "started",
    decision: { enrichment_worker: true, send_enabled: false },
  }).select("id").single();
  if (runError || !run) return functionError("source_run_creation_failed");

  if (!config.master_enabled || !config.phase3_enrichment_enabled || !apiKey) {
    await supabase.from("source_runs").update({
      status: "skipped", completed_at: new Date().toISOString(),
      decision: { reason: !apiKey ? "apollo_key_missing" : "apollo_enrichment_disabled", credits_consumed: 0, send_enabled: false },
    }).eq("id", run.id);
    return Response.json({ processed: 0, skipped: true, credits_consumed: 0, send_enabled: false });
  }

  try {
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const { count: usedToday } = await supabase.from("enrichment_requests").select("id", { count: "exact", head: true })
      .eq("provider", "apollo").eq("request_kind", "person_enrichment").eq("status", "completed")
      .gte("updated_at", startOfDay.toISOString());
    const remaining = Math.max(0, Number(config.phase3_apollo_enrichment_daily_cap || 5) - Number(usedToday || 0));
    if (remaining === 0) {
      await supabase.from("source_runs").update({ status: "skipped", completed_at: new Date().toISOString(), decision: { reason: "daily_enrichment_cap_reached", credits_consumed: 0, send_enabled: false } }).eq("id", run.id);
      return Response.json({ processed: 0, skipped: true, reason: "daily_enrichment_cap_reached", credits_consumed: 0, send_enabled: false });
    }

    const { data: queued, error: queueError } = await supabase.from("enrichment_requests").select(
      "id,attempts,request_payload,apollo_candidate_id,apollo_candidates(id,apollo_person_id,first_name,last_name,full_name,job_title,linkedin_url,company_name)"
    ).eq("provider", "apollo").eq("request_kind", "person_enrichment").eq("status", "pending")
      .or(`next_attempt_at.is.null,next_attempt_at.lte.${new Date().toISOString()}`).order("created_at").limit(Math.min(remaining, 10));
    if (queueError) throw queueError;
    if (!queued?.length) {
      await supabase.from("source_runs").update({ status: "completed", completed_at: new Date().toISOString(), decision: { reason: "queue_empty", credits_consumed: 0, send_enabled: false } }).eq("id", run.id);
      return Response.json({ processed: 0, reason: "queue_empty", credits_consumed: 0, send_enabled: false });
    }

    // Tag each claimed row with this run's id so a failure below only resets
    // items *this* invocation claimed, not another concurrent/overlapping
    // run's still-in-flight items.
    for (const item of queued) {
      await supabase.from("enrichment_requests").update({
        status: "processing",
        attempts: item.attempts + 1,
        request_payload: { ...(item.request_payload || {}), claimed_by_run_id: run.id },
      }).eq("id", item.id).eq("status", "pending");
    }
    const candidates = queued.map((item: any) => Array.isArray(item.apollo_candidates) ? item.apollo_candidates[0] : item.apollo_candidates);
    const url = new URL("https://api.apollo.io/api/v1/people/bulk_match");
    url.searchParams.set("reveal_personal_emails", "false");
    url.searchParams.set("reveal_phone_number", "false");
    const response = await fetch(url, {
      method: "POST",
      headers: { "Accept": "application/json", "Content-Type": "application/json", "Cache-Control": "no-cache", "x-api-key": apiKey },
      body: JSON.stringify({ details: candidates.map((candidate: any) => ({ id: candidate.apollo_person_id })) }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!response.ok) throw new Error(`Apollo enrichment ${response.status}: ${(await response.text()).slice(0, 300)}`);
    const payload = await response.json();
    const matches = Array.isArray(payload?.matches) ? payload.matches : Array.isArray(payload?.people) ? payload.people : [];
    let completed = 0, noMatch = 0, suppressed = 0;

    for (let index = 0; index < queued.length; index++) {
      const item: any = queued[index];
      const candidate: any = candidates[index];
      const person: any = matches[index];
      const email = clean(person?.email, 320)?.toLowerCase() || null;
      if (!person || !email || !["verified", "likely to engage"].includes(String(person.email_status || "").toLowerCase())) {
        await supabase.from("enrichment_requests").update({ status: "no_match", response_summary: { matched: Boolean(person), verified_work_email: false } }).eq("id", item.id);
        await supabase.from("apollo_candidates").update({ status: "selected" }).eq("id", candidate.id);
        noMatch++;
        continue;
      }
      const { data: suppression } = await supabase.from("suppression_list").select("id").eq("email_normalized", email).maybeSingle();
      if (suppression) {
        await supabase.from("enrichment_requests").update({ status: "completed", response_summary: { matched: true, suppressed: true } }).eq("id", item.id);
        await supabase.from("apollo_candidates").update({ status: "rejected", provider_summary: { suppressed: true } }).eq("id", candidate.id);
        suppressed++;
        continue;
      }

      const organization = person.organization || {};
      const domain = domainFrom(organization.primary_domain || organization.website_url);
      const companyName = clean(organization.name || candidate.company_name, 200) || "Unknown company";
      let company: any = null;
      if (domain) ({ data: company } = await supabase.from("companies").select("id").eq("domain", domain).maybeSingle());
      if (!company) ({ data: company } = await supabase.from("companies").insert({
        name: companyName, domain, website_url: clean(organization.website_url, 500), industry: clean(organization.industry, 200),
        employee_count: Number(organization.estimated_num_employees || 0) || null, headquarters: clean([organization.city, organization.state, organization.country].filter(Boolean).join(", "), 300),
        linkedin_url: clean(organization.linkedin_url, 500), lifecycle_stage: "prospect", source: "apollo", metadata: { apollo_organization_id: organization.id || candidate.apollo_organization_id },
      }).select("id").single());

      let prospect: any = null;
      ({ data: prospect } = await supabase.from("prospects").select("id").eq("email_normalized", email).maybeSingle());
      if (!prospect) {
        ({ data: prospect } = await supabase.from("prospects").insert({
          company_id: company.id, first_name: clean(person.first_name || candidate.first_name, 100), last_name: clean(person.last_name || candidate.last_name, 100),
          full_name: clean(person.name || candidate.full_name, 200), email, job_title: clean(person.title || candidate.job_title, 200), linkedin_url: clean(person.linkedin_url || candidate.linkedin_url, 500),
          source: "apollo", status: "researching", metadata: { apollo_person_id: candidate.apollo_person_id, email_status: person.email_status },
        }).select("id").single());
        // Lifecycle policy v6.2: an Apollo-discovered contact defaults to the
        // research_seed classification. Discovery and enrichment alone never
        // constitute a lead; only trusted human promotion moves it into the
        // production lifecycle.
        if (prospect?.id) {
          await supabase.from("production_record_classifications").insert({
            record_type: "prospect", record_id: prospect.id, classification: "research_seed",
            reason: "Apollo discovery defaults to research_seed under lifecycle policy v6.2 until a human verifies genuine interest.",
            actor: "automation:process-apollo-enrichment",
            evidence: { apollo_person_id: candidate.apollo_person_id, discovery_only: true },
          });
        }
      }

      await supabase.from("enrichment_requests").update({ prospect_id: prospect.id, company_id: company.id, status: "completed", response_summary: { matched: true, verified_work_email: true, email_status: person.email_status } }).eq("id", item.id);
      await supabase.from("apollo_candidates").update({ status: "enriched", company_domain: domain, company_employee_count: Number(organization.estimated_num_employees || 0) || null, provider_summary: { verified_work_email: true, email_status: person.email_status } }).eq("id", candidate.id);
      completed++;
    }

    await supabase.from("source_runs").update({ status: "completed", records_scanned: queued.length, records_created: completed, completed_at: new Date().toISOString(), decision: { completed, no_match: noMatch, suppressed, maximum_possible_credits: queued.length, send_enabled: false } }).eq("id", run.id);
    return Response.json({ processed: queued.length, completed, no_match: noMatch, suppressed, maximum_possible_credits: queued.length, send_enabled: false });
  } catch (error) {
    const failure = errorText(error).slice(0, 1000);
    // Scoped to rows this run itself claimed (see the tagging above) — a
    // different run's still-in-flight "processing" items must not be reset
    // just because this run failed.
    await supabase.from("enrichment_requests").update({ status: "pending", last_error: failure, next_attempt_at: new Date(Date.now() + 3600000).toISOString() })
      .eq("status", "processing").eq("provider", "apollo").eq("request_payload->>claimed_by_run_id", run.id);
    await supabase.from("source_runs").update({ status: "failed", error: failure, completed_at: new Date().toISOString() }).eq("id", run.id);
    return new Response("Apollo enrichment failed", { status: 500 });
  }
});
