import Link from "next/link";
import { getOfficeDb } from "@/lib/server/office-auth";
import { officeErrorMessage } from "@/lib/server/office-errors";
import { dateInTimeZone, zonedDayRangeUtc } from "@/lib/server/booking-time";
import { Card, Empty, KpiTile, ProspectLink, formatDate, formatMoney, inputClass, buttonClass } from "../office-ui";
import { HOT_INTENTS, HOT_MIN_CONFIDENCE, ageBucketForDate } from "@/lib/server/office/hot-lead";
import { approveAndSendProposal, createProposal, reconcileProposalSend, recordCallOutcome, reviewOutreachDraft } from "../actions";
import { loadLiveRecordFilter } from "@/lib/server/office/live-records";

export default async function OfficeDashboard({ searchParams }) {
  const params = await searchParams;
  const db = (await getOfficeDb()).db;
  const nowDate = new Date();
  const now = nowDate.toISOString();
  const sevenDaysAgo = new Date(nowDate.getTime() - 7 * 86400000).toISOString();
  const proposalExpiry = new Date(nowDate.getTime() + 14 * 86400000).toISOString().slice(0, 10);
  const easternDate = dateInTimeZone(nowDate, "America/New_York");
  const [todayStart, todayEnd] = zonedDayRangeUtc(easternDate, "America/New_York").map((date) => date.toISOString());

  const [repliesResult, overdueResult, callsResult, failuresResult, postCallsResult, draftsResult, proposalDealsResult, proposalsResult, proposalConfigResult, proposalCounterResult, liveRecords] = await Promise.all([
    db.from("messages").select("id,prospect_id,subject,body_text,received_at,from_address,classification,classification_confidence").eq("direction", "inbound").in("classification", HOT_INTENTS).gte("classification_confidence", HOT_MIN_CONFIDENCE).gte("received_at", sevenDaysAgo).order("received_at", { ascending: false }).limit(20),
    db.from("deals").select("id,prospect_id,title,stage,expected_value,currency,next_action,next_action_due_at,created_at").eq("outcome", "open").lt("next_action_due_at", now).order("next_action_due_at").limit(30),
    db.from("bookings").select("id,prospect_id,name,email,company,starts_at,ends_at,zoom_join_url,status,created_at").eq("status", "confirmed").gte("starts_at", todayStart).lt("starts_at", todayEnd).order("starts_at"),
    db.from("agent_log").select("id,agent_name,action,outcome,error,decision,created_at,prospect_id").in("outcome", ["failed", "blocked", "escalated"]).gte("created_at", sevenDaysAgo).order("created_at", { ascending: false }).limit(30),
    db.from("bookings").select("id,prospect_id,name,email,company,starts_at,ends_at,status,created_at").eq("status", "confirmed").lte("ends_at", now).order("ends_at", { ascending: false }).limit(20),
    db.from("outreach_drafts").select("id,prospect_id,subject,body_text,status,personalization_evidence,sequence_step,created_at").in("status", ["draft", "review"]).order("created_at").limit(50),
    db.from("deals").select("id,prospect_id,title,stage,expected_value,currency,package_name,budget_amount,created_at").eq("outcome", "open").in("stage", ["proposal_needed", "call_completed"]).order("updated_at", { ascending: false }).limit(30),
    db.from("proposals").select("id,deal_id,prospect_id,recipient_email,package_name,price,currency,expires_on,subject,body_text,status,last_error,created_at").in("status", ["draft", "approved", "failed", "send_failed", "reconcile_required"]).order("created_at", { ascending: false }).limit(30),
    db.from("system_config").select("proposal_email_enabled,daily_proposal_cap").eq("id", true).single(),
    db.from("email_send_counters").select("reserved_count,sent_count,failed_count").eq("send_date", now.slice(0, 10)).eq("message_type", "proposal").maybeSingle(),
    loadLiveRecordFilter(db, ["prospect", "deal", "booking"]),
  ]);

  const prospectIds = [...new Set([
    ...(repliesResult.data || []), ...(overdueResult.data || []), ...(callsResult.data || []), ...(failuresResult.data || []),
    ...(postCallsResult.data || []), ...(draftsResult.data || []), ...(proposalDealsResult.data || []), ...(proposalsResult.data || []),
  ].map((row) => row.prospect_id).filter(Boolean))];
  const { data: prospects = [] } = prospectIds.length
    ? await db.from("prospects").select("id,full_name,email,status,source").in("id", prospectIds)
    : { data: [] };
  const { data: linkedLeads = [] } = prospectIds.length
    ? await db.from("leads").select("prospect_id,context").in("prospect_id", prospectIds)
    : { data: [] };
  const people = new Map(prospects.map((p) => [p.id, p]));
  const syntheticProspectIds = new Set(linkedLeads.filter((lead) => lead.context?.synthetic_test === true).map((lead) => lead.prospect_id));
  const isLiveProspectActivity = (prospectId, createdAt) => !syntheticProspectIds.has(prospectId) && liveRecords.isLiveId("prospect", prospectId, createdAt);
  const bucketTone = { NEW: "bg-emerald-500/15 text-emerald-300", WAITING: "bg-amber-500/15 text-amber-300", OVERDUE: "bg-orange-500/15 text-orange-300", STALE: "bg-red-500/15 text-red-300" };
  const bucketBorder = { NEW: "border-l-emerald-400", WAITING: "border-l-amber-400", OVERDUE: "border-l-orange-400", STALE: "border-l-red-400" };
  const daysOverdue = (dueAt) => Math.max(1, Math.ceil((nowDate.getTime() - new Date(dueAt).getTime()) / 86400000));
  const replies = (repliesResult.data || []).filter((reply) => isLiveProspectActivity(reply.prospect_id, reply.received_at) && ageBucketForDate(reply.received_at, nowDate) !== "STALE").map((reply) => ({ ...reply, bucket: ageBucketForDate(reply.received_at, nowDate) }));
  const overdue = (overdueResult.data || []).filter((deal) => liveRecords.isLiveRecord("deal", deal));
  const calls = (callsResult.data || []).filter((booking) => liveRecords.isLiveRecord("booking", booking));
  const failures = (failuresResult.data || []).filter((item) => liveRecords.isAfterBaseline(item.created_at) && (!item.prospect_id || isLiveProspectActivity(item.prospect_id, item.created_at)));
  const postCalls = (postCallsResult.data || []).filter((booking) => liveRecords.isLiveRecord("booking", booking));
  const drafts = (draftsResult.data || []).filter((draft) => liveRecords.isAfterBaseline(draft.created_at) && isLiveProspectActivity(draft.prospect_id, draft.created_at));
  const proposalDeals = (proposalDealsResult.data || []).filter((deal) => liveRecords.isLiveRecord("deal", deal));
  const proposals = (proposalsResult.data || []).filter((proposal) => liveRecords.isAfterBaseline(proposal.created_at) && liveRecords.isProductionId("deal", proposal.deal_id));
  const proposalConfig = proposalConfigResult.data;
  const proposalUsage = proposalCounterResult.data || { reserved_count: 0, sent_count: 0, failed_count: 0 };
  const proposalRemaining = Math.max(0, (proposalConfig?.daily_proposal_cap || 0) - proposalUsage.reserved_count);
  const proposalSendingAvailable = Boolean(proposalConfig?.proposal_email_enabled && proposalRemaining > 0);
  const focus = replies.length
    ? { href: "#hot-replies", eyebrow: "Reply first", title: `${replies.length} customer ${replies.length === 1 ? "reply needs" : "replies need"} you`, detail: "These are the strongest buying signals and should receive the quickest response.", tone: "border-emerald-400/25 bg-emerald-500/[0.07] text-emerald-200" }
    : overdue.length
      ? { href: "#overdue-deals", eyebrow: "Follow up now", title: `${overdue.length} deal ${overdue.length === 1 ? "action is" : "actions are"} overdue`, detail: "Clear these next so active opportunities do not go cold.", tone: "border-red-400/25 bg-red-500/[0.07] text-red-200" }
      : calls.length
        ? { href: "#todays-calls", eyebrow: "Prepare next", title: `${calls.length} ${calls.length === 1 ? "call is" : "calls are"} on today’s calendar`, detail: "Open the appointment and review the person before the conversation.", tone: "border-amber-400/25 bg-amber-500/[0.07] text-amber-200" }
        : { href: "/office/morning-brief", eyebrow: "You are caught up", title: "Ask Eddie what to work on next", detail: "The urgent queues are clear. Eddie can review the wider sales engine with you.", tone: "border-purple-400/25 bg-purple-500/[0.07] text-purple-200" };

  return (
    <div className="space-y-8">
      {(params?.success || params?.error) && <p className={`rounded-xl p-4 text-sm ${params.error ? "bg-red-500/10 text-red-300" : "bg-emerald-500/10 text-emerald-300"}`}>{params.error ? officeErrorMessage(params.error) : "Saved."}</p>}
      {!liveRecords.ready && <p className="rounded-xl border border-amber-400/25 bg-amber-500/10 p-4 text-sm text-amber-200">Live-record verification is temporarily unavailable, so customer queues are hidden rather than showing test data.</p>}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-purple-300">My work</p>
          <h2 className="mt-1 text-3xl font-bold sm:text-4xl">What needs your attention</h2>
          <p className="mt-2 text-slate-400">Only live records created after the clean-start boundary appear here.</p>
        </div>
        <Link href="/office/morning-brief" className="rounded-xl border border-purple-400/30 bg-purple-500/10 px-4 py-3 text-sm font-semibold text-purple-100 transition hover:bg-purple-500/20">Talk it through with Eddie →</Link>
      </div>

      <Link href={focus.href} className={`block rounded-2xl border p-5 transition hover:-translate-y-0.5 hover:brightness-110 ${focus.tone}`}>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em]">{focus.eyebrow}</p>
        <div className="mt-2 flex items-start justify-between gap-4"><div><h3 className="text-xl font-bold text-white">{focus.title}</h3><p className="mt-1 text-sm text-slate-300">{focus.detail}</p></div><span aria-hidden="true" className="text-xl">→</span></div>
      </Link>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiTile label="Hot replies" value={replies.length} href="#hot-replies" tone={replies.length ? "green" : "purple"} detail="High-intent customer messages" />
        <KpiTile label="Overdue actions" value={overdue.length} href="#overdue-deals" tone={overdue.length ? "red" : "purple"} detail="Open deals past their next step" />
        <KpiTile label="Today's calls" value={calls.length} href="#todays-calls" tone="gold" detail="Confirmed appointments, Eastern time" />
        <KpiTile label="System warnings" value={failures.length} href="#automation-warnings" tone={failures.length ? "red" : "purple"} detail="Failures in the last seven days" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card id="hot-replies" title="Hot replies" count={replies.length} tone="green">
          {!replies.length ? <Empty /> : <ul className="space-y-3">{replies.map((reply) => { const person = people.get(reply.prospect_id); return <li key={reply.id} className={`rounded-xl border-l-4 bg-white/[0.03] p-4 ${bucketBorder[reply.bucket]}`}><div className="flex flex-wrap items-center justify-between gap-2"><ProspectLink id={reply.prospect_id} name={person?.full_name} email={reply.from_address} /><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${bucketTone[reply.bucket]}`}>{reply.bucket}</span></div><p className="mt-1 font-medium">{reply.subject || "No subject"}</p><p className="mt-1 line-clamp-3 text-sm text-slate-400">{reply.body_text}</p><p className="mt-2 text-xs text-slate-500">{formatDate(reply.received_at)} · {reply.classification.replaceAll("_", " ")} {reply.classification_confidence != null ? `(${Math.round(reply.classification_confidence * 100)}%)` : ""}</p></li>; })}</ul>}
        </Card>

        <Card id="overdue-deals" title="Overdue deal actions" count={overdue.length} tone="red">
          {!overdue.length ? <Empty /> : <ul className="space-y-3">{overdue.map((deal) => { const person = people.get(deal.prospect_id); const overdueDays = daysOverdue(deal.next_action_due_at); return <li key={deal.id} className="rounded-xl border-l-4 border-l-red-400 bg-white/[0.03] p-4"><div className="flex flex-wrap items-center justify-between gap-2"><ProspectLink id={deal.prospect_id} name={person?.full_name || deal.title} email={person?.email} /><span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-red-300">{overdueDays} day{overdueDays === 1 ? "" : "s"} overdue</span></div><div className="mt-1 flex justify-between gap-3"><p className="text-sm">{deal.next_action || "Next action is missing"}</p><span className="whitespace-nowrap text-sm text-amber-300">{formatMoney(deal.expected_value, deal.currency)}</span></div><p className="mt-2 text-xs text-red-300">Due {formatDate(deal.next_action_due_at)} · {deal.stage.replaceAll("_", " ")}</p></li>; })}</ul>}
        </Card>

        <Card id="todays-calls" title="Today’s calls" count={calls.length} tone="gold">
          {!calls.length ? <Empty>No calls booked today.</Empty> : <ul className="space-y-3">{calls.map((call) => <li key={call.id} className="rounded-xl bg-white/[0.03] p-4"><div className="flex justify-between gap-3"><ProspectLink id={call.prospect_id} name={call.name} email={call.email} />{call.zoom_join_url && <a className="text-sm text-purple-300" href={call.zoom_join_url} target="_blank" rel="noreferrer">Join Zoom</a>}</div><p className="mt-1 text-sm text-slate-300">{formatDate(call.starts_at)}{call.company ? ` · ${call.company}` : ""}</p></li>)}</ul>}
        </Card>

        <Card id="automation-warnings" title="Automation warnings" count={failures.length} tone="red">
          {!failures.length ? <Empty>No failures or escalations in the last 7 days.</Empty> : <ul className="max-h-[28rem] space-y-3 overflow-auto">{failures.map((failure) => <li key={failure.id} className="rounded-xl bg-white/[0.03] p-4"><div className="flex justify-between gap-3"><span className="font-medium">{failure.agent_name}: {failure.action}</span><span className="text-xs uppercase text-red-300">{failure.outcome}</span></div><p className="mt-1 text-sm text-slate-400">{failure.error || failure.decision?.reason || "Review the logged decision."}</p><p className="mt-2 text-xs text-slate-500">{formatDate(failure.created_at)}</p></li>)}</ul>}
        </Card>
      </div>

      <Card title="Post-call outcomes" count={postCalls.length} tone="gold">
        {!postCalls.length ? <Empty>No completed calls are waiting for an outcome.</Empty> : <div className="grid gap-4 lg:grid-cols-2">{postCalls.map((booking) => <form action={recordCallOutcome} key={booking.id} className="rounded-xl bg-white/[0.03] p-4">
          <input type="hidden" name="booking_id" value={booking.id} />
          <ProspectLink id={booking.prospect_id} name={booking.name} email={booking.email} />
          <p className="mb-3 text-xs text-slate-500">Ended {formatDate(booking.ends_at)}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">Outcome<select name="outcome" required className={inputClass}><option value="qualified">Qualified</option><option value="follow_up">Follow up</option><option value="unqualified">Not qualified</option><option value="no_show">No-show</option></select></label>
            <label className="text-sm">Package<input name="package_name" className={inputClass} placeholder="Game Show Experience" /></label>
            <label className="text-sm">Budget / value<input name="budget" type="number" min="0" step="0.01" className={inputClass} /></label>
            <label className="text-sm">Next step<input name="next_step" className={inputClass} placeholder="Send proposal Friday" /></label>
          </div>
          <label className="mt-3 block text-sm">Notes<textarea name="notes" rows={3} className={inputClass} /></label>
          <button className={`${buttonClass} mt-3`}>Save outcome</button>
        </form>)}</div>}
      </Card>

      <Card title="Outreach drafts awaiting review" count={drafts.length}>
        {!drafts.length ? <Empty>No outreach drafts are waiting.</Empty> : <div className="space-y-4">{drafts.map((draft) => { const person = people.get(draft.prospect_id); return <form action={reviewOutreachDraft} key={draft.id} className="rounded-xl bg-white/[0.03] p-4"><input type="hidden" name="id" value={draft.id} /><div className="flex flex-wrap items-center gap-2"><ProspectLink id={draft.prospect_id} name={person?.full_name} email={person?.email} />{draft.sequence_step > 1 && <span className="rounded-full bg-purple-500/15 px-2 py-0.5 text-xs font-semibold text-purple-300">Follow-up #{draft.sequence_step}</span>}</div><label className="mt-3 block text-sm">Subject<input name="subject" defaultValue={draft.subject} required className={inputClass} /></label><label className="mt-3 block text-sm">Email<textarea name="body_text" defaultValue={draft.body_text} required rows={9} className={inputClass} /></label><label className="mt-3 block text-sm">Review notes<input name="notes" className={inputClass} /></label><div className="mt-3 flex gap-3"><button name="decision" value="approve" className={buttonClass}>Approve</button><button name="decision" value="reject" className="rounded-lg border border-red-400/30 px-4 py-2 text-sm text-red-300 hover:bg-red-500/10">Reject</button></div></form>; })}</div>}
      </Card>

      <Card title="Proposal builder" count={proposalDeals.length}>
        {!proposalDeals.length ? <Empty>No deals currently need a proposal.</Empty> : <div className="grid gap-4 lg:grid-cols-2">{proposalDeals.map((deal) => { const person = people.get(deal.prospect_id); return <form action={createProposal} key={deal.id} className="rounded-xl bg-white/[0.03] p-4"><input type="hidden" name="deal_id" value={deal.id} /><ProspectLink id={deal.prospect_id} name={person?.full_name || deal.title} email={person?.email} /><p className="mt-1 text-xs text-slate-500">{deal.stage.replaceAll("_", " ")}</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-sm">Package<input name="package_name" required defaultValue={deal.package_name || "Hosted Teamtastic Experience"} className={inputClass} /></label><label className="text-sm">Price<input name="price" type="number" required min="0" step="0.01" defaultValue={deal.budget_amount || deal.expected_value || ""} className={inputClass} /></label><label className="text-sm">Expires<input name="expires_on" type="date" required defaultValue={proposalExpiry} className={inputClass} /></label></div><button className={`${buttonClass} mt-4`}>Create proposal draft</button></form>; })}</div>}
      </Card>

      <Card title="Proposal approval queue" count={proposals.length}>
        <p className="mb-4 text-sm text-slate-400">Today: {proposalUsage.sent_count} sent · {proposalUsage.reserved_count} reserved · {proposalRemaining} remaining of {proposalConfig?.daily_proposal_cap ?? 0}.</p>
        {!proposalConfig?.proposal_email_enabled && <p className="mb-4 rounded-lg bg-amber-500/10 p-3 text-sm text-amber-300">Proposal sending is disabled in Office settings.</p>}
        {proposalConfig?.proposal_email_enabled && proposalRemaining === 0 && <p className="mb-4 rounded-lg bg-amber-500/10 p-3 text-sm text-amber-300">Today&rsquo;s proposal email cap has been reached.</p>}
        {!proposals.length ? <Empty>No proposal drafts are waiting.</Empty> : <div className="space-y-3">{proposals.map((proposal) => <form action={proposal.status === "reconcile_required" ? reconcileProposalSend : approveAndSendProposal} key={proposal.id} className="rounded-xl bg-white/[0.03] p-4"><input type="hidden" name="id" value={proposal.id} /><div className="flex flex-wrap justify-between gap-3"><div><p className="font-semibold">{proposal.package_name} · {formatMoney(proposal.price, proposal.currency)}</p><p className="text-sm text-slate-400">To {proposal.recipient_email} · expires {proposal.expires_on}</p></div><span className="text-sm uppercase text-amber-300">{proposal.status}</span></div><label className="mt-3 block text-sm">Subject<input name="subject" defaultValue={proposal.subject} required readOnly={proposal.status === "reconcile_required"} className={inputClass} /></label><label className="mt-3 block text-sm">Email<textarea name="body_text" defaultValue={proposal.body_text} required readOnly={proposal.status === "reconcile_required"} rows={10} className={inputClass} /></label>{proposal.last_error && <p className="mt-2 text-sm text-red-300">{proposal.last_error}</p>}<button disabled={proposal.status !== "reconcile_required" && !proposalSendingAvailable} className={`${buttonClass} mt-4 disabled:cursor-not-allowed disabled:opacity-50`}>{proposal.status === "reconcile_required" ? "Reconcile recorded send" : "Approve and send proposal"}</button><p className="mt-2 text-xs text-slate-500">{proposal.status === "reconcile_required" ? "Finalizes the provider-accepted send in the CRM without sending another email or consuming more quota." : "One click both records your approval and sends this exact version. The global kill switch, proposal switch, suppression list, and daily cap are checked first."}</p></form>)}</div>}
      </Card>

      <p className="text-center text-sm text-slate-500">Looking for someone? <Link href="/office/prospects" className="text-purple-300">Search all prospects and their complete timeline.</Link></p>
    </div>
  );
}
