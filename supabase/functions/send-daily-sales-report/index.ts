import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { buildFamilyDemandSnapshot } from "../_shared/family-demand.ts";
import { authorizeWebhook, functionError, serviceClient } from "../_shared/runtime.ts";
import { sendViaResend } from "../_shared/email.ts";

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

function isMondayEastern() {
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short" }).format(new Date()) === "Mon";
}

function countBy<T>(rows: T[], key: (row: T) => string) {
  return rows.reduce<Record<string, number>>((counts, row) => {
    const value = key(row) || "unknown";
    counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {});
}

Deno.serve(async (request) => {
  const unauthorized = await authorizeWebhook(request, "DAILY_REPORT_WEBHOOK_SECRET");
  if (unauthorized) return unauthorized;
  const supabase = serviceClient();
  const { data: config, error: configError } = await supabase
    .from("system_config")
    .select("master_enabled,daily_report_enabled,daily_report_recipient,daily_prospecting_cap,outbound_auto_paused")
    .eq("id", true)
    .single();
  if (configError) return functionError("config_query_failed");
  if (!config.master_enabled || !config.daily_report_enabled) {
    return Response.json({ sent: false, skipped: true, reason: "daily_report_disabled" });
  }

  const recipient = config.daily_report_recipient || Deno.env.get("INTERNAL_NOTIFICATION_EMAIL");
  if (!recipient) return new Response("Daily report recipient is not configured", { status: 503 });
  const date = reportDate();
  const { data: existing } = await supabase.from("daily_reports").select("status").eq("report_date", date).maybeSingle();
  if (existing?.status === "sent") return Response.json({ sent: false, skipped: true, reason: "already_sent" });

  const since = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  const familySince = new Date(Date.now() - 30 * 24 * 60 * 60_000).toISOString();
  const siteUrl = (Deno.env.get("NEXT_PUBLIC_SITE_URL") || "https://www.teamtastic.events").replace(/\/$/, "");
  const [
    leadsResult, repliesResult, outboundResult, tasksResult, decisionsResult, dealsResult, stuckEnrollmentsResult,
    incidentsResult, hotLeadDraftsResult, revenueResult, outreachDraftsResult, marketingSnapshotsResult,
    familyLeadsResult, familyBookingsResult,
  ] = await Promise.all([
    supabase.from("leads").select("audience_type,context").gte("created_at", since),
    supabase.from("messages").select("classification,subject,received_at").eq("direction", "inbound").gte("created_at", since),
    supabase.from("messages").select("message_type,status").eq("direction", "outbound").gte("created_at", since),
    supabase.from("tasks").select("title,priority,due_at").in("status", ["open", "in_progress"]).order("due_at", { ascending: true }).limit(20),
    supabase.from("agent_log").select("agent_name,action,outcome,decision,created_at")
      .in("outcome", ["blocked", "skipped", "failed", "escalated"]).gte("created_at", since).order("created_at", { ascending: false }).limit(30),
    supabase.from("deals").select("id,title,stage,outcome,expected_value,currency,next_action,next_action_due_at,decision_date")
      .eq("outcome", "open").order("next_action_due_at", { ascending: true, nullsFirst: false }),
    supabase.from("sequence_enrollments").select("id,prospect_id,sequence_id,current_step,updated_at")
      .eq("status", "active").is("next_action_at", null).limit(20),
    supabase.from("production_incidents").select("id,category,severity,status,title,occurrences,last_seen_at")
      .neq("status", "resolved").in("severity", ["critical", "high"]).order("last_seen_at", { ascending: false }).limit(20),
    supabase.from("sales_response_drafts").select("id,response_type,recipient_email,created_at")
      .eq("status", "draft").order("created_at", { ascending: false }).limit(20),
    supabase.from("deal_payments").select("amount,currency,paid_at").gte("paid_at", since),
    supabase.from("outreach_drafts").select("id,prospect_id,subject,created_at")
      .eq("status", "review").order("created_at", { ascending: false }).limit(20),
    supabase.from("marketing_performance_snapshots").select("platform,snapshot_date,metrics,error")
      .order("snapshot_date", { ascending: false }).limit(12),
    supabase.from("leads")
      .select("id,audience_type,occasion,preferred_event_date,lead_score,landing_page,status,context,created_at")
      .in("audience_type", ["family", "friends", "other_private_event"])
      .gte("created_at", familySince).limit(500),
    supabase.from("bookings").select("lead_id,status").gte("created_at", familySince).limit(500),
  ]);
  const queryError = leadsResult.error || repliesResult.error || outboundResult.error || tasksResult.error
    || decisionsResult.error || dealsResult.error || stuckEnrollmentsResult.error
    || incidentsResult.error || hotLeadDraftsResult.error || revenueResult.error || outreachDraftsResult.error
    || marketingSnapshotsResult.error || familyLeadsResult.error || familyBookingsResult.error;
  if (queryError) return functionError("report_query_failed");

  const replies = repliesResult.data || [];
  const leads = (leadsResult.data || []).filter((lead) => lead.context?.synthetic_test !== true);
  const outbound = outboundResult.data || [];
  const tasks = tasksResult.data || [];
  const decisions = decisionsResult.data || [];
  const deals = dealsResult.data || [];
  const stuckEnrollments = stuckEnrollmentsResult.data || [];
  const incidents = incidentsResult.data || [];
  const hotLeadDrafts = hotLeadDraftsResult.data || [];
  const revenuePayments = revenueResult.data || [];
  const outreachDrafts = outreachDraftsResult.data || [];
  const seenMarketingPlatforms = new Set<string>();
  const marketingSnapshots = (marketingSnapshotsResult.data || []).filter((row) => {
    if (seenMarketingPlatforms.has(row.platform)) return false;
    seenMarketingPlatforms.add(row.platform);
    return true;
  });
  const replyCounts = countBy(replies, (row) => row.classification || "unknown");
  const sentCounts = countBy(outbound.filter((row) => row.status === "sent"), (row) => row.message_type);
  const leadAudienceCounts = countBy(leads, (row) => row.audience_type || "corporate");
  const privateLeadCount = (leadAudienceCounts.family || 0) + (leadAudienceCounts.friends || 0) + (leadAudienceCounts.other_private_event || 0);
  const familyDemand = buildFamilyDemandSnapshot({
    leads: familyLeadsResult.data || [],
    bookings: familyBookingsResult.data || [],
  });
  const now = Date.now();
  const pipelineValue = deals.reduce((sum, deal) => sum + Number(deal.expected_value || 0), 0);
  const revenueByCurrency = revenuePayments.reduce<Record<string, number>>((totals, payment) => {
    const currency = String(payment.currency || "usd").toUpperCase();
    totals[currency] = (totals[currency] || 0) + Number(payment.amount || 0);
    return totals;
  }, {});
  const subject = `Teamtastic sales report — ${date}`;

  const list = (items: string[], empty: string) => items.length
    ? `<ul>${items.map((item) => `<li>${item}</li>`).join("")}</ul>`
    : `<p>${empty}</p>`;

  // Weekly, not daily, to match the existing Monday-only learning-recommendations cadence
  // and avoid noise at the low volume this milestone caps sending to.
  let deliverabilityHtml = "";
  if (isMondayEastern()) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60_000).toISOString();
    const { data: deliverability } = await supabase.rpc("check_outbound_deliverability");
    const { data: contactedProspects } = await supabase.from("messages").select("prospect_id")
      .eq("direction", "outbound").eq("message_type", "prospecting").gte("created_at", sevenDaysAgo);
    const contactedIds = [...new Set((contactedProspects || []).map((row) => row.prospect_id).filter(Boolean))];
    let replyCount = 0;
    if (contactedIds.length) {
      const { count } = await supabase.from("messages").select("id", { count: "exact", head: true })
        .eq("direction", "inbound").in("prospect_id", contactedIds).gte("received_at", sevenDaysAgo);
      replyCount = count || 0;
    }
    deliverabilityHtml = `
      <h2>Outbound deliverability (7 days)</h2>
      <ul>
        <li>Sent: ${deliverability?.sent_count ?? 0}</li>
        <li>Bounced: ${deliverability?.bounce_count ?? 0} (${(((deliverability?.bounce_rate ?? 0) as number) * 100).toFixed(1)}%)</li>
        <li>Complained: ${deliverability?.complaint_count ?? 0} (${(((deliverability?.complaint_rate ?? 0) as number) * 100).toFixed(1)}%)</li>
        <li>Replies: ${replyCount}</li>
        <li>Daily cap: ${config.daily_prospecting_cap ?? "unknown"}</li>
        <li><strong>${config.outbound_auto_paused ? `PAUSED — auto-paused after a bounce/complaint threshold breach. Review before resuming in <a href="${siteUrl}/office/settings">/office/settings</a>.` : "Not paused."}</strong></li>
      </ul>
    `;
  }
  const html = `
    <h1>Teamtastic daily sales report</h1>
    <p><strong>Reporting window:</strong> previous 24 hours</p>
    <h2>Activity</h2>
    <ul>
      <li>New inbound leads: ${leads.length}</li>
      <li>Corporate leads: ${leadAudienceCounts.corporate || 0}</li>
      <li>Family / private-event leads: ${privateLeadCount}</li>
      <li>Inbound replies: ${replies.length}</li>
      <li>Messages sent: ${outbound.filter((row) => row.status === "sent").length}</li>
    </ul>
    <h2>Replies by category</h2>
    ${list(Object.entries(replyCounts).map(([key, value]) => `${escapeHtml(key)}: ${value}`), "No replies received.")}
    <h2>Messages sent</h2>
    ${list(Object.entries(sentCounts).map(([key, value]) => `${escapeHtml(key)}: ${value}`), "No messages sent.")}
    <h2>Family demand (30 days)</h2>
    <ul>
      <li>Private-family inquiries: ${familyDemand.inquiries}</li>
      <li>Requested dates: ${familyDemand.date_requests}</li>
      <li>Qualified inquiries: ${familyDemand.qualified_inquiries}</li>
      <li>Confirmed bookings: ${familyDemand.confirmed_bookings}</li>
      <li>Strongest occasion: ${familyDemand.strongest_occasion ? `${escapeHtml(familyDemand.strongest_occasion.name)} (${familyDemand.strongest_occasion.count})` : "Not enough data yet"}</li>
      <li>Strongest page: ${familyDemand.strongest_landing_page ? `${escapeHtml(familyDemand.strongest_landing_page.name)} (${familyDemand.strongest_landing_page.count})` : "Not enough data yet"}</li>
      <li>Requested dates in the next 14 days: ${familyDemand.upcoming_date_requests.length}</li>
    </ul>
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
    <h2>Revenue (24h)</h2>
    ${list(Object.entries(revenueByCurrency).map(([currency, amount]) => `${escapeHtml(currency)} ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} across ${revenuePayments.filter((payment) => String(payment.currency || "usd").toUpperCase() === currency).length} payment(s)`), "No payments received.")}
    <h2>Production incidents</h2>
    <p><a href="${siteUrl}/office/incidents">Review incidents →</a></p>
    ${list(incidents.map((incident) => `<strong>${escapeHtml(incident.severity)}</strong>: ${escapeHtml(incident.title || incident.category)} (${escapeHtml(incident.occurrences)}x, last seen ${escapeHtml(incident.last_seen_at)})`), "No open critical/high incidents.")}
    <h2>Hot leads needing reply</h2>
    <p><a href="${siteUrl}/office/respond">Review drafts →</a></p>
    ${list(hotLeadDrafts.map((draft) => `${escapeHtml(draft.response_type)}: ${escapeHtml(draft.recipient_email)} — drafted ${escapeHtml(draft.created_at)}`), "No drafts waiting.")}
    <h2>Outreach drafts awaiting approval</h2>
    ${list(outreachDrafts.map((draft) => `<a href="${siteUrl}/office/prospects/${escapeHtml(draft.prospect_id)}">${escapeHtml(draft.subject || "(no subject)")}</a> — drafted ${escapeHtml(draft.created_at)}`), "No drafts awaiting approval.")}
    <h2>Marketing platforms</h2>
    <p><a href="${siteUrl}/office/command-center">Review Command Center →</a></p>
    ${list(marketingSnapshots.map((row) => `<strong>${escapeHtml(row.platform.replaceAll("_", " "))}</strong>: ${row.error ? `last sync failed — ${escapeHtml(row.error)}` : `synced ${escapeHtml(row.snapshot_date)}`}`), "No marketing platform (Google Analytics, Search Console, Google Ads, Meta Ads) is connected yet — read-only reporting only, no spend or campaign control.")}
    <h2>What needs Michael</h2>
    ${list(tasks.map((task) => `<strong>${escapeHtml(task.priority)}</strong>: ${escapeHtml(task.title)}${task.due_at ? ` — due ${escapeHtml(task.due_at)}` : ""}`), "No open tasks.")}
    <h2>What the system chose not to do</h2>
    ${list([
      ...decisions.map((decision) => `<strong>${escapeHtml(decision.outcome)}</strong>: ${escapeHtml(decision.agent_name)} / ${escapeHtml(decision.action)} — ${escapeHtml(JSON.stringify(decision.decision || {}))}`),
      ...stuckEnrollments.map((enrollment) => `<strong>ESCALATED</strong>: active sequence enrollment ${escapeHtml(enrollment.id)} has no next action (step ${escapeHtml(enrollment.current_step)})`),
    ], "No blocked, skipped, failed, escalated, or stranded actions.")}
    ${deliverabilityHtml}
  `;
  const summary = {
    new_leads: leads.length,
    new_leads_by_audience: leadAudienceCounts,
    replies: replyCounts,
    sent: sentCounts,
    open_tasks: tasks.length,
    exceptions: decisions.length,
    stuck_sequence_enrollments: stuckEnrollments.length,
    open_deals: deals.length,
    pipeline_value: pipelineValue,
    open_incidents: incidents.length,
    hot_lead_drafts: hotLeadDrafts.length,
    revenue_24h: revenueByCurrency,
    pending_outreach_drafts: outreachDrafts.length,
    marketing_platforms_connected: marketingSnapshots.filter((row) => !row.error).map((row) => row.platform),
    family_demand: familyDemand,
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

  const result = await sendViaResend(supabase, {
    messageType: "internal_notification",
    recipient,
    idempotencyKey: `daily-sales-report/${date}`,
    from: Deno.env.get("RESEND_FROM_EMAIL"),
    to: recipient,
    subject,
    html,
  });
  if (!result.reserved) {
    await supabase.from("daily_reports").update({
      status: "skipped",
      last_error: result.reason || "reservation_blocked",
    }).eq("report_date", date);
    return Response.json({ sent: false, skipped: true, reason: result.reason || "reservation_failed" });
  }

  try {
    await supabase.from("daily_reports").update({
      status: result.sent ? "sent" : "failed",
      provider_message_id: result.providerMessageId,
      last_error: result.reason,
      sent_at: result.sent ? new Date().toISOString() : null,
    }).eq("report_date", date);
    if (!result.sent) return new Response("Report delivery failed", { status: 502 });
    return Response.json({ sent: true, report_date: date });
  } catch (error) {
    await supabase.from("daily_reports").update({ status: "failed", last_error: String(error).slice(0, 1000) }).eq("report_date", date);
    return new Response("Report delivery failed", { status: 500 });
  }
});
