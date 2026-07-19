import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.106.1";

const escapeHtml = (value: unknown) => String(value ?? "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

// Mirrors src/lib/recommendations.js — keep title/games in sync if that file changes.
const RECS: Record<string, { title: string; games: string[] }> = {
  competitive: { title: "Lightning Feud + Survey Showdown", games: ["Lightning Feud", "Survey Showdown"] },
  social: { title: "Superlatives + The Hot Seat", games: ["Superlatives", "The Hot Seat"] },
  collaborative: { title: "Mystery Box + Focus Frenzy", games: ["Mystery Box", "Focus Frenzy"] },
  icebreaker: { title: "Think Fast + Online Office Games", games: ["Think Fast", "Online Office Games"] },
};

// Ascending order matters — later steps assume earlier ones already fired.
const STEPS = [
  { type: "nurture_day1", minAgeHours: 24 },
  { type: "nurture_day3", minAgeHours: 72 },
  { type: "nurture_day7", minAgeHours: 168 },
] as const;

// Don't resurrect leads with a multi-week-old sequence if a run was missed.
const MAX_AGE_HOURS = 30 * 24;

function depositLink(lead: Record<string, unknown>) {
  const base = Deno.env.get("STRIPE_DEPOSIT_URL");
  if (!base) return null;
  const params = new URLSearchParams({
    prefilled_email: String(lead.email ?? ""),
    client_reference_id: String(lead.submission_id ?? ""),
  });
  return `${base}?${params.toString()}`;
}

function buildEmail(step: string, lead: Record<string, unknown>) {
  const name = escapeHtml(lead.name);
  const link = depositLink(lead);
  const cta = link ? `<p><a href="${link}">Reserve your event — $200 deposit</a></p>` : "";

  if (step === "nurture_day1") {
    const rec = RECS[String(lead.recommendation_key)] || RECS.competitive;
    return {
      subject: `Your Teamtastic package: ${rec.title}`,
      html: `<h1>Hey ${name},</h1><p>Here's the package we put together for your team: <strong>${escapeHtml(rec.title)}</strong> (${rec.games.map(escapeHtml).join(", ")}). Built to get everyone involved &mdash; not just the loud ones.</p><p>Want to lock in a date? Michael handles the rest.</p>${cta}`,
    };
  }
  if (step === "nurture_day3") {
    return {
      subject: "More than another virtual trivia event",
      html: `<h1>Hey ${name},</h1><p>Most virtual team events feel like another meeting with trivia added. Yours won't: a Master Emcee turns the screen into a live game show, and the format is built so everyone plays &mdash; you never have to rescue the event.</p><p>Still deciding? Just reply &mdash; happy to answer questions before you book.</p>${cta}`,
    };
  }
  // nurture_day7
  return {
    subject: "Should I hold your game show idea?",
    html: `<h1>Hey ${name},</h1><p>I know event planning has a way of sliding down the to-do list. If your team gathering is still taking shape, the package we mapped out is a $200 deposit away from a locked-in date &mdash; and if the timing isn't right, just reply and tell me. No hard feelings, no follow-up avalanche.</p>${cta}`,
  };
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (request.headers.get("x-webhook-secret") !== Deno.env.get("NURTURE_WEBHOOK_SECRET")) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: leads, error } = await supabase
    .from("leads")
    .select("*")
    .eq("lead_source", "event_quiz")
    .lte("created_at", new Date(Date.now() - STEPS[0].minAgeHours * 3600_000).toISOString())
    .gte("created_at", new Date(Date.now() - MAX_AGE_HOURS * 3600_000).toISOString());

  if (error) return new Response(`Query failed: ${error.message}`, { status: 500 });
  if (!leads?.length) return Response.json({ processed: 0, sent: 0 });

  let sent = 0;
  for (const lead of leads) {
    const ageHours = (Date.now() - new Date(lead.created_at as string).getTime()) / 3600_000;

    const { data: paid } = await supabase
      .from("stripe_events")
      .select("id")
      .eq("lead_id", lead.id)
      .limit(1)
      .maybeSingle();
    if (paid) continue; // already converted — stop the sequence

    const { data: deliveries } = await supabase
      .from("notification_deliveries")
      .select("notification_type,status,attempts")
      .eq("lead_id", lead.id)
      .in("notification_type", STEPS.map((s) => s.type));
    const byType = new Map((deliveries || []).map((d) => [d.notification_type, d]));
    const sentTypes = new Set((deliveries || []).filter((d) => d.status === "sent").map((d) => d.notification_type));

    for (const [index, step] of STEPS.entries()) {
      if (ageHours < step.minAgeHours) break; // steps are age-ordered; none further can be due yet
      if (sentTypes.has(step.type)) continue;
      const priorStepsSent = STEPS.slice(0, index).every((s) => sentTypes.has(s.type));
      if (!priorStepsSent) continue; // keep the sequence in order across missed runs

      const email = buildEmail(step.type, lead);
      const existing = byType.get(step.type);
      const { data: reservation, error: reservationError } = await supabase.rpc("reserve_email_send", {
        p_message_type: "nurture",
        p_recipient: lead.email,
      });
      if (reservationError || reservation?.allowed !== true) {
        await supabase.from("agent_log").insert({
          agent_name: "inbound-nurture",
          action: `send_${step.type}`,
          outcome: "blocked",
          prospect_id: lead.prospect_id || null,
          decision: { lead_id: lead.id, reservation, error: reservationError?.message || null },
        });
        break;
      }
      const mail = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: Deno.env.get("RESEND_FROM_EMAIL"),
          to: [lead.email],
          reply_to: Deno.env.get("INTERNAL_NOTIFICATION_EMAIL"),
          subject: email.subject,
          html: email.html,
        }),
      });
      const result = await mail.json().catch(() => ({}));
      await supabase.rpc("record_email_send_result", {
        p_message_type: "nurture",
        p_sent: mail.ok,
      });
      await supabase.from("notification_deliveries").upsert({
        lead_id: lead.id,
        notification_type: step.type,
        status: mail.ok ? "sent" : "failed",
        provider_message_id: result.id || null,
        attempts: (existing?.attempts || 0) + 1,
        last_error: mail.ok ? null : JSON.stringify(result).slice(0, 1000),
        updated_at: new Date().toISOString(),
      }, { onConflict: "lead_id,notification_type" });
      await supabase.from("messages").insert({
        prospect_id: lead.prospect_id || null,
        direction: "outbound",
        message_type: "nurture",
        provider: "resend",
        provider_message_id: result.id || null,
        from_address: Deno.env.get("RESEND_FROM_EMAIL") || "",
        to_addresses: [lead.email],
        subject: email.subject,
        body_html: email.html,
        status: mail.ok ? "sent" : "failed",
        sent_at: mail.ok ? new Date().toISOString() : null,
      });
      if (mail.ok) sent++;
      break; // only advance one step per lead per run
    }
  }

  return Response.json({ processed: leads.length, sent });
});
