"use client";

import { useCallback, useState } from "react";
import { Check, Download, Loader2 } from "lucide-react";
import TurnstileWidget from "@/components/TurnstileWidget";
import { captureLead, createSubmissionId } from "@/lib/lead-client";
import { track } from "@/lib/analytics";

export default function HolidayChecklistForm() {
  const [form, setForm] = useState({ name: "", email: "", company: "" });
  const [submissionId] = useState(() => createSubmissionId());
  const [token, setToken] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const handleToken = useCallback((value) => setToken(value), []);

  async function submit(event) {
    event.preventDefault();
    if (!token) return setError("Please complete secure verification.");
    setStatus("submitting");
    setError("");
    try {
      await captureLead({
        submissionId,
        source: "holiday_planning_checklist",
        name: form.name,
        email: form.email,
        company: form.company,
        turnstileToken: token,
        context: { entry_point: "holiday_checklist_download", lead_magnet: "holiday_party_planning_checklist" },
      });
      setStatus("success");
      track("lead_captured", { source: "holiday_planning_checklist", asset: "holiday_party_planning_checklist" });
    } catch (submitError) {
      setStatus("idle");
      setError(submitError.message || "We couldn't prepare the checklist. Please try again.");
    }
  }

  if (status === "success") {
    return (
      <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/5 p-6">
        <div className="flex items-center gap-3 text-emerald-300"><Check className="h-5 w-5" /><strong>Your checklist is ready.</strong></div>
        <a href="/holiday-party-planning-checklist.txt" download onClick={() => track("holiday_checklist_downloaded", { source: "holiday_page" })} className="mt-5 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-bold text-zinc-950 hover:bg-zinc-200">
          <Download className="h-4 w-4" /> Download the checklist
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <h3 className="text-xl font-extrabold text-white">Not ready to request dates?</h3>
      <p className="mt-2 text-sm text-zinc-400">Get the practical holiday planning checklist and keep your options organized.</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name" aria-label="Your name" className="h-12 rounded-xl border border-white/10 bg-zinc-900 px-4 text-white placeholder:text-zinc-500" />
        <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Work email" aria-label="Work email" className="h-12 rounded-xl border border-white/10 bg-zinc-900 px-4 text-white placeholder:text-zinc-500" />
        <input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="Company (optional)" aria-label="Company (optional)" className="h-12 rounded-xl border border-white/10 bg-zinc-900 px-4 text-white placeholder:text-zinc-500" />
      </div>
      <div className="mt-4"><TurnstileWidget onToken={handleToken} /></div>
      {error && <p role="alert" className="mt-3 text-sm text-rose-400">{error}</p>}
      <button disabled={status === "submitting" || !token} className="mt-4 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#D81B60] px-5 text-sm font-bold text-white disabled:opacity-40">
        {status === "submitting" ? <><Loader2 className="h-4 w-4 animate-spin" /> Preparing…</> : <><Download className="h-4 w-4" /> Get the free checklist</>}
      </button>
      <p className="mt-3 text-xs text-zinc-500">Planning help only. No obligation.</p>
    </form>
  );
}
