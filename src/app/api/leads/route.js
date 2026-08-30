import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getRecommendation } from "@/lib/recommendations";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import { captureServerEvent } from "@/lib/server/posthog";
import { hashKey, rateLimited } from "@/lib/server/rate-limit";
import { verifyTurnstile } from "@/lib/server/turnstile";
import { clean } from "@/lib/server/validation";

const SOURCES = new Set([
  "event_quiz",
  "playable_demo",
  "michael_event_concierge",
  "michael_family_concierge",
  "holiday_party_money_page",
  "virtual_team_building_money_page",
  "year_end_celebration_page",
  "large_holiday_event_page",
  "holiday_planning_checklist",
  "theme_fall_team_building",
  "theme_halloween",
  "theme_holiday_team_building",
  "theme_black_history_month",
]);
function response(status, code, message, retryable = false) {
  return NextResponse.json({ success: false, code, message, retryable }, { status });
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

function optionalIsoDate(value) {
  const date = clean(value, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(`${date}T00:00:00Z`)) ? date : null;
}

export async function POST(request) {
  let body;
  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 25_000) return response(413, "PAYLOAD_TOO_LARGE", "The request is too large.");
    body = await request.json();
    if (JSON.stringify(body).length > 25_000) {
      return response(413, "PAYLOAD_TOO_LARGE", "The request is too large.");
    }
  } catch {
    return response(400, "INVALID_JSON", "The request could not be read.");
  }

  const submissionId = clean(body.submissionId, 36) || randomUUID();
  const source = clean(body.source, 50);
  const name = clean(body.name, 120);
  const email = clean(body.email, 254).toLowerCase();
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";

  if (!/^[0-9a-f-]{36}$/i.test(submissionId) || !SOURCES.has(source) || !name || !validEmail(email)) {
    return response(400, "VALIDATION_ERROR", "Please check your name, email, and form details.");
  }
  const rateKey = hashKey(ip, email);
  if (rateLimited(rateKey)) {
    return response(429, "RATE_LIMITED", "Too many attempts. Please wait a few minutes and retry.", true);
  }

  try {
    if (!(await verifyTurnstile(clean(body.turnstileToken, 2048), ip))) {
      return response(400, "BOT_VERIFICATION_FAILED", "Secure verification failed. Please retry.", true);
    }
  } catch {
    return response(503, "VERIFICATION_UNAVAILABLE", "Secure verification is temporarily unavailable.", true);
  }

  const recommendation = getRecommendation(clean(body.vibe, 80));
  // Provenance is server-authoritative. Callers may attach their own analytics
  // context, but certification/synthetic markers are stripped so public form
  // submissions always inherit production provenance at creation time.
  const callerContext =
    typeof body.context === "object" && body.context ? body.context : {};
  const protectedContextKeys = new Set([
    "synthetic_test",
    "certification_id",
    "certification_run_id",
    "execution_key",
    "recipient_classification",
    "external_send",
    "external_notifications",
    "cleanup_disposition",
  ]);
  const row = {
    submission_id: submissionId,
    name,
    email,
    email_normalized: email,
    company: clean(body.company, 160) || null,
    phone: clean(body.phone, 40) || null,
    team_size: clean(body.teamSize, 80) || null,
    vibe: clean(body.vibe, 80) || null,
    occasion: clean(body.occasion, 120) || null,
    recommendation_key: source === "event_quiz" ? recommendation.key : clean(body.recommendationKey, 80) || null,
    lead_source: source,
    status: "new",
    landing_page: clean(body.landingPage, 1000) || null,
    referrer: clean(body.referrer, 1000) || null,
    utm_source: clean(body.utm?.source, 200) || null,
    utm_medium: clean(body.utm?.medium, 200) || null,
    utm_campaign: clean(body.utm?.campaign, 200) || null,
    utm_content: clean(body.utm?.content, 200) || null,
    utm_term: clean(body.utm?.term, 200) || null,
    context: Object.fromEntries(
      Object.entries(callerContext).filter(([key]) => !protectedContextKeys.has(key))
    ),
    preferred_event_date: optionalIsoDate(body.preferredEventDate),
    alternate_event_date: optionalIsoDate(body.alternateEventDate),
    event_timezone: clean(body.timeZone, 80) || null,
    preferred_time: clean(body.preferredTime, 80) || null,
    budget_range: clean(body.budgetRange, 80) || null,
    package_interest: clean(body.packageInterest, 120) || null,
    decision_timeline: clean(body.decisionTimeline, 80) || null,
  };

  try {
    const supabase = getSupabaseAdmin();
    const { data: existing, error: lookupError } = await supabase
      .from("leads")
      .select("submission_id,recommendation_key")
      .eq("submission_id", submissionId)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (existing) {
      return NextResponse.json({ success: true, submissionId, recommendation, duplicate: true });
    }
    const { error } = await supabase.from("leads").insert(row);
    if (error?.code === "23505") {
      return NextResponse.json({ success: true, submissionId, recommendation, duplicate: true });
    }
    if (error) throw error;
    try {
      await captureServerEvent("lead_persisted", submissionId, {
        submission_id: submissionId,
        source,
        team_size: row.team_size,
        vibe: row.vibe,
        occasion: row.occasion,
        recommendation_key: row.recommendation_key,
      });
    } catch (analyticsError) {
      console.error("Lead persistence analytics failed", {
        code: analyticsError?.code || analyticsError?.name || "unknown",
        source,
      });
    }
    return NextResponse.json({ success: true, submissionId, recommendation });
  } catch (error) {
    console.error("Lead capture failed", { code: error?.code || "unknown", source });
    return response(503, "LEAD_SERVICE_UNAVAILABLE", "We couldn't save your details. Please retry.", true);
  }
}
