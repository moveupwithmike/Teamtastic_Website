import { createHash } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import { audit, clean } from "./shared";

const DECISIONS = ["approve", "reject"];

function pageDetails(page = "") {
  const value = page.toLowerCase();
  if (value.includes("family-reunion")) return { customer: "Adults organizing a family reunion across different locations", occasion: "Family reunion" };
  if (value.includes("birthday")) return { customer: "Families planning an online birthday celebration", occasion: "Birthday" };
  if (value.includes("long-distance-family")) return { customer: "Families looking for a meaningful way to connect from different locations", occasion: "Long-distance family game night" };
  if (value.includes("family")) return { customer: "Families planning an online private celebration", occasion: "Family celebration" };
  return { customer: "Corporate teams planning a hosted virtual experience", occasion: "Team event" };
}

function platformDetails(source = "direct") {
  const value = source.toLowerCase();
  if (["google", "googleads", "google_ads", "adwords"].includes(value)) return { platform: "Google Ads — recommendation only", type: "advertising", dailyBudget: 1000, testDays: 5 };
  if (["meta", "facebook", "instagram", "fb", "ig"].includes(value)) return { platform: "Meta Ads — recommendation only", type: "advertising", dailyBudget: 1000, testDays: 7 };
  if (value === "linkedin") return { platform: "LinkedIn Ads — recommendation only", type: "advertising", dailyBudget: 2000, testDays: 14 };
  return { platform: "SEO — recommendation only", type: "seo", dailyBudget: 0, testDays: 0 };
}

function keywordsFor(page, occasion) {
  const fromPage = String(page || "").split("/").filter(Boolean).at(-1)?.replaceAll("-", " ");
  return [...new Set([fromPage, `virtual ${occasion.toLowerCase()}`, `hosted online ${occasion.toLowerCase()}`].filter(Boolean))];
}

export function recommendationFromGrowthItem(item, brief) {
  const [landingPage = "Direct / unknown", source = "direct", campaign = "unattributed"] = String(item?.segment || "").split(" · ");
  const page = pageDetails(landingPage);
  const channel = platformDetails(source);
  const evidence = item?.evidence || {};
  const fingerprint = createHash("sha256").update(["growth-recommendation-v1", landingPage, source, campaign].join("|")).digest("hex");
  const paid = channel.type === "advertising";
  return {
    recommendation_type: channel.type,
    title: paid ? `Review a controlled ${channel.platform.split(" —")[0]} test for ${page.occasion}` : `Improve organic demand for ${page.occasion}`,
    target_customer: page.customer,
    occasion: page.occasion,
    platform: channel.platform,
    suggested_daily_budget_cents: channel.dailyBudget,
    test_days: channel.testDays,
    proposed_keywords: keywordsFor(landingPage, page.occasion),
    proposed_audience: page.customer,
    advertisement_text: paid ? `Bring people together with a live, hosted Teamtastic game show. See how ${page.occasion.toLowerCase()} can feel easy and genuinely fun.` : null,
    creative_brief: paid ? `Show a real hosted game moment for ${page.occasion.toLowerCase()}, focused on people laughing and participating together.` : `Add specific, useful examples and questions for people planning ${page.occasion.toLowerCase()}.`,
    landing_page: landingPage,
    expected_result: paid
      ? "Measure qualified leads and establish a trustworthy cost-per-lead baseline; no booking result is promised before the test has enough data."
      : "Increase qualified organic visits and date checks over time, measured against the current first-party baseline.",
    reason: clean(item?.action, 2000) || "The sales engine found a measurable opportunity that needs owner review.",
    evidence: { ...evidence, brief_date: brief.brief_date, utm_source: source, utm_campaign: campaign, external_platform_data_connected: false },
    source_type: "growth_brief",
    source_id: brief.id,
    fingerprint,
  };
}

export async function refreshMarketingRecommendations(user) {
  const db = getSupabaseAdmin();
  const { data: brief, error: briefError } = await db.from("growth_briefs").select("id,brief_date,recommendations").order("brief_date", { ascending: false }).limit(1).maybeSingle();
  if (briefError || !brief) {
    await audit("refresh_marketing_recommendations", user, { automatic_campaign_changes: false }, null, "failed", briefError?.message || "growth_brief_missing");
    return { ok: false, errorCode: "growth_brief_missing" };
  }
  const rows = (brief.recommendations || []).map((item) => recommendationFromGrowthItem(item, brief));
  const { data, error } = rows.length
    ? await db.from("marketing_recommendations").upsert(rows, { onConflict: "fingerprint", ignoreDuplicates: true }).select("id")
    : { data: [], error: null };
  await audit("refresh_marketing_recommendations", user, { source_brief_id: brief.id, prepared: data?.length || 0, automatic_campaign_changes: false }, null, error ? "failed" : "completed", error?.message);
  return { ok: !error, count: data?.length || 0, errorCode: error ? "recommendation_refresh_failed" : undefined };
}

export async function reviewMarketingRecommendation(user, formData) {
  const id = clean(formData.get("id"), 60);
  const decision = clean(formData.get("decision"), 20);
  const notes = clean(formData.get("notes"), 2000) || null;
  if (!id || !DECISIONS.includes(decision)) return { ok: false, errorCode: "recommendation_decision_invalid" };
  const db = getSupabaseAdmin();
  const status = decision === "approve" ? "approved" : "rejected";
  const { data, error } = await db.from("marketing_recommendations").update({ status, decision_notes: notes, decided_at: new Date().toISOString(), decided_by: user.email })
    .eq("id", id).eq("status", "proposed").select("id,title,status").maybeSingle();
  const failed = Boolean(error || !data);
  await audit("review_marketing_recommendation", user, { recommendation_id: id, decision, automatic_campaign_changes: false }, null, failed ? "failed" : "completed", error?.message || (!data ? "recommendation_not_proposed" : null));
  return { ok: !failed, errorCode: failed ? "recommendation_review_failed" : undefined };
}
