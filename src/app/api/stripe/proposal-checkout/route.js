import Stripe from "stripe";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import { PRODUCT_KEYS } from "@/lib/products";
import { hashKey } from "@/lib/server/rate-limit";

export const runtime = "nodejs";

export async function GET(request) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return new Response("Checkout is not configured", { status: 503 });
  }
  const token = new URL(request.url).searchParams.get("token") || "";
  if (token.length < 32) return new Response("Invalid payment link", { status: 400 });

  const tokenHash = hashKey(token);
  const db = getSupabaseAdmin();
  const { data: paymentRequest } = await db.from("payment_requests")
    .select("*,proposals(id,recipient_email,package_name,status)")
    .eq("public_token_hash", tokenHash)
    .maybeSingle();
  if (!paymentRequest) return new Response("Payment link not found", { status: 404 });
  if (!["active", "checkout_created"].includes(paymentRequest.status)
      || new Date(paymentRequest.expires_at) <= new Date()) {
    return new Response("This payment link has expired or was already used", { status: 410 });
  }

  const proposal = Array.isArray(paymentRequest.proposals)
    ? paymentRequest.proposals[0]
    : paymentRequest.proposals;
  if (!proposal || proposal.status === "rejected") {
    return new Response("Proposal is no longer payable", { status: 410 });
  }
  if (paymentRequest.deal_id) {
    const { data: deal } = await db.from("deals").select("prospect_id").eq("id", paymentRequest.deal_id).maybeSingle();
    if (deal?.prospect_id) {
      const [{ data: datedLead }, { data: hold }] = await Promise.all([
        db.from("leads").select("id").eq("prospect_id", deal.prospect_id).not("preferred_event_date", "is", null).limit(1).maybeSingle(),
        db.from("event_capacity_holds").select("id").eq("deal_id", paymentRequest.deal_id).in("status", ["tentative", "confirmed"]).or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`).limit(1).maybeSingle(),
      ]);
      if (datedLead && !hold) return new Response("The requested event date must be reconfirmed before payment. Please contact Teamtastic.", { status: 409 });
    }
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2026-06-24.dahlia",
  });
  const origin = (process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin).replace(/\/$/, "");
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: proposal.recipient_email,
    success_url: `${origin}/?payment=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/?payment=cancelled`,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: paymentRequest.currency,
        unit_amount: paymentRequest.amount_due_now_cents,
        product_data: { name: proposal.package_name },
      },
    }],
    metadata: {
      product_key: PRODUCT_KEYS.DEPOSIT,
      payment_request_id: paymentRequest.id,
      proposal_id: proposal.id,
      deal_id: paymentRequest.deal_id || "",
      payment_kind: paymentRequest.payment_kind,
      pricing_version: paymentRequest.pricing_version,
    },
  }, {
    idempotencyKey: `payment-request/${paymentRequest.id}`,
  });

  await db.from("payment_requests").update({
    stripe_checkout_session_id: session.id,
    status: "checkout_created",
    updated_at: new Date().toISOString(),
  }).eq("id", paymentRequest.id);
  return Response.redirect(session.url, 303);
}
