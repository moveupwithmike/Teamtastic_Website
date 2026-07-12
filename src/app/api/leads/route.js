import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getRecommendation } from "@/lib/recommendations";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import { captureServerEvent } from "@/lib/server/posthog";

const SOURCES = new Set([
  "event_quiz",
  "playable_demo",
  "michael_event_concierge",
  "michael_family_concierge",
  "holiday_party_money_page",
  "virtual_team_building_money_page",
]);
const buckets = new Map();

function response(status, code, message, retryable = false) {
  return NextResponse.json({ success: false, code, message, retryable }, { status });
}

function clean(value, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

function rateLimited(key) {
  const now = Date.now();
  const entries = (buckets.get(key) || []).filter((time) => now - time < 10 * 60 * 1000);
  entries.push(now);
  buckets.set(key, entries);
  return entries.length > 5;
}

async function verifyTurnstile(token, ip) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return process.env.NODE_ENV !== "production" && token === "development-bypass";
  const form = new FormData();
  form.set("secret", secret);
  form.set("response", token);
  if (ip) form.set("remoteip", ip);
  const result = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(5000),
  });
  const data = await result.json();
  return data.success === true;
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
  const rateKey = createHash("sha256").update(`${ip}:${email}`).digest("hex");
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
    context: typeof body.context === "object" && body.context ? body.context : {},
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
    captureServerEvent("lead_captured", submissionId, {
      source,
      team_size: row.team_size,
      vibe: row.vibe,
      occasion: row.occasion,
      recommendation_key: row.recommendation_key,
    });
    return NextResponse.json({ success: true, submissionId, recommendation });
  } catch (error) {
    console.error("Lead capture failed", { code: error?.code || "unknown", source });
    return response(503, "LEAD_SERVICE_UNAVAILABLE", "We couldn't save your details. Please retry.", true);
  }
}
