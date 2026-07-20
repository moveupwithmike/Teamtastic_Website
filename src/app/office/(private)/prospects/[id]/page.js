import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import { Card, formatDate, formatMoney } from "../../../office-ui";

function TimelineItem({ date, label, title, detail, tone = "purple" }) {
  const colors = { purple: "bg-purple-400", green: "bg-emerald-400", gold: "bg-amber-400", red: "bg-red-400", blue: "bg-sky-400" };
  return <li className="relative pl-7"><span className={`absolute left-0 top-2 h-3 w-3 rounded-full ${colors[tone]}`} /><p className="text-xs uppercase tracking-wide text-slate-500">{label} · {formatDate(date)}</p><p className="mt-1 font-semibold">{title}</p>{detail && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-400">{detail}</p>}</li>;
}

export default async function ProspectDetail({ params }) {
  const { id } = await params;
  const db = getSupabaseAdmin();
  const { data: prospect } = await db.from("prospects").select("*").eq("id", id).maybeSingle();
  if (!prospect) notFound();
  const [companyResult, leadsResult, messagesResult, bookingsResult, tasksResult, dealsResult, logsResult, draftsResult, proposalsResult] = await Promise.all([
    prospect.company_id ? db.from("companies").select("id,name,domain,industry,employee_count_range").eq("id", prospect.company_id).maybeSingle() : Promise.resolve({ data: null }),
    db.from("leads").select("id,name,email,company,lead_source,status,team_size,vibe,occasion,recommendation_key,utm_source,utm_campaign,context,created_at").eq("prospect_id", id).order("created_at", { ascending: false }),
    db.from("messages").select("id,direction,message_type,from_address,to_addresses,subject,body_text,status,classification,sent_at,received_at,created_at").eq("prospect_id", id).order("created_at", { ascending: false }),
    db.from("bookings").select("id,name,email,company,starts_at,ends_at,status,zoom_join_url,source,created_at").eq("prospect_id", id).order("created_at", { ascending: false }),
    db.from("tasks").select("id,title,description,status,priority,due_at,source,created_at").eq("prospect_id", id).order("created_at", { ascending: false }),
    db.from("deals").select("id,title,stage,outcome,expected_value,currency,next_action,next_action_due_at,decision_date,lost_reason,package_name,budget_amount,call_outcome,call_notes,created_at,updated_at").eq("prospect_id", id).order("created_at", { ascending: false }),
    db.from("agent_log").select("id,agent_name,action,outcome,decision,error,created_at").eq("prospect_id", id).order("created_at", { ascending: false }).limit(100),
    db.from("outreach_drafts").select("id,subject,body_text,status,approval_notes,created_at,updated_at").eq("prospect_id", id).order("created_at", { ascending: false }),
    db.from("proposals").select("id,package_name,price,currency,expires_on,subject,status,sent_at,last_error,created_at").eq("prospect_id", id).order("created_at", { ascending: false }),
  ]);
  const deals = dealsResult.data || [];
  const dealIds = deals.map((d) => d.id);
  const { data: payments = [] } = dealIds.length ? await db.from("deal_payments").select("id,deal_id,amount,currency,payment_kind,paid_at").in("deal_id", dealIds) : { data: [] };
  const timeline = [
    ...(leadsResult.data || []).map((x) => ({ date: x.created_at, label: "Lead form", title: `${x.lead_source || "Website"} lead`, detail: [x.team_size && `Team: ${x.team_size}`, x.vibe && `Vibe: ${x.vibe}`, x.occasion && `Occasion: ${x.occasion}`, x.recommendation_key && `Recommendation: ${x.recommendation_key}`].filter(Boolean).join(" · "), tone: "blue" })),
    ...(messagesResult.data || []).map((x) => ({ date: x.received_at || x.sent_at || x.created_at, label: x.direction === "inbound" ? `Inbound email${x.classification ? ` — ${x.classification}` : ""}` : `Outbound email — ${x.status}`, title: x.subject || "No subject", detail: x.body_text, tone: x.direction === "inbound" ? "green" : "purple" })),
    ...(bookingsResult.data || []).map((x) => ({ date: x.starts_at, label: `Booking — ${x.status}`, title: `${formatDate(x.starts_at)} call`, detail: x.company, tone: "gold" })),
    ...(tasksResult.data || []).map((x) => ({ date: x.due_at || x.created_at, label: `Task — ${x.status}`, title: x.title, detail: x.description, tone: x.priority === "urgent" ? "red" : "gold" })),
    ...deals.map((x) => ({ date: x.updated_at, label: `Deal — ${x.stage.replaceAll("_", " ")}`, title: `${x.title} · ${formatMoney(x.expected_value, x.currency)}`, detail: [x.next_action, x.call_outcome && `Call: ${x.call_outcome}`, x.call_notes].filter(Boolean).join("\n"), tone: x.outcome === "lost" ? "red" : "purple" })),
    ...payments.map((x) => ({ date: x.paid_at, label: "Payment", title: `${formatMoney(x.amount, x.currency)} ${x.payment_kind}`, detail: "Stripe payment matched to this deal", tone: "green" })),
    ...(draftsResult.data || []).map((x) => ({ date: x.updated_at, label: `Outreach draft — ${x.status}`, title: x.subject, detail: x.approval_notes, tone: "blue" })),
    ...(proposalsResult.data || []).map((x) => ({ date: x.sent_at || x.created_at, label: `Proposal — ${x.status}`, title: `${x.package_name} · ${formatMoney(x.price, x.currency)}`, detail: x.subject, tone: "gold" })),
    ...(logsResult.data || []).map((x) => ({ date: x.created_at, label: `${x.agent_name} — ${x.outcome}`, title: x.action, detail: x.error || x.decision?.reason, tone: ["failed", "blocked", "escalated"].includes(x.outcome) ? "red" : "purple" })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  return <div className="space-y-6">
    <Link href="/office/prospects" className="text-sm text-purple-300">← Back to prospects</Link>
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-3xl font-bold">{prospect.full_name || prospect.email}</h2><p className="mt-1 text-slate-400">{prospect.email}{prospect.job_title ? ` · ${prospect.job_title}` : ""}</p></div><span className="rounded-full bg-purple-500/10 px-4 py-2 text-sm text-purple-300">{prospect.status.replaceAll("_", " ")} · score {prospect.score ?? "—"}</span></div>
    <div className="grid gap-5 lg:grid-cols-3">
      <Card title="Contact"><dl className="space-y-2 text-sm"><div><dt className="text-slate-500">Email</dt><dd>{prospect.email || "—"}</dd></div><div><dt className="text-slate-500">Phone</dt><dd>{prospect.phone || "—"}</dd></div><div><dt className="text-slate-500">Source</dt><dd>{prospect.source}</dd></div></dl></Card>
      <Card title="Company"><dl className="space-y-2 text-sm"><div><dt className="text-slate-500">Name</dt><dd>{companyResult.data?.name || "—"}</dd></div><div><dt className="text-slate-500">Domain</dt><dd>{companyResult.data?.domain || "—"}</dd></div><div><dt className="text-slate-500">Size</dt><dd>{companyResult.data?.employee_count_range || "—"}</dd></div></dl></Card>
      <Card title="Open work"><p className="text-3xl font-bold">{(tasksResult.data || []).filter((t) => ["open", "in_progress"].includes(t.status)).length}</p><p className="text-sm text-slate-400">open tasks</p><p className="mt-3 text-3xl font-bold">{deals.filter((d) => d.outcome === "open").length}</p><p className="text-sm text-slate-400">open deals</p></Card>
    </div>
    <Card title="Complete timeline" count={timeline.length}>{!timeline.length ? <p className="text-slate-400">No activity has been recorded yet.</p> : <ol className="relative space-y-6 before:absolute before:bottom-2 before:left-[5px] before:top-2 before:w-px before:bg-white/10">{timeline.map((item, index) => <TimelineItem key={`${item.label}-${item.date}-${index}`} {...item} />)}</ol>}</Card>
  </div>;
}
