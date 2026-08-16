import Stripe from "stripe";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import { calculateHostedPrice, fixedDepositPrice, PRICING_VERSION } from "@/lib/server/pricing";
import { PRODUCT_KEYS } from "@/lib/products";
import { validTimeZone, zonedWallTimeToUtc } from "@/lib/server/booking-time";
import { hashKey } from "@/lib/server/rate-limit";
import { clean } from "@/lib/server/validation";

export const runtime = "nodejs";

function siteOrigin(request) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, "");
  return new URL(request.url).origin;
}

function normalizedTime(value) {
  const match=String(value||"").trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if(!match)return null;
  let hour=Number(match[1]); const meridiem=match[3]?.toUpperCase();
  if(meridiem==="PM"&&hour<12)hour+=12; if(meridiem==="AM"&&hour===12)hour=0;
  return hour<=23?`${String(hour).padStart(2,"0")}:${match[2]}`:null;
}

export async function POST(request) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "checkout_not_configured" }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const submissionId = clean(body.submissionId, 50);
  const paymentKind = clean(body.paymentKind, 40);
  if (!submissionId || !["estimated_event", "corporate_deposit", "family_deposit"].includes(paymentKind)) {
    return NextResponse.json({ error: "invalid_checkout_request" }, { status: 400 });
  }

  const db = getSupabaseAdmin();
  const { data: lead } = await db.from("leads")
    .select("id,submission_id,email,name,context,prospect_id,preferred_event_date,event_timezone,preferred_time")
    .eq("submission_id", submissionId)
    .maybeSingle();
  if (!lead) return NextResponse.json({ error: "lead_not_found" }, { status: 404 });

  let capacityReservation=null;
  const eventTime=normalizedTime(lead.preferred_time);
  if (paymentKind === "corporate_deposit" && lead.preferred_event_date && eventTime && validTimeZone(lead.event_timezone)) {
    const startsAt=zonedWallTimeToUtc(lead.preferred_event_date,eventTime,lead.event_timezone);
    const endsAt=new Date(startsAt.getTime()+60*60000);
    const {data:capacity,error:capacityError}=await db.rpc("check_event_capacity",{p_starts_at:startsAt.toISOString(),p_ends_at:endsAt.toISOString()});
    if(capacityError||!capacity?.available)return NextResponse.json({error:"event_capacity_unavailable",reason:capacity?.reason||"capacity_check_failed"},{status:409});
    capacityReservation={capacity,startsAt,endsAt};
  }

  let amountCents;
  let label;
  let pricingInputs = {};
  if (paymentKind === "estimated_event") {
    const context = lead.context || {};
    const priced = calculateHostedPrice({
      players: context.estimator_players,
      packageType: context.estimator_package,
      addOns: context.estimator_add_ons,
    });
    amountCents = priced.amountCents;
    pricingInputs = priced.normalizedInputs;
    label = `${priced.normalizedInputs.packageType === "premium" ? "Premium" : "Core"} Hosted Teamtastic Event`;
  } else {
    const fixed = fixedDepositPrice(paymentKind);
    amountCents = fixed.amountCents;
    label = fixed.label;
  }

  const fingerprint = hashKey(JSON.stringify({
    leadId: lead.id,
    paymentKind,
    amountCents,
    pricingInputs,
    pricingVersion: PRICING_VERSION,
  }));

  const { data: existing } = await db.from("payment_requests")
    .select("id,stripe_checkout_session_id,status")
    .eq("fingerprint", fingerprint)
    .in("status", ["active", "checkout_created"])
    .maybeSingle();

  let paymentRequest = existing;
  if (!paymentRequest) {
    const inserted = await db.from("payment_requests").insert({
      lead_id: lead.id,
      source: paymentKind === "estimated_event" ? "pricing_quiz" : paymentKind,
      payment_kind: paymentKind === "estimated_event" ? "full_payment" : "deposit",
      quoted_total_cents: amountCents,
      amount_due_now_cents: amountCents,
      currency: "usd",
      pricing_version: PRICING_VERSION,
      pricing_inputs: pricingInputs,
      fingerprint,
      status: "active",
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    }).select("id,stripe_checkout_session_id,status").single();
    if (inserted.error) {
      return NextResponse.json({ error: "payment_request_failed" }, { status: 500 });
    }
    paymentRequest = inserted.data;
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2026-06-24.dahlia",
  });
  const origin = siteOrigin(request);
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: lead.email,
    client_reference_id: lead.submission_id,
    success_url: `${origin}/?payment=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/?payment=cancelled`,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: amountCents,
        product_data: { name: label },
      },
    }],
    metadata: {
      product_key: PRODUCT_KEYS.DEPOSIT,
      payment_request_id: paymentRequest.id,
      lead_id: lead.id,
      submission_id: lead.submission_id,
      payment_kind: paymentKind,
      pricing_version: PRICING_VERSION,
    },
  }, {
    idempotencyKey: `payment-request/${paymentRequest.id}`,
  });

  await db.from("payment_requests").update({
    stripe_checkout_session_id: session.id,
    status: "checkout_created",
  }).eq("id", paymentRequest.id);

  if(capacityReservation){
    const {data:existingHold}=await db.from("event_capacity_holds").select("id").eq("lead_id",lead.id).in("status",["tentative","confirmed"]).or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`).limit(1).maybeSingle();
    if(!existingHold)await db.from("event_capacity_holds").insert({host_id:capacityReservation.capacity.host_id,lead_id:lead.id,prospect_id:lead.prospect_id||null,starts_at:capacityReservation.startsAt.toISOString(),ends_at:capacityReservation.endsAt.toISOString(),status:"tentative",expires_at:new Date(Date.now()+24*3600000).toISOString(),note:"Automatic hold created for deposit checkout",created_by:"checkout"});
  }

  return NextResponse.json({ url: session.url });
}
