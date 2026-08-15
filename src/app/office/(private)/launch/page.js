import Link from "next/link";
import {getSupabaseAdmin} from "@/lib/server/supabase-admin";
import {Card,formatDate} from "../../office-ui";

const holidaySources=["holiday_party_money_page","year_end_celebration_page","large_holiday_event_page"];
const tone={pass:"border-emerald-400/20 bg-emerald-500/10 text-emerald-200",warning:"border-amber-400/20 bg-amber-500/10 text-amber-200",blocker:"border-red-400/20 bg-red-500/10 text-red-200",optional:"border-sky-400/20 bg-sky-500/10 text-sky-200"};
const label={pass:"Ready",warning:"Action",blocker:"Blocker",optional:"Optional"};

function Gate({gate}){return <div className={`rounded-xl border p-4 ${tone[gate.status]}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold text-white">{gate.title}</p><p className="mt-1 text-sm opacity-90">{gate.detail}</p>{gate.href&&<Link className="mt-2 inline-block text-sm font-semibold underline underline-offset-4" href={gate.href}>{gate.action}</Link>}</div><span className="rounded-full bg-black/20 px-3 py-1 text-xs font-bold uppercase tracking-wide">{label[gate.status]}</span></div></div>}

export default async function LaunchPage(){
  // Server-rendered, force-dynamic page: this timestamp intentionally represents each live preflight run.
  // eslint-disable-next-line react-hooks/purity
  const db=getSupabaseAdmin(),now=Date.now(),recent=new Date(now-30*86400000).toISOString(),stale=new Date(now-10*60000).toISOString();
  const [configResult,healthResult,failedResult,pendingResult,leadsResult,dealsResult,agendaResult,mailboxResult,reportResult,distributionResult,audienceResult,briefResult,watchlistResult,incidentsResult]=await Promise.all([
    db.from("system_config").select("master_enabled,prospecting_enabled,outbound_auto_paused,daily_prospecting_cap,sequence_followups_enabled,proposal_email_enabled,gmail_ingestion_enabled,daily_report_enabled,organic_research_enabled,organic_reddit_commercial_approval_confirmed").eq("id",true).maybeSingle(),
    db.from("conversion_health_runs").select("status,checks_passed,checks_failed,started_at").order("started_at",{ascending:false}).limit(1).maybeSingle(),
    db.from("notification_deliveries").select("id",{count:"exact",head:true}).eq("status","failed").gte("created_at",recent),
    db.from("notification_deliveries").select("id",{count:"exact",head:true}).eq("status","pending").lt("created_at",stale).gte("created_at",recent),
    db.from("leads").select("id,preferred_event_date,event_timezone,created_at").in("lead_source",holidaySources).gte("created_at",recent),
    db.from("deals").select("id,title,next_action,next_action_due_at").eq("outcome","open"),
    db.from("daily_growth_agendas").select("agenda_date,generated_at,summary").order("agenda_date",{ascending:false}).limit(1).maybeSingle(),
    db.from("mailbox_sync_state").select("mailbox,status,last_synced_at,last_error").order("updated_at",{ascending:false}).limit(1).maybeSingle(),
    db.from("daily_reports").select("report_date,status,sent_at,last_error").order("report_date",{ascending:false}).limit(1).maybeSingle(),
    db.from("distribution_items").select("id",{count:"exact",head:true}).eq("status","draft"),
    db.from("audience_snapshots").select("snapshot_date,generated_at").order("snapshot_date",{ascending:false}).limit(1).maybeSingle(),
    db.from("growth_briefs").select("brief_date,generated_at").order("brief_date",{ascending:false}).limit(1).maybeSingle(),
    db.from("launch_readiness_snapshots").select("status,blocker_count,warning_count,created_at").order("created_at",{ascending:false}).limit(1).maybeSingle(),
    db.from("production_incidents").select("id,severity",{count:"exact"}).neq("status","resolved").in("severity",["critical","high"])
  ]);
  const config=configResult.data,health=healthResult.data,leads=leadsResult.data||[],deals=dealsResult.data||[],agenda=agendaResult.data,mailbox=mailboxResult.data,report=reportResult.data;
  const missingQualification=leads.filter(x=>!x.preferred_event_date||!x.event_timezone).length;
  const missingNextAction=deals.filter(x=>!x.next_action?.trim()||!x.next_action_due_at).length;
  const queryFailure=[configResult,healthResult,failedResult,pendingResult,leadsResult,dealsResult].some(x=>x.error);
  const gates=[
    {title:"Readiness data",status:queryFailure?"blocker":"pass",detail:queryFailure?"One or more required readiness checks could not be read. Resolve the data connection before launch.":"The launch dashboard can read every required operational signal."},
    {title:"Holiday conversion pages",status:health?.status==="healthy"?"pass":"blocker",detail:health?`${health.checks_passed||0} checks passed and ${health.checks_failed||0} failed. Last audit ${formatDate(health.started_at)}.`:"No conversion-page audit is available yet.",href:"/office/health",action:"Open conversion health"},
    {title:"Lead notification delivery",status:(failedResult.count||0)+(pendingResult.count||0)===0?"pass":"blocker",detail:`Last 30 days: ${failedResult.count||0} failed and ${pendingResult.count||0} pending longer than 10 minutes.`},
    {title:"Holiday lead qualification",status:missingQualification===0?"pass":"warning",detail:`${leads.length} holiday leads received in the last 30 days; ${missingQualification} missing an event date or time zone. New forms require both.`},
    {title:"Every open deal has a next move",status:missingNextAction===0?"pass":"blocker",detail:`${deals.length} open deals; ${missingNextAction} missing a next action or due date.`,href:"/office",action:"Review sales tasks"},
    {title:"Daily priority agenda",status:agenda?"pass":"warning",detail:agenda?`Latest agenda: ${agenda.agenda_date}, with ${agenda.summary?.total||0} prioritized items.`:"No daily agenda has been generated.",href:"/office/roadmap",action:"Open today’s agenda"},
    {title:"Inbox and reply detection",status:mailbox?.status==="error"?"blocker":mailbox?.status==="healthy"?"pass":"warning",detail:mailbox?`${mailbox.mailbox}: ${mailbox.status}${mailbox.last_synced_at?` · synced ${formatDate(mailbox.last_synced_at)}`:""}.`:"Mailbox sync is not configured."},
    {title:"Daily reporting",status:!config?.daily_report_enabled?"warning":report?.status==="failed"?"warning":"pass",detail:!config?.daily_report_enabled?"Daily reporting is disabled.":report?`Latest report (${report.report_date}): ${report.status}.`:"Reporting is enabled; the first report has not been created yet."},
    {title:"Production incidents",status:(incidentsResult.data||[]).some(x=>x.severity==="critical")?"blocker":incidentsResult.count?"warning":"pass",detail:`${incidentsResult.count||0} unresolved critical or high-severity incidents.`,href:"/office/incidents",action:"Open Incident Center"},
  ];
  const blockers=gates.filter(x=>x.status==="blocker").length,warnings=gates.filter(x=>x.status==="warning").length;
  const overall=blockers?{title:"Not ready to launch",copy:`Resolve ${blockers} blocker${blockers===1?"":"s"} before turning on sales activity.`,classes:"border-red-400/30 bg-red-500/10 text-red-200"}:{title:warnings?"Ready for a controlled launch":"Ready to launch",copy:warnings?`Core systems are healthy. Complete or consciously accept ${warnings} remaining action${warnings===1?"":"s"}.`:"All core launch gates are healthy.",classes:"border-emerald-400/30 bg-emerald-500/10 text-emerald-200"};
  const switches=[
    ["Master automation",config?.master_enabled],
    ["Proposal email",config?.proposal_email_enabled],
    ["Prospecting",config?.prospecting_enabled&&!config?.outbound_auto_paused],
    ["Sequence follow-ups",config?.sequence_followups_enabled],
    ["Gmail ingestion",config?.gmail_ingestion_enabled],
  ];
  return <div className="space-y-8">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-3xl font-bold">B2B launch control</h2><p className="mt-2 text-slate-400">A live, read-only preflight check. This page never sends email, posts content, or changes a switch.</p></div><p className="text-sm text-slate-500">Checked {formatDate(new Date().toISOString())}</p></div>
    <section className={`rounded-2xl border p-6 ${overall.classes}`}><p className="text-sm font-bold uppercase tracking-[0.2em]">Launch decision</p><h3 className="mt-2 text-3xl font-bold text-white">{overall.title}</h3><p className="mt-2">{overall.copy}</p></section>
    {watchlistResult.data&&<p className="rounded-xl bg-white/5 p-4 text-sm text-slate-300">Automatic watchlist: <strong className="text-white">{watchlistResult.data.status}</strong> · {watchlistResult.data.blocker_count} blockers · {watchlistResult.data.warning_count} warnings · checked {formatDate(watchlistResult.data.created_at)}</p>}
    <Card title="Core launch gates" count={blockers} tone={blockers?"red":"green"}><div className="grid gap-3 lg:grid-cols-2">{gates.map(g=><Gate key={g.title} gate={g}/>)}</div></Card>
    <div className="grid gap-6 lg:grid-cols-2"><Card title="Activation switches"><div className="space-y-3">{switches.map(([name,on])=><div key={name} className="flex items-center justify-between rounded-lg bg-white/5 p-3 text-sm"><span>{name}</span><span className={on?"text-emerald-300":"text-amber-300"}>{on?"On":"Off"}</span></div>)}<p className="text-xs text-slate-500">Daily prospecting cap: {config?.daily_prospecting_cap??0}. Switches that are off are activation choices, not broken systems.</p><Link className="inline-block text-sm font-semibold text-purple-300 hover:text-purple-200" href="/office/settings">Review settings →</Link></div></Card>
    <Card title="Growth channels"><div className="space-y-3"><p className="text-sm"><strong>{distributionResult.count||0}</strong> distribution drafts await review.</p><p className="text-sm">Audience snapshot: <span className="text-slate-400">{audienceResult.data?.snapshot_date||"waiting"}</span></p><p className="text-sm">Growth brief: <span className="text-slate-400">{briefResult.data?.brief_date||"waiting"}</span></p><Gate gate={{title:"Reddit research",status:config?.organic_reddit_commercial_approval_confirmed?"pass":"optional",detail:config?.organic_reddit_commercial_approval_confirmed?"Commercial data-use approval is recorded.":"Waiting for written commercial approval. This does not block the core B2B launch."}}/></div></Card></div>
    <Card title="Controlled activation order"><ol className="list-decimal space-y-3 pl-5 text-sm text-slate-300"><li>Clear every red blocker above and complete Phase 1 certification.</li><li>Begin the inbound pilot with Gmail ingestion and reporting.</li><li>Enable human-approved proposal email after observing inbound operations.</li><li>Enable prospecting last with a low daily cap.</li><li>Leave Reddit research off until written commercial approval is recorded.</li></ol><Link className="mt-4 inline-block text-sm font-semibold text-purple-300" href="/office/activation">Open guided activation →</Link></Card>
  </div>;
}
