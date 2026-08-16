"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import { requireOfficeUser } from "@/lib/server/office-auth";
import { createHelpfulDraft, organicFingerprint, scoreOrganicIntent } from "@/lib/server/organic-intent";
import { audit, clean } from "./shared";

function lines(value, limit = 20) {
  return clean(value, 5000).split("\n").map((item) => item.trim()).filter(Boolean).slice(0, limit);
}


export async function createOrganicOpportunity(formData) {
  const user = await requireOfficeUser();
  const sourceUrl = clean(formData.get("source_url"), 2000);
  const title = clean(formData.get("title"), 500);
  const excerpt = clean(formData.get("excerpt"), 5000);
  const community = clean(formData.get("community"), 200);
  if (!sourceUrl || !excerpt) redirect("/office/organic?error=incomplete");
  const db = getSupabaseAdmin();
  const [{ data: source }, { data: config }] = await Promise.all([
    db.from("organic_sources").select("id").eq("source_key", "manual").single(),
    db.from("system_config").select("organic_min_draft_score").eq("id", true).single(),
  ]);
  const scored = scoreOrganicIntent(title, excerpt);
  const fingerprint = organicFingerprint(sourceUrl, excerpt);
  const page = /75|[1-9]\d{2,}|large group/i.test(`${title} ${excerpt}`) ? "/virtual-holiday-party-for-large-groups" : /year[- ]end|inclusive|global/i.test(`${title} ${excerpt}`) ? "/virtual-year-end-team-celebration" : "/virtual-holiday-party";
  const { data: opportunity, error } = await db.from("organic_opportunities").upsert({ source_id: source?.id, source_url: sourceUrl, title: title || null, excerpt, community: community || null, intent_score: scored.score, score_reasons: scored.reasons, confidence: scored.confidence, status: "review", recommended_page: page, fingerprint, raw_data: { intake: "office", actor: user.email } }, { onConflict: "fingerprint" }).select("id,tracking_token,intent_score").single();
  if (error || !opportunity) redirect("/office/organic?error=create_failed");
  if (opportunity.intent_score >= (config?.organic_min_draft_score ?? 80)) {
    const draft = createHelpfulDraft({ excerpt, recommendedPage: page, trackingToken: opportunity.tracking_token });
    const draftFingerprint = createHash("sha256").update(`${opportunity.id}|helpful-response-v1`).digest("hex");
    await db.from("organic_response_drafts").upsert({ opportunity_id: opportunity.id, body_text: draft.bodyText, tracked_url: draft.trackedUrl, status: "review", fingerprint: draftFingerprint, decision: { generated_by: "deterministic_template", automatic_publishing: false } }, { onConflict: "fingerprint" });
    await db.from("organic_opportunities").update({ status: "drafted", updated_at: new Date().toISOString() }).eq("id", opportunity.id);
  }
  await audit("create_organic_opportunity", user, { opportunity_id: opportunity.id, score: opportunity.intent_score, automatic_publishing: false });
  revalidatePath("/office/organic");
  redirect("/office/organic?success=created");
}

export async function reviewOrganicOpportunity(formData) {
  const user = await requireOfficeUser();
  const opportunityId = clean(formData.get("opportunity_id"), 50);
  const draftId = clean(formData.get("draft_id"), 50);
  const decision = clean(formData.get("decision"), 20);
  const db = getSupabaseAdmin();
  if (decision === "dismiss") {
    await db.from("organic_opportunities").update({ status: "dismissed", updated_at: new Date().toISOString() }).eq("id", opportunityId);
    if (draftId) await db.from("organic_response_drafts").update({ status: "rejected", reviewed_at: new Date().toISOString(), reviewed_by: user.email }).eq("id", draftId);
  } else if (decision === "approve" && draftId) {
    await db.from("organic_response_drafts").update({ body_text: clean(formData.get("body_text"), 10000), status: "approved", reviewed_at: new Date().toISOString(), reviewed_by: user.email }).eq("id", draftId).eq("opportunity_id", opportunityId);
    await db.from("organic_opportunities").update({ status: "approved", updated_at: new Date().toISOString() }).eq("id", opportunityId);
  } else if (decision === "copied" && draftId) {
    await db.from("organic_response_drafts").update({ status: "copied", reviewed_at: new Date().toISOString(), reviewed_by: user.email }).eq("id", draftId).eq("opportunity_id", opportunityId).in("status", ["approved", "copied"]);
  } else if (decision === "posted" && draftId) {
    const postedUrl = clean(formData.get("posted_url"), 2000);
    if (!postedUrl) redirect("/office/organic?error=posted_url_required");
    await db.from("organic_response_drafts").update({ status: "posted", posted_url: postedUrl, posted_at: new Date().toISOString(), reviewed_by: user.email }).eq("id", draftId).eq("opportunity_id", opportunityId).in("status", ["approved", "copied"]);
    await db.from("organic_opportunities").update({ status: "posted", updated_at: new Date().toISOString() }).eq("id", opportunityId);
  }
  await audit("review_organic_opportunity", user, { opportunity_id: opportunityId, decision, automatic_publishing: false });
  revalidatePath("/office/organic");
}

export async function updateOrganicSourceConfig(formData) {
  const user = await requireOfficeUser();
  const minimumScore = Number(formData.get("minimum_capture_score"));
  const maximumAge = Number(formData.get("maximum_post_age_days"));
  const config = {
    queries: lines(formData.get("queries"), 5),
    excluded_terms: lines(formData.get("excluded_terms"), 30).map((v) => v.toLowerCase()),
    blocked_communities: lines(formData.get("blocked_communities"), 50).map((v) => v.toLowerCase()),
    minimum_capture_score: Number.isFinite(minimumScore) ? Math.min(100, Math.max(0, Math.round(minimumScore))) : 45,
    maximum_post_age_days: Number.isFinite(maximumAge) ? Math.min(90, Math.max(1, Math.round(maximumAge))) : 30,
  };
  if (!config.queries.length) redirect("/office/organic?error=queries_required");
  const db = getSupabaseAdmin();
  const { error } = await db.from("organic_sources").update({ config, updated_at: new Date().toISOString() }).eq("source_key", "reddit-approved-api");
  await audit("update_organic_source_config", user, { ...config, automatic_publishing: false }, null, error ? "failed" : "completed", error?.message);
  if (error) redirect("/office/organic?error=source_config_failed");
  revalidatePath("/office/organic");
  redirect("/office/organic?success=source_config_saved");
}
