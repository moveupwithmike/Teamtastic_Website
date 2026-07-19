"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CalendarDays, CheckCircle2, Clock3, Loader2, ShieldCheck, Sparkles } from "lucide-react";

const CONFIRM_ERROR_MESSAGES = {
  invalid_request: "Please check your name and email and try again.",
  rate_limited: "Too many attempts. Please wait a few minutes and try again.",
  slot_unavailable: "That time was just taken. Please pick another slot.",
  minimum_notice: "That time is too soon. Please pick a later slot.",
  outside_booking_horizon: "That date isn't open yet. Please pick a closer date.",
  daily_limit: "That day is fully booked. Please pick another date.",
  request_already_used: "This request was already submitted.",
  booking_type_unavailable: "That call type is no longer available.",
  zoom_meeting_failed: "We couldn't finish setting up the call. Please try again or email hello@teamtastic.events.",
  calendar_event_failed: "We couldn't finish setting up the call. Please try again or email hello@teamtastic.events.",
};

function confirmErrorMessage(reason) {
  return CONFIRM_ERROR_MESSAGES[reason] || "Something went wrong. Please try again or email hello@teamtastic.events.";
}

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

function dateInZone(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function upcomingDates(timeZone) {
  const dates = [];
  for (let offset = 0; offset < 21 && dates.length < 14; offset += 1) {
    const value = dateInZone(new Date(Date.now() + offset * 86400000), timeZone);
    if (!dates.includes(value)) dates.push(value);
  }
  return dates;
}

function dateLabel(date, timeZone) {
  return new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", month: "short", day: "numeric" }).format(new Date(`${date}T12:00:00Z`));
}

function LiveSlots({ date, bookingType, visitorTimezone, selectedSlot, onSelect }) {
  const [result, setResult] = useState({ loading: true, slots: [] });
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/bookings/availability?${new URLSearchParams({ date, type: bookingType, timezone: visitorTimezone })}`, {
      cache: "no-store", signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !data.available) throw new Error(data.reason || "availability_unavailable");
        setResult({ loading: false, slots: data.slots || [] });
      })
      .catch((error) => {
        if (error.name !== "AbortError") setResult({ loading: false, slots: [], error: true });
      });
    return () => controller.abort();
  }, [date, bookingType, visitorTimezone]);

  if (result.loading) return <div className="flex min-h-36 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-pink-400" /></div>;
  if (result.error) return <p className="rounded-xl border border-amber-400/20 bg-amber-500/5 p-4 text-sm text-amber-200">Live availability is temporarily unavailable. Please try another date.</p>;
  if (!result.slots.length) return <p className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-zinc-400">No open times on this date. Try the next day.</p>;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {result.slots.map((slot) => {
        const isSelected = selectedSlot?.startsAt === slot.startsAt;
        return (
          <button
            key={slot.startsAt} type="button" onClick={() => onSelect(slot)}
            aria-pressed={isSelected}
            className={`min-h-11 rounded-xl border px-3 text-sm font-bold transition-colors ${
              isSelected
                ? "border-pink-400/70 bg-pink-500/20 text-white"
                : "border-white/10 bg-white/5 text-white hover:border-pink-400/50 hover:bg-pink-500/10"
            }`}
          >
            {new Intl.DateTimeFormat("en-US", { timeZone: visitorTimezone, hour: "numeric", minute: "2-digit" }).format(new Date(slot.startsAt))}
          </button>
        );
      })}
    </div>
  );
}

export default function BookingScheduler({ fallbackUrl }) {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [prefill, setPrefill] = useState({ name: "", email: "", company: "", submissionId: "" });
  const [selectedType, setSelectedType] = useState("intro-call-15");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [contact, setContact] = useState({ name: "", email: "", company: "" });
  const [confirmState, setConfirmState] = useState({ status: "idle" });
  const visitorTimezone = useMemo(() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York"; }
    catch { return "America/New_York"; }
  }, []);
  const ownerTimezone = config?.ownerTimezone;
  const dates = useMemo(() => ownerTimezone ? upcomingDates(ownerTimezone) : [], [ownerTimezone]);
  const activeDate = selectedDate || dates[0] || "";

  useEffect(() => {
    fetch("/api/bookings/config", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("configuration_unavailable");
        return response.json();
      })
      .then((nextConfig) => {
        const nextPrefill = queryPrefill();
        setPrefill(nextPrefill);
        setContact({ name: nextPrefill.name, email: nextPrefill.email, company: nextPrefill.company });
        setConfig(nextConfig);
      })
      .catch(() => setConfig({ ready: false, bookingTypes: [] }))
      .finally(() => setLoading(false));
  }, []);

  async function confirmBooking() {
    if (!selectedSlot || confirmState.status === "loading") return;
    if (!contact.name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) {
      setConfirmState({ status: "error", reason: "invalid_request" });
      return;
    }
    setConfirmState({ status: "loading" });
    try {
      const response = await fetch("/api/bookings/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingTypeSlug: selectedType,
          name: contact.name.trim(),
          email: contact.email.trim(),
          company: contact.company.trim(),
          visitorTimezone,
          startsAt: selectedSlot.startsAt,
          submissionId: prefill.submissionId || undefined,
          source: "book_page",
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setConfirmState({ status: "error", reason: data.reason });
        return;
      }
      setConfirmState({ status: "success", booking: data });
    } catch {
      setConfirmState({ status: "error", reason: "network_error" });
    }
  }

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
    <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] shadow-2xl">
      <div className="grid lg:grid-cols-[0.8fr_1.2fr]">
        <div className="min-w-0 border-b border-white/10 p-6 lg:border-b-0 lg:border-r sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-pink-400">Choose a call</p>
          <div className="mt-5 space-y-3">
            {(config.bookingTypes || []).map((type) => (
              <button key={type.slug} type="button" onClick={() => { setSelectedType(type.slug); setSelectedSlot(null); setConfirmState({ status: "idle" }); }} className={`w-full rounded-2xl border p-4 text-left ${selectedType === type.slug ? "border-pink-400/60 bg-pink-500/10" : "border-white/10 bg-black/20 hover:border-white/20"}`}>
                <span className="font-bold text-white">{type.name}</span>
                <span className="mt-1 flex items-center gap-1 text-xs text-zinc-400"><Clock3 className="h-3.5 w-3.5" /> {type.duration_minutes} minutes</span>
                <span className="mt-2 block text-sm leading-relaxed text-zinc-400">{type.description}</span>
              </button>
            ))}
          </div>
          <p className="mt-6 text-xs leading-relaxed text-zinc-500">Times are displayed in {visitorTimezone.replaceAll("_", " ")}.</p>
        </div>
        <div className="min-w-0 p-6 sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Choose a date</p>
          <div className="mt-4 flex gap-2 overflow-x-auto pb-3">
            {dates.map((date) => (
              <button key={date} type="button" onClick={() => { setSelectedDate(date); setSelectedSlot(null); setConfirmState({ status: "idle" }); }} className={`min-w-24 rounded-xl border px-3 py-3 text-sm font-bold ${activeDate === date ? "border-purple-400/60 bg-purple-500/15 text-white" : "border-white/10 bg-black/20 text-zinc-400 hover:text-white"}`}>
                {dateLabel(date, config.ownerTimezone)}
              </button>
            ))}
          </div>
          <div className="mt-5">
            {activeDate && <LiveSlots key={`${selectedType}:${activeDate}`} date={activeDate} bookingType={selectedType} visitorTimezone={visitorTimezone} selectedSlot={selectedSlot} onSelect={(slot) => { setSelectedSlot(slot); setConfirmState({ status: "idle" }); }} />}
          </div>
          {selectedSlot && confirmState.status === "success" && (
            <div className="mt-6 flex items-start gap-3 rounded-2xl border border-emerald-400/25 bg-emerald-500/[0.07] p-5">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
              <div>
                <p className="font-bold text-white">You&rsquo;re booked!</p>
                <p className="mt-1 text-sm text-zinc-300">
                  {new Intl.DateTimeFormat("en-US", { timeZone: visitorTimezone, dateStyle: "full", timeStyle: "short" }).format(new Date(confirmState.booking.startsAt))}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-zinc-300">A calendar invite is on its way to {contact.email}.</p>
                {confirmState.booking.joinUrl && (
                  <a href={confirmState.booking.joinUrl} className="mt-3 inline-flex text-sm font-bold text-pink-300 hover:text-pink-200">
                    Zoom join link <ArrowRight className="ml-1 h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            </div>
          )}
          {selectedSlot && confirmState.status !== "success" && (
            <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-5">
              <p className="font-bold text-white">
                Selected: {new Intl.DateTimeFormat("en-US", { timeZone: visitorTimezone, dateStyle: "full", timeStyle: "short" }).format(new Date(selectedSlot.startsAt))}
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <input
                  type="text" placeholder="Your name" value={contact.name}
                  onChange={(event) => setContact((current) => ({ ...current, name: event.target.value }))}
                  maxLength={120} className="min-h-11 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white placeholder:text-zinc-500 focus:border-pink-400/60 focus:outline-none"
                />
                <input
                  type="email" placeholder="Your email" value={contact.email}
                  onChange={(event) => setContact((current) => ({ ...current, email: event.target.value }))}
                  maxLength={254} className="min-h-11 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white placeholder:text-zinc-500 focus:border-pink-400/60 focus:outline-none"
                />
                <input
                  type="text" placeholder="Company (optional)" value={contact.company}
                  onChange={(event) => setContact((current) => ({ ...current, company: event.target.value }))}
                  maxLength={160} className="min-h-11 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white placeholder:text-zinc-500 focus:border-pink-400/60 focus:outline-none sm:col-span-2"
                />
              </div>
              {confirmState.status === "error" && (
                <p className="mt-3 text-sm text-amber-300">{confirmErrorMessage(confirmState.reason)}</p>
              )}
              <button
                type="button" onClick={confirmBooking} disabled={confirmState.status === "loading"}
                className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-pink-600 px-5 text-sm font-bold text-white hover:bg-pink-500 disabled:opacity-60 sm:w-auto"
              >
                {confirmState.status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                Confirm booking
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
