"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const PRIMARY_LINKS = [
  ["Dashboard", "/office/command-center"],
  ["My work", "/office"],
  ["Prospects", "/office/prospects"],
  ["Appointments", "/office/appointments"],
  ["Talk to Eddie", "/office/morning-brief"],
];

const GROUPS = [
  {
    label: "Sales",
    links: [["Today’s agenda", "/office/roadmap"], ["Respond", "/office/respond"], ["Lead scoring", "/office/scoring"], ["Warm signals", "/office/warm-signals"]],
  },
  {
    label: "Marketing",
    links: [["Growth brief", "/office/growth"], ["Campaign ROI", "/office/roi"], ["Audience", "/office/audience"], ["Intent radar", "/office/organic"]],
  },
  {
    label: "Social",
    links: [["Social desk", "/office/distribution"], ["Social accounts", "/office/social-accounts"], ["Voice library", "/office/voice"]],
  },
  {
    label: "Operations",
    links: [["Launch control", "/office/launch"], ["Conversion health", "/office/health"], ["Incidents", "/office/incidents"], ["Activity feed", "/office/activity"], ["Deliverability", "/office/deliverability"], ["Holiday SLA", "/office/sla"], ["Capacity", "/office/capacity"], ["Certification", "/office/certification"], ["Final certification", "/office/final-certification"], ["Activation", "/office/activation"], ["Settings", "/office/settings"]],
  },
];

function isActive(pathname, href) {
  if (href === "/office") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({ href, label, compact = false }) {
  const pathname = usePathname();
  const active = isActive(pathname || "", href);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`${compact ? "block px-3 py-2.5" : "rounded-xl px-3 py-2"} text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 ${active ? "bg-purple-500/20 text-purple-100 ring-1 ring-inset ring-purple-400/30" : "text-slate-300 hover:bg-white/[0.07] hover:text-white"}`}
    >
      {label}
    </Link>
  );
}

function GroupMenu({ group }) {
  const pathname = usePathname() || "";
  const groupActive = group.links.some(([, href]) => isActive(pathname, href));
  return (
    <details className="group relative">
      <summary className={`cursor-pointer list-none rounded-xl px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 [&::-webkit-details-marker]:hidden ${groupActive ? "bg-purple-500/20 text-purple-100 ring-1 ring-inset ring-purple-400/30" : "text-slate-300 hover:bg-white/[0.07] hover:text-white"}`}>
        {group.label} <span aria-hidden="true" className="ml-1 inline-block text-[10px] transition group-open:rotate-180">▼</span>
      </summary>
      <div className="absolute left-0 top-[calc(100%+0.5rem)] z-50 min-w-52 rounded-xl border border-white/10 bg-slate-950/98 p-2 shadow-2xl backdrop-blur">
        {group.links.map(([label, href]) => <NavLink key={href} href={href} label={label} compact />)}
      </div>
    </details>
  );
}

export default function OfficeNavigation() {
  return (
    <nav aria-label="Office navigation" className="border-t border-white/10 pt-3">
      <div className="hidden flex-wrap items-center gap-1 lg:flex">
        {PRIMARY_LINKS.map(([label, href]) => <NavLink key={href} href={href} label={label} />)}
        <span className="mx-1 h-6 w-px bg-white/10" aria-hidden="true" />
        {GROUPS.map((group) => <GroupMenu key={group.label} group={group} />)}
      </div>

      <details className="group lg:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between rounded-xl bg-white/5 px-4 py-3 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 [&::-webkit-details-marker]:hidden">
          Navigate Office <span aria-hidden="true" className="transition group-open:rotate-180">⌄</span>
        </summary>
        <div className="mt-2 max-h-[65vh] overflow-y-auto rounded-xl border border-white/10 bg-slate-950/95 p-2">
          <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Main</p>
          {PRIMARY_LINKS.map(([label, href]) => <NavLink key={href} href={href} label={label} compact />)}
          {GROUPS.map((group) => (
            <div key={group.label} className="mt-2 border-t border-white/10 pt-2">
              <p className="px-3 pb-1 pt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{group.label}</p>
              {group.links.map(([label, href]) => <NavLink key={href} href={href} label={label} compact />)}
            </div>
          ))}
        </div>
      </details>
    </nav>
  );
}
