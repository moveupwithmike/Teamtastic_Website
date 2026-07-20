import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import { formatDate } from "../../office-ui";

const STATUSES = ["new", "researching", "qualified", "nurturing", "contacted", "replied", "interested", "not_interested", "converted", "suppressed", "disqualified"];

export default async function ProspectList({ searchParams }) {
  const params = await searchParams;
  const search = String(params?.q || "").trim().slice(0, 100);
  const status = STATUSES.includes(params?.status) ? params.status : "";
  const db = getSupabaseAdmin();
  let query = db.from("prospects").select("id,company_id,full_name,email,job_title,source,status,score,last_inbound_at,last_outbound_at,updated_at", { count: "exact" }).order("updated_at", { ascending: false }).limit(100);
  if (status) query = query.eq("status", status);
  if (search) {
    const safe = search.replace(/[,()%]/g, " ");
    query = query.or(`full_name.ilike.%${safe}%,email.ilike.%${safe}%,job_title.ilike.%${safe}%`);
  }
  const { data: prospects = [], count, error } = await query;
  const companyIds = [...new Set(prospects.map((p) => p.company_id).filter(Boolean))];
  const { data: companies = [] } = companyIds.length ? await db.from("companies").select("id,name").in("id", companyIds) : { data: [] };
  const companyNames = new Map(companies.map((c) => [c.id, c.name]));

  return (
    <div className="space-y-6">
      <div><h2 className="text-3xl font-bold">Prospects</h2><p className="mt-2 text-slate-400">Search every lead and open their complete sales timeline.</p></div>
      <form className="grid gap-3 rounded-2xl border border-white/10 bg-slate-900/65 p-4 sm:grid-cols-[1fr_220px_auto]">
        <input name="q" defaultValue={search} placeholder="Search name, email, or job title" className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 outline-none focus:border-purple-400" />
        <select name="status" defaultValue={status} className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3"><option value="">All statuses</option>{STATUSES.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</select>
        <button className="rounded-xl bg-purple-600 px-5 py-3 font-semibold hover:bg-purple-500">Search</button>
      </form>
      <p className="text-sm text-slate-400">{error ? "The list could not be loaded." : `${count ?? prospects.length} prospect${count === 1 ? "" : "s"}`}{(count || 0) > 100 ? " · showing the 100 most recently updated" : ""}</p>
      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/65">
        <table className="w-full min-w-[850px] text-left text-sm">
          <thead className="border-b border-white/10 text-xs uppercase tracking-wide text-slate-400"><tr><th className="p-4">Prospect</th><th className="p-4">Company / role</th><th className="p-4">Status</th><th className="p-4">Source</th><th className="p-4">Score</th><th className="p-4">Last activity</th></tr></thead>
          <tbody>{prospects.map((prospect) => <tr key={prospect.id} className="border-b border-white/5 hover:bg-white/[0.03]"><td className="p-4"><Link href={`/office/prospects/${prospect.id}`} className="font-semibold text-purple-300 hover:text-purple-200">{prospect.full_name || prospect.email || "Unknown"}</Link><p className="text-slate-400">{prospect.email}</p></td><td className="p-4">{companyNames.get(prospect.company_id) || "—"}<p className="text-slate-500">{prospect.job_title}</p></td><td className="p-4"><span className="rounded-full bg-white/5 px-3 py-1">{prospect.status.replaceAll("_", " ")}</span></td><td className="p-4 text-slate-300">{prospect.source}</td><td className="p-4">{prospect.score ?? "—"}</td><td className="p-4 text-slate-400">{formatDate(prospect.last_inbound_at || prospect.last_outbound_at || prospect.updated_at)}</td></tr>)}</tbody>
        </table>
        {!prospects.length && <p className="p-8 text-center text-slate-400">No prospects match those filters.</p>}
      </div>
    </div>
  );
}
