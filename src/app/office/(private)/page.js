import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import { Card, Empty, ProspectLink, formatDate, formatMoney, inputClass, buttonClass } from "../office-ui";
import { approveAndSendProposal, createProposal, recordCallOutcome, reviewOutreachDraft } from "../actions";

function easternDayRange() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date()).filter((p) => p.type !== "literal").map((p) => [p.type, p.value]));
  const noonUtc = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), 12));
  const next = new Date(noonUtc.getTime() + 86400000);
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  const nextDate = next.toISOString().slice(0, 10);
  const offset = (day) => {
    const sample = new Date(`${day}T12:00:00Z`);
    const zone = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", timeZoneName: "shortOffset", hour: "2-digit" }).formatToParts(sample).filter((p) => p.type !== "literal").map((p) => [p.type, p.value]));
    const match = zone.timeZoneName?.match(/GMT([+-]\d+)/);
    return match ? `${Number(match[1]) < 0 ? "-" : "+"}${String(Math.abs(Number(match[1]))).padStart(2, "0")}:00` : "-04:00";
  };
  return [`${date}T00:00:00${offset(date)}`, `${nextDate}T00:00:00${offset(nextDate)}`];
}

export default async function OfficeDashboard({ searchParams }) {
  const params = await searchParams;
  const db = getSupabaseAdmin();
  const nowDate = new Date();
  const now = nowDate.toISOString();
  const sevenDaysAgo = new Date(nowDate.getTime() - 7 * 86400000).toISOString();
  const proposalExpiry = new Date(nowDate.getTime() + 14 * 86400000).toISOString().slice(0, 10);
  const [todayStart, todayEnd] = easternDayRange();

  const [repliesResult, overdueResult, callsResult, failuresResult, postCallsResult, draftsResult, proposalDealsResult, proposalsResult] = await Promise.all([
    db.from("messages").select("id,prospect_id,subject,body_text,received_at,from_address").eq("direction", "inbound").eq("classification", "interested").gte("received_at", sevenDaysAgo).order("received_at", { ascending: false }).limit(20),
    db.from("deals").select("id,prospect_id,title,stage,expected_value,currency,next_action,next_action_due_at").eq("outcome", "open").lt("next_action_due_at", now).order("next_action_due_at").limit(30),
    db.from("bookings").select("id,prospect_id,name,email,company,starts_at,ends_at,zoom_join_url,status").eq("status", "confirmed").gte("starts_at", todayStart).lt("starts_at", todayEnd).order("starts_at"),
    db.from("agent_log").select("id,agent_name,action,outcome,error,decision,created_at,prospect_id").in("outcome", ["failed", "blocked", "escalated"]).gte("created_at", sevenDaysAgo).order("created_at", { ascending: false }).limit(30),
    db.from("bookings").select("id,prospect_id,name,email,company,starts_at,ends_at,status").eq("status", "confirmed").lte("ends_at", now).order("ends_at", { ascending: false }).limit(20),
    db.from("outreach_drafts").select("id,prospect_id,subject,body_text,status,personalization_evidence,sequence_step,created_at").in("status", ["draft", "review"]).order("created_at").limit(50),
    db.from("deals").select("id,prospect_id,title,stage,expected_value,currency,package_name,budget_amount").eq("outcome", "open").in("stage", ["proposal_needed", "call_completed"]).order("updated_at", { ascending: false }).limit(30),
    db.from("proposals").select("id,deal_id,prospect_id,recipient_email,package_name,price,currency,expires_on,subject,body_text,status,last_error,created_at").in("status", ["draft", "approved", "failed"]).order("created_at", { ascending: false }).limit(30),
  ]);

  const prospectIds = [...new Set([
    ...(repliesResult.data || []), ...(overdueResult.data || []), ...(callsResult.data || []), ...(failuresResult.data || []),
    ...(postCallsResult.data || []), ...(draftsResult.data || []), ...(proposalDealsResult.data || []), ...(proposalsResult.data || []),
  ].map((row) => row.prospect_id).filter(Boolean))];
  const { data: prospects = [] } = prospectIds.length
    ? await db.from("prospects").select("id,full_name,email,status").in("id", prospectIds)
    : { data: [] };
  const people = new Map(prospects.map((p) => [p.id, p]));
  const replies = repliesResult.data || [];
  const overdue = overdueResult.data || [];
  const calls = callsResult.data || [];
  const failures = failuresResult.data || [];
  const postCalls = postCallsResult.data || [];
  const drafts = draftsResult.data || [];
  const proposalDeals = proposalDealsResult.data || [];
  const proposals = proposalsResult.data || [];

  return (
    <div className="space-y-8">
      {(params?.success || params?.error) && <p className={`rounded-xl p-4 text-sm ${params.error ? "bg-red-500/10 text-red-300" : "bg-emerald-500/10 text-emerald-300"}`}>{params.error ? `Could not complete that action: ${params.error}` : "Saved."}</p>}
      <div>
        <h2 className="text-3xl font-bold">Needs Michael now</h2>
        <p className="mt-2 text-slate-400">The decisions and follow-ups that should not wait.</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Interested replies" count={replies.length} tone="green">
          {!replies.length ? <Empty /> : <ul className="space-y-3">{replies.map((reply) => { const person = people.get(reply.prospect_id); return <li key={reply.id} className="rounded-xl bg-white/[0.03] p-4"><ProspectLink id={reply.prospect_id} name={person?.full_name} email={reply.from_address} /><p className="mt-1 font-medium">{reply.subject || "No subject"}</p><p className="mt-1 line-clamp-3 text-sm text-slate-400">{reply.body_text}</p><p className="mt-2 text-xs text-slate-500">{formatDate(reply.received_at)}</p></li>; })}</ul>}
        </Card>

        <Card title="Overdue deal actions" count={overdue.length} tone="red">
          {!overdue.length ? <Empty /> : <ul className="space-y-3">{overdue.map((deal) => { const person = people.get(deal.prospect_id); return <li key={deal.id} className="rounded-xl bg-white/[0.03] p-4"><div className="flex justify-between gap-3"><ProspectLink id={deal.prospect_id} name={person?.full_name || deal.title} email={person?.email} /><span className="text-sm text-amber-300">{formatMoney(deal.expected_value, deal.currency)}</span></div><p className="mt-1 text-sm">{deal.next_action || "Next action is missing"}</p><p className="mt-2 text-xs text-red-300">Due {formatDate(deal.next_action_due_at)} · {deal.stage.replaceAll("_", " ")}</p></li>; })}</ul>}
        </Card>

        <Card title="Today’s calls" count={calls.length} tone="gold">
          {!calls.length ? <Empty>No calls booked today.</Empty> : <ul className="space-y-3">{calls.map((call) => <li key={call.id} className="rounded-xl bg-white/[0.03] p-4"><div className="flex justify-between gap-3"><ProspectLink id={call.prospect_id} name={call.name} email={call.email} />{call.zoom_join_url && <a className="text-sm text-purple-300" href={call.zoom_join_url} target="_blank" rel="noreferrer">Join Zoom</a>}</div><p className="mt-1 text-sm text-slate-300">{formatDate(call.starts_at)}{call.company ? ` · ${call.company}` : ""}</p></li>)}</ul>}
        </Card>

        <Card title="Automation warnings" count={failures.length} tone="red">
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
          <label className="mt-3 block text-sm">Notes<textarea name="notes" rows="3" className={inputClass} /></label>
          <button className={`${buttonClass} mt-3`}>Save outcome</button>
        </form>)}</div>}
      </Card>

      <Card title="Outreach drafts awaiting review" count={drafts.length}>
        {!drafts.length ? <Empty>No outreach drafts are waiting.</Empty> : <div className="space-y-4">{drafts.map((draft) => { const person = people.get(draft.prospect_id); return <form action={reviewOutreachDraft} key={draft.id} className="rounded-xl bg-white/[0.03] p-4"><input type="hidden" name="id" value={draft.id} /><div className="flex flex-wrap items-center gap-2"><ProspectLink id={draft.prospect_id} name={person?.full_name} email={person?.email} />{draft.sequence_step > 1 && <span className="rounded-full bg-purple-500/15 px-2 py-0.5 text-xs font-semibold text-purple-300">Follow-up #{draft.sequence_step}</span>}</div><label className="mt-3 block text-sm">Subject<input name="subject" defaultValue={draft.subject} required className={inputClass} /></label><label className="mt-3 block text-sm">Email<textarea name="body_text" defaultValue={draft.body_text} required rows="9" className={inputClass} /></label><label className="mt-3 block text-sm">Review notes<input name="notes" className={inputClass} /></label><div className="mt-3 flex gap-3"><button name="decision" value="approve" className={buttonClass}>Approve</button><button name="decision" value="reject" className="rounded-lg border border-red-400/30 px-4 py-2 text-sm text-red-300 hover:bg-red-500/10">Reject</button></div></form>; })}</div>}
      </Card>

      <Card title="Proposal builder" count={proposalDeals.length}>
        {!proposalDeals.length ? <Empty>No deals currently need a proposal.</Empty> : <div className="grid gap-4 lg:grid-cols-2">{proposalDeals.map((deal) => { const person = people.get(deal.prospect_id); return <form action={createProposal} key={deal.id} className="rounded-xl bg-white/[0.03] p-4"><input type="hidden" name="deal_id" value={deal.id} /><ProspectLink id={deal.prospect_id} name={person?.full_name || deal.title} email={person?.email} /><p className="mt-1 text-xs text-slate-500">{deal.stage.replaceAll("_", " ")}</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-sm">Package<input name="package_name" required defaultValue={deal.package_name || "Hosted Teamtastic Experience"} className={inputClass} /></label><label className="text-sm">Price<input name="price" type="number" required min="0" step="0.01" defaultValue={deal.budget_amount || deal.expected_value || ""} className={inputClass} /></label><label className="text-sm">Expires<input name="expires_on" type="date" required defaultValue={proposalExpiry} className={inputClass} /></label></div><button className={`${buttonClass} mt-4`}>Create proposal draft</button></form>; })}</div>}
      </Card>

      <Card title="Proposal approval queue" count={proposals.length}>
        {!proposals.length ? <Empty>No proposal drafts are waiting.</Empty> : <div className="space-y-3">{proposals.map((proposal) => <form action={approveAndSendProposal} key={proposal.id} className="rounded-xl bg-white/[0.03] p-4"><input type="hidden" name="id" value={proposal.id} /><div className="flex flex-wrap justify-between gap-3"><div><p className="font-semibold">{proposal.package_name} · {formatMoney(proposal.price, proposal.currency)}</p><p className="text-sm text-slate-400">To {proposal.recipient_email} · expires {proposal.expires_on}</p></div><span className="text-sm uppercase text-amber-300">{proposal.status}</span></div><label className="mt-3 block text-sm">Subject<input name="subject" defaultValue={proposal.subject} required className={inputClass} /></label><label className="mt-3 block text-sm">Email<textarea name="body_text" defaultValue={proposal.body_text} required rows="10" className={inputClass} /></label>{proposal.last_error && <p className="mt-2 text-sm text-red-300">{proposal.last_error}</p>}<button className={`${buttonClass} mt-4`}>Approve and send proposal</button><p className="mt-2 text-xs text-slate-500">One click both records your approval and sends this exact version. The global kill switch, proposal switch, suppression list, and daily cap are checked first.</p></form>)}</div>}
      </Card>

      <p className="text-center text-sm text-slate-500">Looking for someone? <Link href="/office/prospects" className="text-purple-300">Search all prospects and their complete timeline.</Link></p>
    </div>
  );
}
