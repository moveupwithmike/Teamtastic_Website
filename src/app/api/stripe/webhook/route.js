import Stripe from "stripe";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import { captureServerEvent } from "@/lib/server/posthog";
import { classifyStripeSession, PRODUCTS, PRODUCT_KEYS } from "@/lib/products";

export const runtime = "nodejs";

async function notifyMichael(payment, lead) {
  const product = PRODUCTS[payment.product_key] || PRODUCTS[PRODUCT_KEYS.UNCLASSIFIED];
  const subject = lead
    ? `${product.name} received from ${lead.name}`
    : `${product.name} received — lead match needed`;
  const details = [
    `Product: ${product.name}`,
    `Amount: ${(payment.amount_total / 100).toFixed(2)} ${payment.currency.toUpperCase()}`,
    `Email: ${payment.customer_email || "Unavailable"}`,
    `Stripe session: ${payment.stripe_session_id}`,
    lead ? `Lead: ${lead.name} (${lead.company || "No company"})` : "No matching lead was found.",
  ].join("\n");

  const jobs = [];
  if (process.env.RESEND_API_KEY && process.env.INTERNAL_NOTIFICATION_EMAIL) {
    jobs.push(fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL,
        to: [process.env.INTERNAL_NOTIFICATION_EMAIL],
        subject,
        text: details,
      }),
    }));
  }
  const results = await Promise.allSettled(jobs);
  const failed = results.some((result) =>
    result.status === "rejected" || (result.status === "fulfilled" && !result.value.ok)
  );
  if (failed) {
    console.error("One or more deposit alerts failed", { session: payment.stripe_session_id });
  }
  return jobs.length > 0 && !failed;
}

export async function POST(request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!secret || !apiKey) return new Response("Stripe webhook is not configured", { status: 503 });

  const stripe = new Stripe(apiKey);
  const signature = request.headers.get("stripe-signature");
  let event;
  try {
    event = stripe.webhooks.constructEvent(await request.text(), signature, secret);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }
  if (event.type !== "checkout.session.completed") return new Response("Ignored", { status: 200 });

  const session = event.data.object;
  const productKey = classifyStripeSession(session);
  const product = PRODUCTS[productKey];
  const supabase = getSupabaseAdmin();
  const email = session.customer_details?.email?.trim().toLowerCase() || null;
  const submissionId = session.metadata?.submission_id || session.client_reference_id || null;

  const { data: duplicate } = await supabase
    .from("stripe_events")
    .select("*")
    .eq("stripe_event_id", event.id)
    .maybeSingle();
  if (duplicate) {
    if (duplicate.alert_status !== "sent") {
      let matchedLead = null;
      if (duplicate.lead_id) {
        matchedLead = (await supabase.from("leads").select("*").eq("id", duplicate.lead_id).maybeSingle()).data;
      }
      const sent = await notifyMichael(duplicate, matchedLead);
      await supabase.from("stripe_events").update({
        alert_status: sent ? "sent" : "failed",
        alert_attempts: (duplicate.alert_attempts || 0) + 1,
        alert_error: sent ? null : "One or more alert providers failed",
      }).eq("stripe_event_id", event.id);
      if (!sent) return new Response("Alert delivery failed", { status: 503 });
    }
    return new Response("Already processed", { status: 200 });
  }

  let lead = null;
  if (submissionId) {
    const result = await supabase.from("leads").select("*").eq("submission_id", submissionId).maybeSingle();
    lead = result.data;
  }
  if (!lead && email) {
    const result = await supabase
      .from("leads")
      .select("*")
      .eq("email_normalized", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    lead = result.data;
  }

  const payment = {
    stripe_event_id: event.id,
    stripe_session_id: session.id,
    lead_id: lead?.id || null,
    submission_id: lead?.submission_id || submissionId,
    customer_email: email,
    amount_total: session.amount_total || 0,
    currency: session.currency || "usd",
    payment_status: session.payment_status || "paid",
    checkout_mode: session.mode || null,
    payment_link_id: typeof session.payment_link === "string" ? session.payment_link : session.payment_link?.id || null,
    product_key: productKey,
    paid_at: new Date(event.created * 1000).toISOString(),
    matched: Boolean(lead),
  };
  const { error } = await supabase.from("stripe_events").insert(payment);
  if (error) {
    console.error("Stripe event persistence failed", { code: error.code, event: event.id });
    return new Response("Persistence failed", { status: 503 });
  }

  const [alertResult] = await Promise.allSettled([
    notifyMichael(payment, lead),
    captureServerEvent(product.analyticsEvent, lead?.submission_id || session.id, {
      matched: Boolean(lead),
      product_key: productKey,
      amount: payment.amount_total,
      currency: payment.currency,
      source: lead?.lead_source,
    }),
  ]);
  const alertSent = alertResult.status === "fulfilled" && alertResult.value === true;
  await supabase.from("stripe_events").update({
    alert_status: alertSent ? "sent" : "failed",
    alert_attempts: 1,
    alert_error: alertSent ? null : "One or more alert providers failed",
  }).eq("stripe_event_id", event.id);
  if (!alertSent) return new Response("Alert delivery failed", { status: 503 });
  return new Response("Processed", { status: 200 });
}
