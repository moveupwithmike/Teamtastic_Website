"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CalendarDays, Check, Clock3, Loader2, ShieldCheck, Sparkles } from "lucide-react";

function queryPrefill() {
  if (typeof window === "undefined") return { name: "", email: "", company: "", submissionId: "" };
  const params = new URLSearchParams(window.location.search);
  return {
    name: (params.get("name") || "").slice(0, 120),
    email: (params.get("email") || "").slice(0, 254),
    company: (params.get("company") || "").slice(0, 160),
    submissionId: (params.get("submission_id") || "").slice(0, 36),
  };
}

export default function BookingScheduler({ fallbackUrl }) {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [prefill, setPrefill] = useState({ name: "", email: "", company: "", submissionId: "" });
  const visitorTimezone = useMemo(() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York"; }
    catch { return "America/New_York"; }
  }, []);

  useEffect(() => {
    fetch("/api/bookings/config", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("configuration_unavailable");
        return response.json();
      })
      .then((nextConfig) => {
        setPrefill(queryPrefill());
        setConfig(nextConfig);
      })
      .catch(() => setConfig({ ready: false, bookingTypes: [] }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex min-h-72 items-center justify-center rounded-3xl border border-white/10 bg-white/[0.03]"><Loader2 className="h-7 w-7 animate-spin text-pink-400" /></div>;
  }

  if (!config?.ready) {
    return (
      <section className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.02] shadow-2xl">
        <div className="grid md:grid-cols-[1.05fr_0.95fr]">
          <div className="p-7 sm:p-10">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-pink-500/15 text-pink-300"><CalendarDays className="h-6 w-6" /></span>
            <h2 className="mt-6 text-2xl font-black">Our new booking desk is warming up.</h2>
            <p className="mt-3 leading-relaxed text-zinc-300">
              We’re connecting live calendar availability now. In the meantime, the current scheduler is still available so you can reserve a time without waiting.
            </p>
            <a
              href={`${fallbackUrl}${fallbackUrl.includes("?") ? "&" : "?"}${new URLSearchParams({ name: prefill.name, email: prefill.email })}`}
              className="mt-7 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-pink-600 px-5 text-sm font-bold text-white hover:bg-pink-500"
            >
              View available times <ArrowRight className="h-4 w-4" />
            </a>
          </div>
          <div className="border-t border-white/10 bg-black/20 p-7 md:border-l md:border-t-0 sm:p-10">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">What happens next</p>
            <div className="mt-6 space-y-5">
              {[
                [Clock3, "15 focused minutes", "We’ll quickly narrow the right format, timing, and next step."],
                [Sparkles, "Real recommendations", "No generic pitch—just useful ideas for your specific team."],
                [ShieldCheck, "No planning burden", "Teamtastic can build and facilitate the experience from start to finish."],
              ].map(([Icon, title, body]) => (
                <div key={title} className="flex gap-4">
                  <span className="mt-0.5 text-purple-300"><Icon className="h-5 w-5" /></span>
                  <div><h3 className="font-bold text-white">{title}</h3><p className="mt-1 text-sm leading-relaxed text-zinc-400">{body}</p></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-emerald-400/20 bg-emerald-500/[0.04] p-8">
      <Check className="h-7 w-7 text-emerald-300" />
      <h2 className="mt-4 text-2xl font-black">Live availability is connected.</h2>
      <p className="mt-2 text-zinc-300">Slot selection for {visitorTimezone} is the next component being activated.</p>
    </section>
  );
}
