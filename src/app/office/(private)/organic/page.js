import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import { Card, buttonClass, inputClass } from "../../office-ui";
import { createOrganicOpportunity, reviewOrganicOpportunity, updateOrganicSourceConfig } from "../../actions";

export default async function OrganicIntentPage({ searchParams }) {
  const params = await searchParams;
  const db = getSupabaseAdmin();
  const nowDate = new Date();
  const sevenDaysAgo = new Date(nowDate.getTime() - 7 * 86400000).toISOString();
  const [{ data: config }, { data: source }, { data: opportunities }, { data: runs }, opportunitiesMetric, postedMetric, leadsMetric, revenueMetric] = await Promise.all([
    db.from("system_config").select("organic_research_enabled,organic_scoring_enabled,organic_drafting_enabled").eq("id", true).single(),
    db.from("organic_sources").select("enabled,config,daily_cap,last_run_at,last_error").eq("source_key", "reddit-approved-api").single(),
    db.from("organic_opportunities").select("id,title,excerpt,source_url,community,intent_score,score_reasons,status,discovered_at,organic_response_drafts(id,body_text,tracked_url,status)").in("status", ["new","scored","review","drafted","approved"]).order("intent_score", { ascending: false }).limit(50),
    db.from("organic_source_runs").select("id,status,records_scanned,records_created,decision,error,started_at,completed_at,organic_sources(display_name)").order("started_at", { ascending: false }).limit(10),
    db.from("organic_opportunities").select("id", { count: "exact", head: true }).gte("created_at", sevenDaysAgo),
    db.from("organic_response_drafts").select("id", { count: "exact", head: true }).eq("status", "posted").gte("posted_at", sevenDaysAgo),
    db.from("organic_attribution").select("id", { count: "exact", head: true }).eq("touch_type", "lead").gte("occurred_at", sevenDaysAgo),
    db.from("organic_attribution").select("revenue").eq("touch_type", "revenue").gte("occurred_at", sevenDaysAgo),
  ]);
  return <div className="space-y-8">
    {(params?.success || params?.error) && <p className={`rounded-xl p-4 text-sm ${params.error ? "bg-red-500/10 text-red-300" : "bg-emerald-500/10 text-emerald-300"}`}>{params.error ? "That action could not be completed." : "Saved."}</p>}
    <div><h2 className="text-3xl font-bold">Organic intent radar</h2><p className="mt-2 text-slate-400">Research and draft queue. Nothing here posts, messages, or emails automatically.</p></div>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Card title="Found · 7 days"><p className="text-3xl font-bold text-purple-300">{opportunitiesMetric.count || 0}</p></Card><Card title="Posted · 7 days"><p className="text-3xl font-bold text-sky-300">{postedMetric.count || 0}</p></Card><Card title="Leads · 7 days"><p className="text-3xl font-bold text-emerald-300">{leadsMetric.count || 0}</p></Card><Card title="Revenue · 7 days"><p className="text-3xl font-bold text-amber-300">${(revenueMetric.data || []).reduce((sum, row) => sum + Number(row.revenue || 0), 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}</p></Card></div>
    <Card title="Safety status"><p className="text-sm text-slate-300">Research: {config?.organic_research_enabled ? "on" : "off"} · Scoring: {config?.organic_scoring_enabled ? "on" : "off"} · Drafting: {config?.organic_drafting_enabled ? "on" : "off"}</p></Card>
    <Card title="Research quality controls">
      <form action={updateOrganicSourceConfig} className="grid gap-4 lg:grid-cols-2">
        <label className="text-sm">Search queries — one per line<textarea name="queries" rows={7} defaultValue={(source?.config?.queries || []).join("\n")} className={inputClass}/></label>
        <label className="text-sm">Excluded terms — one per line<textarea name="excluded_terms" rows={7} defaultValue={(source?.config?.excluded_terms || []).join("\n")} className={inputClass}/></label>
        <label className="text-sm">Blocked communities — one per line<textarea name="blocked_communities" rows={5} defaultValue={(source?.config?.blocked_communities || []).join("\n")} placeholder="r/example" className={inputClass}/></label>
        <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm">Minimum capture score<input name="minimum_capture_score" type="number" min="0" max="100" defaultValue={source?.config?.minimum_capture_score ?? 45} className={inputClass}/></label><label className="text-sm">Maximum post age — days<input name="maximum_post_age_days" type="number" min="1" max="90" defaultValue={source?.config?.maximum_post_age_days ?? 30} className={inputClass}/></label></div>
        <div className="lg:col-span-2"><button className={buttonClass}>Save quality controls</button><p className="mt-2 text-xs text-slate-500">A post must contain workplace context, meet the minimum score, be recent enough, and pass both exclusion lists before it can enter the queue.</p></div>
      </form>
    </Card>
    <Card title="Recent automated research runs">
      <div className="space-y-3">{(runs || []).map((run) => <div key={run.id} className="rounded-lg bg-white/5 p-3 text-sm"><p className="font-semibold">{run.status} · {run.records_created} created from {run.records_scanned} scanned</p><p className="mt-1 text-xs text-slate-400">{run.error || run.decision?.reason || new Date(run.started_at).toLocaleString()}</p></div>)}{!runs?.length && <p className="text-sm text-slate-400">No automated runs yet. Disabled collectors do not spend API capacity.</p>}</div>
    </Card>
    <Card title="Add a public opportunity">
      <form action={createOrganicOpportunity} className="space-y-4">
        <input required name="source_url" type="url" placeholder="Public post URL" className={inputClass}/>
        <input name="title" placeholder="Post title" className={inputClass}/>
        <input name="community" placeholder="Community or website" className={inputClass}/>
        <textarea required name="excerpt" rows={5} placeholder="Relevant public excerpt or summary" className={inputClass}/>
        <button className={buttonClass}>Score and create draft</button>
      </form>
    </Card>
    <div className="space-y-5">
      {(opportunities || []).map((o) => { const draft = Array.isArray(o.organic_response_drafts) ? o.organic_response_drafts[0] : o.organic_response_drafts; return <Card key={o.id} title={`${o.intent_score ?? "—"}/100 · ${o.title || o.community || "Opportunity"}`}>
        <p className="text-sm text-slate-300">{o.excerpt}</p>
        <p className="mt-2 text-xs text-slate-500">{(o.score_reasons || []).join(" · ")}</p>
        <a className="mt-3 inline-block text-sm text-purple-300 underline" href={o.source_url} target="_blank" rel="noreferrer">Open original public post</a>
        {draft && <form action={reviewOrganicOpportunity} className="mt-4 space-y-3"><input type="hidden" name="opportunity_id" value={o.id}/><input type="hidden" name="draft_id" value={draft.id}/><textarea name="body_text" rows={7} defaultValue={draft.body_text} readOnly={["approved","copied"].includes(draft.status)} className={inputClass}/>{["approved","copied"].includes(draft.status) && <input name="posted_url" type="url" placeholder="Paste the public URL after posting" className={inputClass}/>}<div className="flex flex-wrap gap-3">{draft.status === "review" && <button name="decision" value="approve" className={buttonClass}>Approve response</button>}{draft.status === "approved" && <button name="decision" value="copied" className={buttonClass}>Mark copied</button>}{["approved","copied"].includes(draft.status) && <button name="decision" value="posted" className={buttonClass}>Mark posted</button>}<button name="decision" value="dismiss" className="rounded-lg border border-white/10 px-4 py-2 text-sm">Dismiss</button></div><p className="text-xs text-slate-500">Posting remains manual. Copy the approved response, post it only where vendor replies are allowed, then record the public URL.</p></form>}
      </Card>; })}
      {!opportunities?.length && <p className="text-sm text-slate-400">No open opportunities yet.</p>}
    </div>
  </div>;
}
