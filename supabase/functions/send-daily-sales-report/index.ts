import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.106.1";

const escapeHtml = (value: unknown) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

function reportDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function countBy<T>(rows: T[], key: (row: T) => string) {
  return rows.reduce<Record<string, number>>((counts, row) => {
    const value = key(row) || "unknown";
    counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {});
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (request.headers.get("x-webhook-secret") !== Deno.env.get("DAILY_REPORT_WEBHOOK_SECRET")) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: config, error: configError } = await supabase
    .from("system_config")
    .select("master_enabled,daily_report_enabled,daily_report_recipient")
    .eq("id", true)
    .single();
  if (configError) return new Response(`Config failed: ${configError.message}`, { status: 500 });
  if (!config.master_enabled || !config.daily_report_enabled) {
    return Response.json({ sent: false, skipped: true, reason: "daily_report_disabled" });
  }

  const recipient = config.daily_report_recipient || Deno.env.get("INTERNAL_NOTIFICATION_EMAIL");
  if (!recipient) return new Response("Daily report recipient is not configured", { status: 503 });
  const date = reportDate();
  const { data: existing } = await supabase.from("daily_reports").select("status").eq("report_date", date).maybeSingle();
  if (existing?.status === "sent") return Response.json({ sent: false, skipped: true, reason: "already_sent" });

  const since = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  const [leadsResult, repliesResult, outboundResult, tasksResult, decisionsResult, dealsResult] = await Promise.all([
    supabase.from("leads").select("id", { count: "exact", head: true }).gte("created_at", since),
    supabase.from("messages").select("classification,subject,received_at").eq("direction", "inbound").gte("created_at", since),
    supabase.from("messages").select("message_type,status").eq("direction", "outbound").gte("created_at", since),
    supabase.from("tasks").select("title,priority,due_at").in("status", ["open", "in_progress"]).order("due_at", { ascending: true }).limit(20),
    supabase.from("agent_log").select("agent_name,action,outcome,decision,created_at")
      .in("outcome", ["blocked", "skipped", "failed", "escalated"]).gte("created_at", since).order("created_at", { ascending: false }).limit(30),
    supabase.from("deals").select("id,title,stage,outcome,expected_value,currency,next_action,next_action_due_at,decision_date")
      .eq("outcome", "open").order("next_action_due_at", { ascending: true, nullsFirst: false }),
  ]);
  const queryError = leadsResult.error || repliesResult.error || outboundResult.error || tasksResult.error || decisionsResult.error || dealsResult.error;
  if (queryError) return new Response(`Report query failed: ${queryError.message}`, { status: 500 });

  const replies = repliesResult.data || [];
  const outbound = outboundResult.data || [];
  const tasks = tasksResult.data || [];
  const decisions = decisionsResult.data || [];
  const deals = dealsResult.data || [];
  const replyCounts = countBy(replies, (row) => row.classification || "unknown");
  const sentCounts = countBy(outbound.filter((row) => row.status === "sent"), (row) => row.message_type);
  const now = Date.now();
  const pipelineValue = deals.reduce((sum, deal) => sum + Number(deal.expected_value || 0), 0);
  const subject = `Teamtastic sales report — ${date}`;

  const list = (items: string[], empty: string) => items.length
    ? `<ul>${items.map((item) => `<li>${item}</li>`).join("")}</ul>`
    : `<p>${empty}</p>`;
  const html = `
    <h1>Teamtastic daily sales report</h1>
    <p><strong>Reporting window:</strong> previous 24 hours</p>
    <h2>Activity</h2>
    <ul>
      <li>New inbound leads: ${leadsResult.count || 0}</li>
      <li>Inbound replies: ${replies.length}</li>
      <li>Messages sent: ${outbound.filter((row) => row.status === "sent").length}</li>
    </ul>
    <h2>Replies by category</h2>
    ${list(Object.entries(replyCounts).map(([key, value]) => `${escapeHtml(key)}: ${value}`), "No replies received.")}
    <h2>Messages sent</h2>
    ${list(Object.entries(sentCounts).map(([key, value]) => `${escapeHtml(key)}: ${value}`), "No messages sent.")}
    <h2>Pipeline</h2>
    <p><strong>Open deals:</strong> ${deals.length}<br><strong>Known pipeline value:</strong> $${pipelineValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
    ${list(deals.map((deal) => {
      const overdue = deal.next_action_due_at && new Date(deal.next_action_due_at).getTime() < now;
      const value = deal.expected_value == null
        ? "value not set"
        : `${String(deal.currency || "usd").toUpperCase()} ${Number(deal.expected_value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      return `<strong>${escapeHtml(deal.title)}</strong> — ${escapeHtml(deal.stage.replaceAll("_", " "))} — ${escapeHtml(value)}` +
        `${deal.next_action ? `<br>Next: ${escapeHtml(deal.next_action)}` : "<br>Next action not set"}` +
        `${deal.next_action_due_at ? ` — ${overdue ? "<strong>OVERDUE</strong> " : ""}due ${escapeHtml(deal.next_action_due_at)}` : ""}` +
        `${deal.decision_date ? `<br>Decision date: ${escapeHtml(deal.decision_date)}` : ""}`;
    }), "No open deals.")}
    <h2>What needs Michael</h2>
    ${list(tasks.map((task) => `<strong>${escapeHtml(task.priority)}</strong>: ${escapeHtml(task.title)}${task.due_at ? ` — due ${escapeHtml(task.due_at)}` : ""}`), "No open tasks.")}
    <h2>What the system chose not to do</h2>
    ${list(decisions.map((decision) => `<strong>${escapeHtml(decision.outcome)}</strong>: ${escapeHtml(decision.agent_name)} / ${escapeHtml(decision.action)} — ${escapeHtml(JSON.stringify(decision.decision || {}))}`), "No blocked, skipped, failed, or escalated actions.")}
  `;
  const summary = {
    new_leads: leadsResult.count || 0,
    replies: replyCounts,
    sent: sentCounts,
    open_tasks: tasks.length,
    exceptions: decisions.length,
    open_deals: deals.length,
    pipeline_value: pipelineValue,
  };

  await supabase.from("daily_reports").upsert({
    report_date: date,
    status: "draft",
    recipient,
    subject,
    body_html: html,
    summary,
    last_error: null,
  }, { onConflict: "report_date" });

  const { data: reservation, error: reservationError } = await supabase.rpc("reserve_email_send", {
    p_message_type: "internal_notification",
    p_recipient: recipient,
  });
  if (reservationError || reservation?.allowed !== true) {
    await supabase.from("daily_reports").update({
      status: "skipped",
      last_error: reservationError?.message || reservation?.reason || "reservation_blocked",
    }).eq("report_date", date);
    return Response.json({ sent: false, skipped: true, reason: reservation?.reason || "reservation_failed" });
  }

  try {
    const mail = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: Deno.env.get("RESEND_FROM_EMAIL"),
        to: [recipient],
        subject,
        html,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const result = await mail.json().catch(() => ({}));
    await supabase.rpc("record_email_send_result", { p_message_type: "internal_notification", p_sent: mail.ok });
    await supabase.from("daily_reports").update({
      status: mail.ok ? "sent" : "failed",
      provider_message_id: result.id || null,
      last_error: mail.ok ? null : JSON.stringify(result).slice(0, 1000),
      sent_at: mail.ok ? new Date().toISOString() : null,
    }).eq("report_date", date);
    if (!mail.ok) return new Response("Report delivery failed", { status: 502 });
    return Response.json({ sent: true, report_date: date });
  } catch (error) {
    await supabase.rpc("record_email_send_result", { p_message_type: "internal_notification", p_sent: false });
    await supabase.from("daily_reports").update({ status: "failed", last_error: String(error).slice(0, 1000) }).eq("report_date", date);
    return new Response("Report delivery failed", { status: 500 });
  }
});
