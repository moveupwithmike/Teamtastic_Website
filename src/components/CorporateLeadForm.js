"use client";

import { useCallback, useState } from "react";
import { ArrowRight, Calendar, Check, Loader2 } from "lucide-react";
import TurnstileWidget from "@/components/TurnstileWidget";
import { captureLead, createSubmissionId } from "@/lib/lead-client";
import { track } from "@/lib/analytics";
import CheckoutButton from "@/components/CheckoutButton";

const initialForm = {
  name: "",
  email: "",
  company: "",
  teamSize: "",
  occasion: "",
  vibe: "",
};

export default function CorporateLeadForm({
  isFamily = false,
  source = isFamily ? "michael_family_concierge" : "michael_event_concierge",
  entryPoint = isFamily ? "family_landing_inline" : "corporate_landing_inline",
  eyebrow = isFamily ? "Fast family check" : "Fast event check",
  title = "Get availability and pricing",
  subtitle = isFamily
    ? "$35 per person · $250 minimum · $100 reserves your date"
    : "$35 per person · $350 minimum · $200 reserves your date",
  successTitle = isFamily ? "Your game night request is saved." : "Your event brief is saved.",
  successBody = "Michael will follow up within one business day. You can reserve your date now or choose a planning call.",
  submitLabel = "Check availability",
  depositLabel = isFamily ? "Reserve with $100 deposit" : "Reserve with $200 deposit",
  defaultOccasion = "",
} = {}) {
  const [form, setForm] = useState({ ...initialForm, occasion: defaultOccasion });
  const [submissionId, setSubmissionId] = useState(() => createSubmissionId());
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileReset, setTurnstileReset] = useState(0);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const handleToken = useCallback((token) => setTurnstileToken(token), []);

  const update = (event) => setForm((current) => ({
    ...current,
    [event.target.name]: event.target.value,
  }));

  const bookingUrl = `/book?${new URLSearchParams({
    name: form.name,
    email: form.email,
    company: form.company,
    submission_id: submissionId,
  })}`;

  async function submit(event) {
    event.preventDefault();
    if (!turnstileToken) {
      setError("Please complete secure verification.");
      return;
    }
    setStatus("submitting");
    setError("");
    track("lead_submit_attempted", {
      source,
      team_size: form.teamSize,
      occasion: form.occasion,
      vibe: form.vibe,
    });
    try {
      await captureLead({
        submissionId,
        source,
        ...form,
        turnstileToken,
        context: { entry_point: entryPoint },
      });
      setStatus("success");
      track("lead_captured", {
        source,
        team_size: form.teamSize,
        occasion: form.occasion,
        vibe: form.vibe,
      });
    } catch (leadError) {
      setError(leadError.message || "We couldn't save your details. Please try again.");
      setStatus("idle");
      setTurnstileToken("");
      setTurnstileReset((value) => value + 1);
      track("lead_capture_failed", {
        source,
        code: leadError.code,
      });
    }
  }

  if (status === "success") {
    return (
      <div className="rounded-3xl border border-emerald-400/25 bg-emerald-500/5 p-7 sm:p-9">
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
            <Check className="h-6 w-6" />
          </span>
          <div>
            <h3 className="text-2xl font-extrabold text-white">{successTitle}</h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-300">
              {successBody}
            </p>
          </div>
        </div>
        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          <CheckoutButton
            submissionId={submissionId}
            paymentKind={isFamily ? "family_deposit" : "corporate_deposit"}
            onClick={() => track("deposit_cta_clicked", { source: entryPoint })}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#D81B60] px-5 text-center text-sm font-bold text-white hover:bg-pink-600"
          >
            {depositLabel} <ArrowRight className="h-4 w-4" />
          </CheckoutButton>
          <a
            href={bookingUrl}
            onClick={() => track("booking_call_clicked", { source: entryPoint })}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 text-center text-sm font-bold text-white hover:bg-white/10"
          >
            <Calendar className="h-4 w-4" /> Book a 15-minute call
          </a>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-3xl border border-white/10 bg-zinc-950/75 p-6 shadow-2xl sm:p-8">
      <div className="mb-6">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-pink">{eyebrow}</p>
        <h3 className="mt-2 text-2xl font-extrabold text-white">{title}</h3>
        <p className="mt-2 text-sm text-zinc-400">{subtitle}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <input required name="name" value={form.name} onChange={update} placeholder="Your name" aria-label="Your name" className="h-12 rounded-xl border border-white/10 bg-white/5 px-4 text-white placeholder:text-zinc-500" />
        <input required type="email" name="email" value={form.email} onChange={update} placeholder="Work email" aria-label="Work email" className="h-12 rounded-xl border border-white/10 bg-white/5 px-4 text-white placeholder:text-zinc-500" />
        <input required={!isFamily} name="company" value={form.company} onChange={update} placeholder={isFamily ? "Family / group name (optional)" : "Company"} aria-label={isFamily ? "Family or group name" : "Company"} className="h-12 rounded-xl border border-white/10 bg-white/5 px-4 text-white placeholder:text-zinc-500" />
        <select required name="teamSize" value={form.teamSize} onChange={update} aria-label={isFamily ? "Group size" : "Team size"} className="h-12 rounded-xl border border-white/10 bg-zinc-900 px-4 text-white">
          {isFamily ? (
            <>
              <option value="">Group size</option>
              <option value="under-10">Under 10</option><option value="10-25">10–25</option>
              <option value="25-50">25–50</option><option value="50+">50+</option>
            </>
          ) : (
            <>
              <option value="">Team size</option>
              <option value="under-15">Under 15</option><option value="15-50">15–50</option>
              <option value="50-150">50–150</option><option value="150+">150+</option>
            </>
          )}
        </select>
        <select required name="occasion" value={form.occasion} onChange={update} aria-label="Occasion" className="h-12 rounded-xl border border-white/10 bg-zinc-900 px-4 text-white">
          {isFamily ? (
            <>
              <option value="">What are you planning?</option>
              <option value="birthday">Birthday</option><option value="reunion">Reunion</option>
              <option value="holiday">Holiday gathering</option><option value="anniversary">Anniversary</option>
              <option value="graduation">Graduation</option><option value="long-distance">Long-distance family night</option>
            </>
          ) : (
            <>
              <option value="">What are you planning?</option>
              <option value="social-hour">Team social</option><option value="holiday">Holiday event</option>
              <option value="onboarding">Onboarding</option><option value="private-milestone">Milestone celebration</option>
            </>
          )}
        </select>
        <select name="vibe" value={form.vibe} onChange={update} aria-label="Preferred vibe (optional)" className="h-12 rounded-xl border border-white/10 bg-zinc-900 px-4 text-white">
          {isFamily ? (
            <>
              <option value="">Preferred vibe (optional)</option>
              <option value="high-energy">High-energy competition</option><option value="funny-casual">Funny and casual</option>
              <option value="creative-silly">Creative and silly</option><option value="celebration">Celebration and awards</option>
            </>
          ) : (
            <>
              <option value="">Preferred vibe (optional)</option>
              <option value="competitive">Competitive</option><option value="social">Funny and social</option>
              <option value="collaborative">Collaborative</option><option value="icebreaker">Easy icebreaker</option>
            </>
          )}
        </select>
      </div>
      <div className="mt-5"><TurnstileWidget onToken={handleToken} resetKey={turnstileReset} /></div>
      {error && <p role="alert" className="mt-3 text-sm text-rose-400">{error}</p>}
      <button disabled={status === "submitting" || !turnstileToken} className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#D81B60] px-5 text-sm font-bold text-white hover:bg-pink-600 disabled:cursor-not-allowed disabled:opacity-40">
        {status === "submitting" ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving securely…</> : <>{submitLabel} <ArrowRight className="h-4 w-4" /></>}
      </button>
      <p className="mt-3 text-center text-xs text-zinc-500">No obligation. We’ll reply within one business day.</p>
    </form>
  );
}
