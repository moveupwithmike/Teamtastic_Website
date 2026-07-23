import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.106.1";

const DOMAIN_COOLDOWN_DAYS = 14;
const BATCH_SIZE = 10;

function easternNow() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York", weekday: "short", hour: "2-digit", hour12: false,
    }).formatToParts(new Date()).filter((p) => p.type !== "literal").map((p) => [p.type, p.value])
  );
  // hour12:false can format midnight as "24" in some runtimes — normalize back to 0.
  return { weekday: parts.weekday, hour: Number(parts.hour) % 24 };
}

function withinSendingWindow() {
  const { weekday, hour } = easternNow();
  return !["Sat", "Sun"].includes(weekday) && hour >= 9 && hour < 17;
}

function emailDomain(email: string) {
  return String(email || "").split("@")[1]?.toLowerCase() || null;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (request.headers.get("x-webhook-secret") !== Deno.env.get("SEND_APPROVED_OUTREACH_WEBHOOK_SECRET")) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: config, error: configError } = await supabase
    .from("system_config")
    .select("master_enabled,prospecting_enabled,outbound_auto_paused,prospecting_from_email,sequence_followups_enabled")
    .eq("id", true)
    .single();
  if (configError) return new Response(`Config failed: ${configError.message}`, { status: 500 });
  if (!config.master_enabled) return Response.json({ sent: 0, reason: "master_kill_switch" });
  if (!config.prospecting_enabled) return Response.json({ sent: 0, reason: "prospecting_disabled" });
  if (config.outbound_auto_paused) return Response.json({ sent: 0, reason: "outbound_auto_paused" });
  if (!config.prospecting_from_email) return Response.json({ sent: 0, reason: "from_address_not_configured" });
  if (!withinSendingWindow()) return Response.json({ sent: 0, reason: "outside_sending_window" });

  const { data: drafts, error: draftsError } = await supabase
    .from("outreach_drafts")
    .select("id,subject,body_text,prospect_id,approved_at,sequence_enrollment_id,sequence_step,prospects(id,email,email_normalized,status,company_id)")
    .eq("status", "approved")
    .order("approved_at", { ascending: true })
    .limit(BATCH_SIZE);
  if (draftsError) return new Response(`Query failed: ${draftsError.message}`, { status: 500 });
  if (!drafts?.length) return Response.json({ sent: 0, reason: "no_approved_drafts" });

  const domainCooldownSince = new Date(Date.now() - DOMAIN_COOLDOWN_DAYS * 86400_000).toISOString();
  let sent = 0;

  for (const draft of drafts) {
    const prospect = draft.prospects as Record<string, unknown> | null;
    if (!prospect?.email_normalized) {
      await supabase.from("agent_log").insert({
        agent_name: "send-approved-outreach", action: "send_outreach", outcome: "skipped",
        prospect_id: draft.prospect_id, decision: { draft_id: draft.id, reason: "missing_email" },
      });
      continue;
    }

    // Domain cooldown: don't land two cold emails at the same company within the window.
    let sameDomainProspectIds: string[] = [];
    if (prospect.company_id) {
      const { data: siblings } = await supabase.from("prospects").select("id")
        .eq("company_id", prospect.company_id as string).neq("id", prospect.id as string);
      sameDomainProspectIds = (siblings || []).map((p) => p.id);
    } else {
      const domain = emailDomain(prospect.email_normalized as string);
      if (domain) {
        const { data: siblings } = await supabase.from("prospects").select("id")
          .is("company_id", null).ilike("email_normalized", `%@${domain}`).neq("id", prospect.id as string);
        sameDomainProspectIds = (siblings || []).map((p) => p.id);
      }
    }
    if (sameDomainProspectIds.length) {
      const { data: recent } = await supabase.from("messages").select("id")
        .eq("direction", "outbound").eq("message_type", "prospecting")
        .in("prospect_id", sameDomainProspectIds).gte("created_at", domainCooldownSince).limit(1);
      if (recent?.length) {
        await supabase.from("agent_log").insert({
          agent_name: "send-approved-outreach", action: "send_outreach", outcome: "skipped",
          prospect_id: prospect.id, decision: { draft_id: draft.id, reason: "domain_cooldown" },
        });
        continue;
      }
    }

    const { data: reservation, error: reservationError } = await supabase.rpc("reserve_email_send", {
      p_message_type: "prospecting",
      p_recipient: prospect.email,
    });
    if (reservationError || reservation?.allowed !== true) {
      await supabase.from("agent_log").insert({
        agent_name: "send-approved-outreach", action: "send_outreach", outcome: "blocked",
        prospect_id: prospect.id, decision: { draft_id: draft.id, reservation, error: reservationError?.message || null },
      });
      break; // cap reached / disabled — no point trying the rest of the batch
    }

    const mail = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: config.prospecting_from_email,
        to: [prospect.email],
        reply_to: Deno.env.get("INTERNAL_NOTIFICATION_EMAIL"),
        subject: draft.subject,
        text: draft.body_text,
      }),
    });
    const result = await mail.json().catch(() => ({}));
    const success = mail.ok && !!result.id;
    await supabase.rpc("record_email_send_result", { p_message_type: "prospecting", p_sent: success });

    const sentAt = new Date().toISOString();

    // First successful send for a prospect with no enrollment yet starts the follow-up
    // sequence (if enabled). A draft that already has an enrollment id is itself a
    // follow-up drafted by draft-sequence-followups — just carry the link forward.
    let enrollmentId = draft.sequence_enrollment_id as string | null;
    if (success && !enrollmentId && config.sequence_followups_enabled) {
      const { data: sequence } = await supabase.from("sequences")
        .select("id").eq("name", "cold-outreach-followups-v1").maybeSingle();
      if (sequence) {
        const { data: enrollment } = await supabase.from("sequence_enrollments").insert({
          sequence_id: sequence.id,
          prospect_id: prospect.id,
          status: "active",
          current_step: 1,
          next_action_at: new Date(Date.now() + 3 * 86400_000).toISOString(),
        }).select("id").maybeSingle();
        enrollmentId = enrollment?.id || null;
      }
    }

    await supabase.from("messages").insert({
      prospect_id: prospect.id,
      sequence_enrollment_id: enrollmentId,
      direction: "outbound",
      message_type: "prospecting",
      provider: "resend",
      provider_message_id: result.id || null,
      from_address: config.prospecting_from_email,
      to_addresses: [prospect.email],
      subject: draft.subject,
      body_text: draft.body_text,
      status: success ? "sent" : "failed",
      sent_at: success ? sentAt : null,
    });

    await supabase.from("outreach_drafts").update(
      success
        ? { status: "sent", sent_at: sentAt, provider_message_id: result.id, send_error: null, sequence_enrollment_id: enrollmentId }
        : { status: "failed", send_error: JSON.stringify(result).slice(0, 1000) },
    ).eq("id", draft.id);

    if (success) {
      sent++;
      if (["new", "researching", "qualified"].includes(prospect.status as string)) {
        await supabase.from("prospects").update({ status: "contacted", last_outbound_at: sentAt }).eq("id", prospect.id as string);
      }
    }
  }

  return Response.json({ processed: drafts.length, sent });
});
