import Link from "next/link";

/** @param {{title: string, count?: number, children: any, tone?: string}} props */
export function Card({ title, count, children, tone = "purple" }) {
  const tones = { purple: "text-purple-300", red: "text-red-300", gold: "text-amber-300", green: "text-emerald-300" };
  return (
    <section className="rounded-2xl border border-white/10 bg-slate-900/65 p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        {count !== undefined && <span className={`rounded-full bg-white/5 px-3 py-1 text-sm font-bold ${tones[tone]}`}>{count}</span>}
      </div>
      {children}
    </section>
  );
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
