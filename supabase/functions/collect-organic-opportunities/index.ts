import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { authorizeWebhook, errorText, functionError, serviceClient } from "../_shared/runtime.ts";

type RedditChild = { data?: { id?: string; title?: string; selftext?: string; permalink?: string; subreddit_name_prefixed?: string; author?: string; created_utc?: number; over_18?: boolean } };

function clean(value: unknown, limit = 1000) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);
}

async function hash(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function score(title: string, excerpt: string) {
  const text = `${title} ${excerpt}`;
  const signals: Array<[RegExp, number, string]> = [
    [/holiday|year[- ]end|christmas|winter/i, 22, "Seasonal event request"],
    [/virtual|remote|distributed|global team/i, 18, "Virtual or distributed team"],
    [/team building|company event|corporate event|employee engagement/i, 18, "Corporate team-event intent"],
    [/looking for|recommend|need|planning|ideas|vendor/i, 16, "Active research language"],
    [/\b(75|[89]\d|[1-9]\d{2,})\+?\b|large group/i, 12, "Large-group signal"],
    [/december|november|next week|this month|date/i, 8, "Timing signal"],
    [/budget|price|cost|quote|procurement/i, 6, "Commercial signal"],
    [/family reunion|family game night|long[- ]distance family|college reunion|virtual birthday/i, 22, "Family or reunion event intent"],
  ];
  let value = 5;
  const reasons: string[] = [];
  for (const [pattern, points, reason] of signals) if (pattern.test(text)) { value += points; reasons.push(reason); }
  return { value: Math.min(100, value), reasons, confidence: Math.min(0.95, 0.35 + reasons.length * 0.1) };
}

function pageFor(text: string) {
  if (/family reunion|family game night|long[- ]distance family|college reunion|virtual birthday/i.test(text)) return "/virtual-family-game-night";
  if (/75|[1-9]\d{2,}|large group/i.test(text)) return "/virtual-holiday-party-for-large-groups";
  if (/year[- ]end|inclusive|global/i.test(text)) return "/virtual-year-end-team-celebration";
  return "/virtual-holiday-party";
}

async function redditToken() {
  const clientId = Deno.env.get("REDDIT_CLIENT_ID");
  const clientSecret = Deno.env.get("REDDIT_CLIENT_SECRET");
  if (!clientId || !clientSecret) return null;
  const response = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: { Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`, "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "TeamtasticIntentResearch/1.0" },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Reddit OAuth returned ${response.status}`);
  return clean((await response.json()).access_token, 2000);
}

Deno.serve(async (request) => {
  const unauthorized = authorizeWebhook(request, "ORGANIC_RESEARCH_WEBHOOK_SECRET");
  if (unauthorized) return unauthorized;
  const db = serviceClient();
  const { data: config, error: configError } = await db.from("system_config").select("master_enabled,organic_research_enabled,organic_scoring_enabled,organic_drafting_enabled,organic_daily_opportunity_cap,organic_min_draft_score,organic_reddit_commercial_approval_confirmed").eq("id", true).single();
  if (configError) return functionError("config_query_failed");
  const { data: source, error: sourceError } = await db.from("organic_sources").select("*").eq("source_key", "reddit-approved-api").single();
  if (sourceError) return functionError("source_query_failed");
  const { data: run, error: runError } = await db.from("organic_source_runs").insert({ source_id: source.id, decision: { provider: "reddit-approved-api", automatic_publishing: false } }).select("id").single();
  if (runError || !run) return functionError("run_creation_failed");

  if (!config.organic_reddit_commercial_approval_confirmed) {
    await db.from("organic_source_runs").update({ status: "skipped", completed_at: new Date().toISOString(), decision: { reason: "reddit_commercial_approval_not_confirmed", automatic_publishing: false } }).eq("id", run.id);
    return Response.json({ skipped: true, reason: "reddit_commercial_approval_not_confirmed", automatic_publishing: false });
  }

  if (!config.master_enabled || !config.organic_research_enabled || !source.enabled) {
    await db.from("organic_source_runs").update({ status: "skipped", completed_at: new Date().toISOString(), decision: { reason: "organic_research_disabled", automatic_publishing: false } }).eq("id", run.id);
    return Response.json({ skipped: true, reason: "organic_research_disabled", automatic_publishing: false });
  }

  try {
    const token = await redditToken();
    if (!token) {
      await db.from("organic_source_runs").update({ status: "skipped", completed_at: new Date().toISOString(), decision: { reason: "reddit_credentials_missing", automatic_publishing: false } }).eq("id", run.id);
      return Response.json({ skipped: true, reason: "reddit_credentials_missing", automatic_publishing: false });
    }
    const today = new Date(); today.setUTCHours(0, 0, 0, 0);
    const { count } = await db.from("organic_opportunities").select("id", { count: "exact", head: true }).gte("created_at", today.toISOString()).eq("raw_data->>provider", "reddit-approved-api");
    const remaining = Math.max(0, Math.min(Number(source.daily_cap || 10), Number(config.organic_daily_opportunity_cap || 25)) - Number(count || 0));
    if (!remaining) {
      await db.from("organic_source_runs").update({ status: "skipped", completed_at: new Date().toISOString(), decision: { reason: "daily_cap_reached", automatic_publishing: false } }).eq("id", run.id);
      return Response.json({ skipped: true, reason: "daily_cap_reached", automatic_publishing: false });
    }
    const queries = Array.isArray(source.config?.queries) ? source.config.queries.slice(0, 10) : [];
    const excludedTerms = (Array.isArray(source.config?.excluded_terms) ? source.config.excluded_terms : []).map((v: unknown) => clean(v, 80).toLowerCase()).filter(Boolean);
    const blockedCommunities = (Array.isArray(source.config?.blocked_communities) ? source.config.blocked_communities : []).map((v: unknown) => clean(v, 100).toLowerCase()).filter(Boolean);
    const minimumCaptureScore = Math.min(100, Math.max(0, Number(source.config?.minimum_capture_score || 45)));
    const maximumPostAgeDays = Math.min(90, Math.max(1, Number(source.config?.maximum_post_age_days || 30)));
    let scanned = 0, created = 0, duplicates = 0, filtered = 0;
    for (const rawQuery of queries) {
      if (created >= remaining) break;
      const query = clean(rawQuery, 120);
      if (!query) continue;
      const url = new URL("https://oauth.reddit.com/search");
      url.searchParams.set("q", query); url.searchParams.set("sort", "new"); url.searchParams.set("t", "month"); url.searchParams.set("limit", String(Math.min(25, remaining * 3))); url.searchParams.set("restrict_sr", "false");
      const response = await fetch(url, { headers: { Authorization: `Bearer ${token}`, "User-Agent": "TeamtasticIntentResearch/1.0" }, signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error(`Reddit search returned ${response.status}`);
      const children: RedditChild[] = (await response.json())?.data?.children || [];
      scanned += children.length;
      for (const child of children) {
        if (created >= remaining) break;
        const post = child.data || {};
        if (post.over_18) continue;
        const title = clean(post.title, 500), excerpt = clean(post.selftext || post.title, 5000), permalink = clean(post.permalink, 1500);
        if (!post.id || !title || !excerpt || !permalink) continue;
        const candidateText = `${title} ${excerpt}`;
        const community = clean(post.subreddit_name_prefixed, 200);
        const ageDays = post.created_utc ? (Date.now() - post.created_utc * 1000) / 86400000 : 999;
        const scored = score(title, excerpt);
        const isFamilyAudience = /family reunion|family game night|long[- ]distance family|college reunion|virtual birthday|friends reunion/i.test(candidateText);
        const hasRelevantContext = isFamilyAudience || /team|employee|company|corporate|coworker|colleague|workplace|remote work|people ops|hr\b/i.test(candidateText);
        if (!hasRelevantContext || scored.value < minimumCaptureScore || ageDays > maximumPostAgeDays || excludedTerms.some((term: string) => candidateText.toLowerCase().includes(term)) || blockedCommunities.includes(community.toLowerCase())) { filtered++; continue; }
        const sourceUrl = `https://www.reddit.com${permalink}`;
        const fingerprint = await hash(`reddit-approved-api|${post.id}`);
        const storedScore = config.organic_scoring_enabled ? scored : { value: null, reasons: [], confidence: null };
        const page = pageFor(`${title} ${excerpt}`);
        const { data: inserted, error } = await db.from("organic_opportunities").upsert({ source_id: source.id, external_id: post.id, source_url: sourceUrl, title, excerpt, author_display_name: clean(post.author, 100) || null, community: community || null, published_at: post.created_utc ? new Date(post.created_utc * 1000).toISOString() : null, persona: isFamilyAudience ? "family_friends" : "corporate", intent_category: isFamilyAudience ? "family_event" : "corporate_event", intent_score: storedScore.value, score_reasons: storedScore.reasons, confidence: storedScore.confidence, status: config.organic_scoring_enabled ? "scored" : "new", recommended_page: page, fingerprint, raw_data: { provider: "reddit-approved-api", query, audience: isFamilyAudience ? "family" : "corporate", automatic_publishing: false } }, { onConflict: "fingerprint", ignoreDuplicates: true }).select("id,tracking_token,intent_score").maybeSingle();
        if (error) throw error;
        if (!inserted) { duplicates++; continue; }
        created++;
        if (config.organic_drafting_enabled && Number(inserted.intent_score || 0) >= Number(config.organic_min_draft_score || 80)) {
          const trackedUrl = `https://www.teamtastic.events${page}?utm_source=organic_intent&utm_medium=helpful_response&utm_campaign=organic_intent_radar&utm_content=${inserted.tracking_token}`;
          const bodyText = `A useful way to narrow this down is to confirm the date, time zone, group size, and desired format first. For a 60-minute event, allow about 5 minutes for arrival, 45–50 minutes for hosted play, and 5 minutes for awards. We run these at Teamtastic; this planning page may help: ${trackedUrl}`;
          await db.from("organic_response_drafts").insert({ opportunity_id: inserted.id, body_text: bodyText, tracked_url: trackedUrl, status: "review", fingerprint: await hash(`${inserted.id}|helpful-response-v1`), decision: { generated_by: "deterministic_template", automatic_publishing: false } });
          await db.from("organic_opportunities").update({ status: "drafted", updated_at: new Date().toISOString() }).eq("id", inserted.id);
        }
      }
    }
    const completedAt = new Date().toISOString();
    await db.from("organic_source_runs").update({ status: "completed", records_scanned: scanned, records_created: created, completed_at: completedAt, decision: { scanned, created, duplicates, filtered, minimum_capture_score: minimumCaptureScore, daily_remaining_before_run: remaining, automatic_publishing: false } }).eq("id", run.id);
    await db.from("organic_sources").update({ last_run_at: completedAt, last_error: null, updated_at: completedAt }).eq("id", source.id);
    return Response.json({ scanned, created, duplicates, filtered, automatic_publishing: false });
  } catch (error) {
    const failure = errorText(error).slice(0, 1000);
    await db.from("organic_source_runs").update({ status: "failed", error: failure, completed_at: new Date().toISOString() }).eq("id", run.id);
    await db.from("organic_sources").update({ last_run_at: new Date().toISOString(), last_error: failure, updated_at: new Date().toISOString() }).eq("id", source.id);
    return functionError("organic_collection_failed");
  }
});
