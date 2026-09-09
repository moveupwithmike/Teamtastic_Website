import Link from "next/link";
import { getOfficeDb } from "@/lib/server/office-auth";
import { signOutOffice } from "../actions";
import EddieWidget from "./eddie-widget";
import OfficeNavigation from "./office-navigation";
import { loadLiveRecordFilter } from "@/lib/server/office/live-records";

export const dynamic = "force-dynamic";

function NotificationPill({ href, count, label, tone = "red" }) {
  if (!count) return null;
  const tones = tone === "purple"
    ? "border-purple-400/25 bg-purple-500/10 text-purple-100 hover:bg-purple-500/20"
    : "border-red-400/25 bg-red-500/10 text-red-100 hover:bg-red-500/20";
  const badge = tone === "purple" ? "bg-purple-500" : "bg-red-500";
  return (
    <Link href={href} className={`flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition ${tones}`}>
      <span className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-bold text-white ${badge}`}>{count > 99 ? "99+" : count}</span>
      {label}
    </Link>
  );
}

export default async function PrivateOfficeLayout({ children }) {
  const { db, user } = await getOfficeDb();
  const now = new Date().toISOString();
  const [overdueResult, newLeadsResult, liveRecords] = await Promise.all([
    db.from("deals").select("id,created_at").eq("outcome", "open").lt("next_action_due_at", now).limit(1000),
    db.from("prospects").select("id,created_at").eq("status", "new").limit(1000),
    loadLiveRecordFilter(db, ["deal", "prospect"]),
  ]);
  const countsAvailable = liveRecords.ready && !overdueResult.error && !newLeadsResult.error;
  const overdueCount = countsAvailable ? (overdueResult.data || []).filter((row) => liveRecords.isLiveRecord("deal", row)).length : 0;
  const newLeadsCount = countsAvailable ? (newLeadsResult.data || []).filter((row) => liveRecords.isLiveRecord("prospect", row)).length : 0;
  return (
    <main className="mx-auto w-full max-w-[90rem] px-4 py-6 sm:px-6 sm:py-8">
      <header className="sticky top-3 z-40 mb-8 rounded-2xl border border-white/10 bg-slate-950/90 p-4 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/office/command-center" className="group rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-purple-300">Eddie command center</p>
            <h1 className="text-xl font-bold text-white group-hover:text-purple-100 sm:text-2xl">Teamtastic Office</h1>
          </Link>
          <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
            {!countsAvailable && <span className="rounded-full border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-200">Live counts unavailable</span>}
            <NotificationPill href="/office#overdue-deals" count={overdueCount} label={`Overdue deal${overdueCount === 1 ? "" : "s"}`} />
            <NotificationPill href="/office/prospects?status=new" count={newLeadsCount} label={`New lead${newLeadsCount === 1 ? "" : "s"}`} tone="purple" />
            <span className="hidden max-w-48 truncate text-xs text-slate-500 xl:inline" title={user.email}>{user.email}</span>
            <form action={signOutOffice}><button className="rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white">Sign out</button></form>
          </div>
        </div>
        <div className="mt-4"><OfficeNavigation /></div>
      </header>
      {children}
      <EddieWidget />
    </main>
  );
}
