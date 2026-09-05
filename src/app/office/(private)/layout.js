import Link from "next/link";
import { requireOfficeUser } from "@/lib/server/office-auth";
import { signOutOffice } from "../actions";

export const dynamic = "force-dynamic";

export default async function PrivateOfficeLayout({ children }) {
  const user = await requireOfficeUser();
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-slate-900/70 p-5">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-purple-300">Sales command center</p>
          <h1 className="text-2xl font-bold">Teamtastic Office</h1>
        </div>
        <nav className="flex flex-wrap items-center gap-3 text-sm">
          <Link className="rounded-lg bg-white/5 px-4 py-2 hover:bg-white/10" href="/office">Needs Michael</Link>
          <Link className="rounded-lg bg-white/5 px-4 py-2 hover:bg-white/10" href="/office/roadmap">Today</Link>
          <Link className="rounded-lg bg-white/5 px-4 py-2 hover:bg-white/10" href="/office/prospects">Prospects</Link>
          <Link className="rounded-lg bg-white/5 px-4 py-2 hover:bg-white/10" href="/office/organic">Intent radar</Link>
          <Link className="rounded-lg bg-white/5 px-4 py-2 hover:bg-white/10" href="/office/growth">Growth brief</Link>
          <Link className="rounded-lg bg-white/5 px-4 py-2 hover:bg-white/10" href="/office/roi">Campaign ROI</Link>
          <Link className="rounded-lg bg-white/5 px-4 py-2 hover:bg-white/10" href="/office/scoring">Lead scoring</Link>
          <Link className="rounded-lg bg-white/5 px-4 py-2 hover:bg-white/10" href="/office/warm-signals">Warm signals</Link>
          <Link className="rounded-lg bg-white/5 px-4 py-2 hover:bg-white/10" href="/office/respond">Respond</Link>
          <Link className="rounded-lg bg-white/5 px-4 py-2 hover:bg-white/10" href="/office/distribution">Distribution</Link>
          <Link className="rounded-lg bg-white/5 px-4 py-2 hover:bg-white/10" href="/office/audience">Audience</Link>
          <Link className="rounded-lg bg-white/5 px-4 py-2 hover:bg-white/10" href="/office/health">Health</Link>
          <Link className="rounded-lg bg-white/5 px-4 py-2 hover:bg-white/10" href="/office/launch">Launch</Link>
          <Link className="rounded-lg bg-white/5 px-4 py-2 hover:bg-white/10" href="/office/sla">Holiday SLA</Link>
          <Link className="rounded-lg bg-white/5 px-4 py-2 hover:bg-white/10" href="/office/capacity">Capacity</Link>
          <Link className="rounded-lg bg-white/5 px-4 py-2 hover:bg-white/10" href="/office/certification">Certification</Link>
          <Link className="rounded-lg bg-white/5 px-4 py-2 hover:bg-white/10" href="/office/final-certification">Final certification</Link>
          <Link className="rounded-lg bg-white/5 px-4 py-2 hover:bg-white/10" href="/office/activation">Activate</Link>
          <Link className="rounded-lg bg-white/5 px-4 py-2 hover:bg-white/10" href="/office/deliverability">Delivery</Link>
          <Link className="rounded-lg bg-white/5 px-4 py-2 hover:bg-white/10" href="/office/incidents">Incidents</Link>
          <Link className="rounded-lg bg-white/5 px-4 py-2 hover:bg-white/10" href="/office/activity">Activity feed</Link>
          <Link className="rounded-lg bg-white/5 px-4 py-2 hover:bg-white/10" href="/office/settings">Settings</Link>
          <span className="hidden text-slate-400 md:inline">{user.email}</span>
          <form action={signOutOffice}><button className="rounded-lg border border-white/10 px-4 py-2 hover:bg-white/5">Sign out</button></form>
        </nav>
      </header>
      {children}
    </main>
  );
}
