import Link from "next/link";

/** @param {{title: string, count?: number, children: any, tone?: string, id?: string}} props */
export function Card({ title, count, children, tone = "purple", id }) {
  const tones = { purple: "text-purple-300", red: "text-red-300", gold: "text-amber-300", green: "text-emerald-300" };
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section id={id} aria-labelledby={headingId} className="scroll-mt-40 rounded-2xl border border-white/10 bg-slate-900/65 p-5 shadow-sm shadow-black/10">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id={headingId} className="text-lg font-semibold">{title}</h2>
        {count !== undefined && <span className={`rounded-full bg-white/5 px-3 py-1 text-sm font-bold ${tones[tone]}`}>{count}</span>}
      </div>
      {children}
    </section>
  );
}

const KPI_TONES = {
  red: "border-red-400/25 bg-red-500/[0.06] text-red-300",
  gold: "border-amber-400/25 bg-amber-500/[0.06] text-amber-300",
  green: "border-emerald-400/25 bg-emerald-500/[0.06] text-emerald-300",
  purple: "border-purple-400/25 bg-purple-500/[0.06] text-purple-300",
};

/** @param {{label: string, value: number|string, href?: string, tone?: string, detail?: string}} props */
export function KpiTile({ label, value, href, tone = "purple", detail }) {
  const content = (
    <div className={`h-full rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:brightness-110 ${KPI_TONES[tone] || KPI_TONES.purple}`}>
      <div className="flex items-start justify-between gap-3"><p className="text-3xl font-bold text-white">{value}</p>{href && <span aria-hidden="true" className="text-sm opacity-60">↗</span>}</div>
      <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-300">{label}</p>
      {detail && <p className="mt-2 text-xs leading-relaxed text-slate-500">{detail}</p>}
    </div>
  );
  return href ? <Link href={href} className="block">{content}</Link> : content;
}

export function Empty({ children = "Nothing needs attention." }) {
  return <p className="rounded-xl bg-emerald-500/5 p-4 text-sm text-emerald-300">{children}</p>;
}

/** @param {{id: string, name?: string, email?: string}} props */
export function ProspectLink({ id, name, email }) {
  return <Link className="font-semibold text-purple-300 hover:text-purple-200" href={`/office/prospects/${id}`}>{name || email || "Unknown prospect"}</Link>;
}

export function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function formatMoney(value, currency = "usd") {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(Number(value));
}

export const inputClass = "mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-purple-400";
export const buttonClass = "rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold hover:bg-purple-500";
