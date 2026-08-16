import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { authorizeWebhook, errorText, functionError, serviceClient } from "../_shared/runtime.ts";

const PROVIDER = "gdelt";
const RUN_BUDGET_MS = 90_000;

type Article = {
  url?: string;
  title?: string;
  seendate?: string;
  domain?: string;
  language?: string;
  sourcecountry?: string;
};

function clean(value: unknown, limit = 300) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);
}

function signalType(title: string) {
  if (/\b(hir(e|es|ed|ing)|jobs?|recruit|workforce|headcount)\b/i.test(title)) return "hiring_surge";
  if (/\b(new office|expand|expansion|relocat|headquarters|new location|opens?)\b/i.test(title)) return "office_expansion";
  if (/\b(culture|workplace|employer|best places? to work|award|recognition)\b/i.test(title)) return "culture_award";
  return "company_growth_news";
}

function strengthFor(type: string) {
  if (type === "hiring_surge" || type === "office_expansion") return 0.8;
  if (type === "culture_award") return 0.7;
  // Generic mentions carry little outreach value; keep them below scorer thresholds.
  return 0.4;
}

// Syndicated stories share a title across many domains/URLs; normalize so they
// collapse into one fingerprint.
function normalizeTitle(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

// A signal must be about the company, not merely mention it somewhere in the
// body. Requiring the name in the headline is the deterministic proxy for that.
function titleMentionsCompany(title: string, companyName: string) {
  return normalizeTitle(title).includes(normalizeTitle(companyName));
}

async function fingerprint(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

// GDELT's free tier throttles bursts hard: once it starts returning 429s, further
// requests in the same window just time out. Treat a 429 that survives one retry as
// "stop this run entirely" rather than a per-company failure.
class RateLimited extends Error {}
class RunBudgetReached extends Error {}

async function fetchPublicNews(url: URL, deadline: number) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) throw new RunBudgetReached("Signal collection wall-time budget reached");
    const response = await fetch(url, {
      headers: { "Accept": "application/json", "User-Agent": "TeamtasticSignalResearch/1.0" },
      signal: AbortSignal.timeout(Math.max(1, Math.min(25_000, remainingMs))),
    });
    if (response.ok) return response;
    if (response.status !== 429) throw new Error(`GDELT ${response.status}`);
    if (attempt === 1) throw new RateLimited("GDELT 429 after retry");
    const retryAfterSeconds = Math.min(Number(response.headers.get("retry-after") || 8), 15);
    const retryDelayMs = retryAfterSeconds * 1000;
    if (Date.now() + retryDelayMs >= deadline) throw new RunBudgetReached("Signal collection wall-time budget reached");
    await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
  }
  throw new RateLimited("GDELT retry limit reached");
}

