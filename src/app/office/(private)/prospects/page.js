import Link from "next/link";
import { getOfficeDb } from "@/lib/server/office-auth";
import { formatDate } from "../../office-ui";

const STATUSES = ["new", "researching", "qualified", "nurturing", "contacted", "replied", "interested", "not_interested", "converted", "suppressed", "disqualified"];
const SOURCES = {
  inbound: "Inbound leads",
  apollo: "Apollo cold contacts",
  gmail_reply: "Gmail inbox imports",
  test: "Test records",
};
const AUDIENCES = {
  corporate: "Corporate",
  private: "Family / private",
  mixed: "Mixed-use contacts",
};

function sourceLabel(source) {
  return SOURCES[source] || source?.replaceAll("_", " ") || "Unknown source";
}

export default async function ProspectList({ searchParams }) {
  const params = await searchParams;
  const search = String(params?.q || "").trim().slice(0, 100);
  const status = STATUSES.includes(params?.status) ? params.status : "";
  const source = Object.hasOwn(SOURCES, params?.source) ? params.source : "";
  const audience = Object.hasOwn(AUDIENCES, params?.audience) ? params.audience : "";
  const db = (await getOfficeDb()).db;
  let query = db.from("prospects").select("id,company_id,full_name,email,job_title,source,status,audience_type,score,last_inbound_at,last_outbound_at,updated_at", { count: "exact" }).order("updated_at", { ascending: false }).limit(100);
  if (status) query = query.eq("status", status);
  if (source) query = query.eq("source", source);
  if (audience === "corporate") query = query.in("audience_type", ["corporate", "mixed"]);
  if (audience === "private") query = query.in("audience_type", ["family", "friends", "other_private_event", "mixed"]);
  if (audience === "mixed") query = query.eq("audience_type", "mixed");
  if (search) {
    const safe = search.replace(/[,()%]/g, " ");
    query = query.or(`full_name.ilike.%${safe}%,email.ilike.%${safe}%,job_title.ilike.%${safe}%`);
  }
  const { data: rawProspects = [], error } = await query;
  // Canonical test/QA exclusion boundary, matching office/(private)/page.js: a
  // prospect is synthetic if its linked lead carries context.synthetic_test — the
  // same signal automation.classify_lead_provenance() uses to classify it as
  // test_qa/certification. This list is an operational browsing view, not a
  // commercial-success metric, but it should still default to real records only
  // rather than mixing in rehearsal/certification data indistinguishably.
  const prospectIds = rawProspects.map((p) => p.id);
  const { data: linkedLeads = [] } = prospectIds.length
    ? await db.from("leads").select("prospect_id,context").in("prospect_id", prospectIds)
    : { data: [] };
  const syntheticProspectIds = new Set(linkedLeads.filter((lead) => lead.context?.synthetic_test === true).map((lead) => lead.prospect_id));
  const prospects = source === "test" ? rawProspects : rawProspects.filter((p) => !syntheticProspectIds.has(p.id));
  const count = source === "test" ? rawProspects.length : prospects.length;
  const companyIds = [...new Set(prospects.map((p) => p.company_id).filter(Boolean))];
  const { data: companies = [] } = companyIds.length ? await db.from("companies").select("id,name").in("id", companyIds) : { data: [] };
  const companyNames = new Map(companies.map((c) => [c.id, c.name]));

  return (
    <div className="space-y-6">
      <div><h2 className="text-3xl font-bold">Prospects and contacts</h2><p className="mt-2 text-slate-400">Separate inbound leads from sourced contacts, mailbox imports, and test records.</p></div>
      <div className="flex flex-wrap gap-2 text-sm">
        <Link href="/office/prospects?source=inbound" className={`rounded-full border px-4 py-2 ${source === "inbound" ? "border-emerald-400 bg-emerald-500/15 text-emerald-200" : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"}`}>Inbound leads</Link>
        <Link href="/office/prospects?source=apollo" className={`rounded-full border px-4 py-2 ${source === "apollo" ? "border-sky-400 bg-sky-500/15 text-sky-200" : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"}`}>Apollo cold contacts</Link>
        <Link href="/office/prospects?source=gmail_reply" className={`rounded-full border px-4 py-2 ${source === "gmail_reply" ? "border-amber-400 bg-amber-500/15 text-amber-200" : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"}`}>Gmail inbox imports</Link>
        <Link href="/office/prospects?source=test" className={`rounded-full border px-4 py-2 ${source === "test" ? "border-rose-400 bg-rose-500/15 text-rose-200" : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"}`}>Test records</Link>
        <Link href="/office/prospects" className={`rounded-full border px-4 py-2 ${!source ? "border-purple-400 bg-purple-500/15 text-purple-200" : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"}`}>All records</Link>
      </div>
      <div className="flex flex-wrap gap-2 text-sm">
        {Object.entries(AUDIENCES).map(([value, label]) => <Link key={value} href={`/office/prospects?audience=${value}`} className={`rounded-full border px-4 py-2 ${audience === value ? "border-fuchsia-400 bg-fuchsia-500/15 text-fuchsia-200" : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"}`}>{label}</Link>)}
        <Link href="/office/prospects" className={`rounded-full border px-4 py-2 ${!audience ? "border-purple-400 bg-purple-500/15 text-purple-200" : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"}`}>All audiences</Link>
      </div>
      <form className="grid gap-3 rounded-2xl border border-white/10 bg-slate-900/65 p-4 sm:grid-cols-[minmax(220px,1fr)_180px_190px_190px_auto]">
        <input name="q" defaultValue={search} placeholder="Search name, email, or job title" className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 outline-none focus:border-purple-400" />
        <select name="status" defaultValue={status} className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3"><option value="">All statuses</option>{STATUSES.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</select>
        <select name="source" defaultValue={source} className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3"><option value="">All sources</option>{Object.entries(SOURCES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <select name="audience" defaultValue={audience} className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3"><option value="">All audiences</option>{Object.entries(AUDIENCES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <button className="rounded-xl bg-purple-600 px-5 py-3 font-semibold hover:bg-purple-500">Search</button>
      </form>
      <p className="text-sm text-slate-400">{error ? "The list could not be loaded." : `${count ?? prospects.length} ${source ? sourceLabel(source).toLowerCase() : "total record"}${count === 1 ? "" : "s"}`}{(count || 0) > 100 ? " · showing the 100 most recently updated" : ""}</p>
      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/65">
        <table className="w-full min-w-[850px] text-left text-sm">
          <thead className="border-b border-white/10 text-xs uppercase tracking-wide text-slate-400"><tr><th className="p-4">Prospect</th><th className="p-4">Company / role</th><th className="p-4">Audience</th><th className="p-4">Status</th><th className="p-4">Source</th><th className="p-4">Score</th><th className="p-4">Last activity</th></tr></thead>
          <tbody>{prospects.map((prospect) => <tr key={prospect.id} className="border-b border-white/5 hover:bg-white/[0.03]"><td className="p-4"><Link href={`/office/prospects/${prospect.id}`} className="font-semibold text-purple-300 hover:text-purple-200">{prospect.full_name || prospect.email || "Unknown"}</Link><p className="text-slate-400">{prospect.email}</p></td><td className="p-4">{companyNames.get(prospect.company_id) || "—"}<p className="text-slate-500">{prospect.job_title}</p></td><td className="p-4 capitalize text-slate-300">{prospect.audience_type?.replaceAll("_", " ") || "corporate"}</td><td className="p-4"><span className="rounded-full bg-white/5 px-3 py-1">{prospect.status.replaceAll("_", " ")}</span></td><td className="p-4 text-slate-300">{sourceLabel(prospect.source)}</td><td className="p-4">{prospect.score ?? "—"}</td><td className="p-4 text-slate-400">{formatDate(prospect.last_inbound_at || prospect.last_outbound_at || prospect.updated_at)}</td></tr>)}</tbody>
        </table>
        {!prospects.length && <p className="p-8 text-center text-slate-400">No prospects match those filters.</p>}
      </div>
    </div>
  );
}
