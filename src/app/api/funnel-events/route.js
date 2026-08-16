import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import { hashKey, RATE_LIMIT_TIERS, rateLimited } from "@/lib/server/rate-limit";

const EVENTS = new Set(["landing_page_viewed","page_engaged","concierge_modal_opened","quiz_started","lead_submit_attempted","lead_captured","lead_capture_failed","pricing_cta_clicked","deposit_cta_clicked","booking_call_clicked","holiday_checklist_downloaded","free_game_clicked"]);
const PROPERTY_KEYS = new Set(["source","team_size","vibe","occasion","recommendation","tier_name","tier_cta","code","step","asset","experiment_id","experiment_variant"]);
const clean = (value,max=200) => typeof value === "string" ? value.trim().slice(0,max) : "";
const uuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || "");

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ success:false },{ status:400 }); }
  const eventName=clean(body.event,50), sessionId=clean(body.sessionId,36), landingPage=clean(body.landingPage,500);
  if (!EVENTS.has(eventName) || !uuid(sessionId) || !landingPage.startsWith("/")) return NextResponse.json({ success:false },{ status:400 });
  const ip=request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
  const rateKey=hashKey("funnel", ip, sessionId);
  if (rateLimited(rateKey, RATE_LIMIT_TIERS.frequent)) return NextResponse.json({ success:false },{ status:429 });
  const properties=Object.fromEntries(Object.entries(body.properties || {}).filter(([key,value])=>PROPERTY_KEYS.has(key) && ["string","number","boolean"].includes(typeof value)).map(([key,value])=>[key,typeof value==="string" ? value.slice(0,200) : value]));
  const row={ session_id:sessionId,submission_id:uuid(body.submissionId) ? body.submissionId:null,event_name:eventName,landing_page:landingPage,referrer_host:clean(body.referrerHost,255)||null,utm_source:clean(body.utm?.source)||null,utm_medium:clean(body.utm?.medium)||null,utm_campaign:clean(body.utm?.campaign)||null,utm_content:clean(body.utm?.content)||null,properties };
  const { error }=await getSupabaseAdmin().from("funnel_events").insert(row);
  return error ? NextResponse.json({ success:false },{ status:503 }) : NextResponse.json({ success:true },{ status:202 });
}