Deno.serve(async (request) => {
  const unauthorized = await authorizeWebhook(request, "PHASE3_SIGNAL_WEBHOOK_SECRET");
  if (unauthorized) return unauthorized;
  const supabase = serviceClient();
  const { data: config, error: configError } = await supabase.from("system_config").select(
    "master_enabled,phase3_research_enabled,phase3_signal_company_limit,phase3_signal_lookback_days",
  ).eq("id", true).single();
  if (configError) return functionError("config_query_failed");

  const { data: source, error: sourceError } = await supabase.from("signal_sources").select("*")
    .eq("provider", PROVIDER).single();
  if (sourceError) return functionError("signal_source_query_failed");

  const { data: run, error: runError } = await supabase.from("source_runs").insert({
    run_type: "signal_research",
    provider: PROVIDER,
    status: "started",
    decision: { send_enabled: false, provider: PROVIDER },
  }).select("id").single();
  if (runError || !run) return functionError("source_run_creation_failed");

  if (!config.master_enabled || !config.phase3_research_enabled || !source.enabled) {
    await supabase.from("source_runs").update({
      status: "skipped",
      completed_at: new Date().toISOString(),
      decision: { reason: "phase3_research_disabled", send_enabled: false, provider: PROVIDER },
    }).eq("id", run.id);
    return Response.json({ discovered: 0, created: 0, skipped: true, send_enabled: false });
  }

  try {
    // Small batches, rotating through the least-recently-checked companies. GDELT's
    // free tier can't absorb one query per company per day at scale, and news signals
    // stay fresh for weeks — every company gets re-checked within days regardless.
    const companyLimit = Math.min(25, Math.max(1, Number(config.phase3_signal_company_limit || 5)));
    const runDeadline = Date.now() + RUN_BUDGET_MS;
    const lookbackDays = Math.min(Number(config.phase3_signal_lookback_days || 7), 30);
    const { data: companies, error: companyError } = await supabase.from("companies")
      .select("id,name,domain,lifecycle_stage,source,metadata")
      .in("lifecycle_stage", ["prospect", "qualified", "opportunity"])
      .or("source.is.null,source.neq.phase3_validation")
      .order("metadata->>signal_checked_at", { ascending: true, nullsFirst: true })
      .limit(companyLimit);
    if (companyError) throw companyError;

    let discovered = 0;
    let created = 0;
    let duplicates = 0;
    let irrelevant = 0;
    let companiesChecked = 0;
    let companiesCompleted = 0;
    const failures: Array<{ company_id: string; error: string }> = [];
    const endpoint = String(source.config?.endpoint || "https://api.gdeltproject.org/api/v2/doc/doc");

    let rateLimited = false;
    let stopReason = "company_limit_completed";
    for (const company of companies || []) {
      if (Date.now() >= runDeadline) {
        stopReason = "wall_time_budget_reached";
        break;
      }
      const companyName = clean(company.name, 100);
      if (companyName.length < 3) continue;
      // Space the requests out — burst-querying is what triggered GDELT's throttling.
      if (companiesChecked > 0) await new Promise((resolve) => setTimeout(resolve, 4000));
      companiesChecked++;
      const query = `\"${companyName.replace(/[\"\\]/g, " ")}\" (hiring OR expansion OR \"new office\" OR workplace OR award) sourcelang:english`;
      const url = new URL(endpoint);
      url.searchParams.set("query", query);
      url.searchParams.set("mode", "artlist");
      url.searchParams.set("format", "json");
      url.searchParams.set("sort", "datedesc");
      url.searchParams.set("timespan", `${lookbackDays}d`);
      url.searchParams.set("maxrecords", "10");

      try {
        const response = await fetchPublicNews(url, runDeadline);
        const payload = await response.json();
        const articles: Article[] = Array.isArray(payload?.articles) ? payload.articles : [];
        discovered += articles.length;

        for (const article of articles) {
          const articleUrl = clean(article.url, 1000);
          const title = clean(article.title, 300);
          if (!articleUrl || !title) continue;
          if (!titleMentionsCompany(title, companyName)) {
            irrelevant++;
            continue;
          }
          if (article.language && article.language.toLowerCase() !== "english") {
            irrelevant++;
            continue;
          }
          const type = signalType(title);
          const itemFingerprint = await fingerprint(`${PROVIDER}|${company.id}|${normalizeTitle(title)}`);
          const { data: inserted, error: insertError } = await supabase.from("signals").upsert({
            company_id: company.id,
            signal_type: type,
            source_url: articleUrl,
            observed_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
            strength: strengthFor(type),
            evidence: title,
            raw_data: {
              provider: PROVIDER,
              article_domain: article.domain,
              article_seen_at: article.seendate,
              language: article.language,
              source_country: article.sourcecountry,
              query_company: companyName,
            },
            fingerprint: itemFingerprint,
          }, { onConflict: "fingerprint", ignoreDuplicates: true }).select("id").maybeSingle();
          if (insertError) throw insertError;
          if (inserted) created++;
          else duplicates++;
        }
        await supabase.from("companies").update({
          metadata: { ...(company.metadata || {}), signal_checked_at: new Date().toISOString() },
        }).eq("id", company.id);
        companiesCompleted++;
      } catch (error) {
        if (error instanceof RunBudgetReached) {
          stopReason = "wall_time_budget_reached";
          break;
        }
        failures.push({ company_id: company.id, error: errorText(error).slice(0, 240) });
        if (error instanceof RateLimited) {
          // Leave signal_checked_at unstamped so this company goes first next run,
          // and stop the run — more requests now would only extend the throttle.
          rateLimited = true;
          stopReason = "provider_rate_limited";
          break;
        }
        await supabase.from("companies").update({
          metadata: { ...(company.metadata || {}), signal_checked_at: new Date().toISOString() },
        }).eq("id", company.id);
        companiesCompleted++;
      }
    }

    const completedAt = new Date().toISOString();
    await supabase.from("signal_sources").update({
      last_run_at: completedAt,
      last_success_at: failures.length === 0 ? completedAt : source.last_success_at,
      last_error: failures.length ? failures.map((item) => item.error).join("; ").slice(0, 1000) : null,
    }).eq("id", source.id);
    await supabase.from("source_runs").update({
      status: failures.length === companiesChecked && companiesChecked > 0 ? "failed" : "completed",
      records_scanned: discovered,
      records_created: created,
      completed_at: completedAt,
      error: failures.length ? JSON.stringify(failures).slice(0, 1000) : null,
      decision: { configured_company_limit: companyLimit, companies_attempted: companiesChecked, companies_completed: companiesCompleted, stop_reason: stopReason, wall_time_budget_ms: RUN_BUDGET_MS, discovered, created, duplicates, irrelevant, failed_companies: failures.length, rate_limited: rateLimited, send_enabled: false },
    }).eq("id", run.id);
    await supabase.from("agent_log").insert({
      agent_name: "phase3-signal-collector",
      action: "collect_public_news_signals",
      outcome: failures.length === companiesChecked && companiesChecked > 0 ? "failed" : "completed",
      decision: { configured_company_limit: companyLimit, companies_attempted: companiesChecked, companies_completed: companiesCompleted, stop_reason: stopReason, wall_time_budget_ms: RUN_BUDGET_MS, discovered, created, duplicates, irrelevant, failed_companies: failures.length, rate_limited: rateLimited, send_enabled: false },
    });
    return Response.json({ configured_company_limit: companyLimit, companies_attempted: companiesChecked, companies_completed: companiesCompleted, stop_reason: stopReason, discovered, created, duplicates, irrelevant, failed_companies: failures.length, rate_limited: rateLimited, send_enabled: false });
  } catch (error) {
    const failure = errorText(error).slice(0, 1000);
    await supabase.from("source_runs").update({ status: "failed", error: failure, completed_at: new Date().toISOString() }).eq("id", run.id);
    await supabase.from("signal_sources").update({ last_run_at: new Date().toISOString(), last_error: failure }).eq("id", source.id);
    return new Response("Signal collection failed", { status: 500 });
  }
});
