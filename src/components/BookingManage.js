"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import TurnstileWidget from "@/components/TurnstileWidget";

const ERROR_MESSAGES = {
  slot_unavailable: "That time was just taken. Please pick another slot.",
  minimum_notice: "That time is too soon. Please pick a later slot.",
  outside_booking_horizon: "That date isn't open yet. Please pick a closer date.",
  daily_limit: "That day is fully booked. Please pick another date.",
  bot_verification_failed: "Secure verification failed. Please retry.",
  verification_unavailable: "Secure verification is temporarily unavailable. Please try again shortly.",
  rate_limited: "Too many attempts. Please wait a few minutes and try again.",
  zoom_meeting_failed: "We couldn't finish setting up the call. Please try again or email hello@teamtastic.events.",
  calendar_event_failed: "We couldn't finish setting up the call. Please try again or email hello@teamtastic.events.",
  booking_not_found_or_not_reschedulable: "This booking can no longer be changed here — email hello@teamtastic.events.",
  booking_not_found_or_not_cancellable: "This booking can no longer be changed here — email hello@teamtastic.events.",
};

function errorMessage(reason) {
  return ERROR_MESSAGES[reason] || "Something went wrong. Please try again or email hello@teamtastic.events.";
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

function SlotPicker({ bookingTypeSlug, visitorTimezone, selectedSlot, onSelect }) {
  const dates = useMemo(() => upcomingDates(visitorTimezone), [visitorTimezone]);
  const [activeDate, setActiveDate] = useState(dates[0] || "");
  /** @type {[{loading: boolean, slots: any[], error?: boolean}, (value: any) => void]} */
  const [result, setResult] = useState({ loading: true, slots: [] });
  const [accessGranted, setAccessGranted] = useState(false);
  const [accessReset, setAccessReset] = useState(0);
  const grantAccess = useCallback(async (token) => {
    const response = await fetch("/api/bookings/availability-access", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ turnstileToken: token }),
    });
    if (response.ok) {
      setResult({ loading: true, slots: [] });
      setAccessGranted(true);
    }
    else setAccessReset((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!activeDate || !accessGranted) return undefined;
    const controller = new AbortController();
    fetch(`/api/bookings/availability?${new URLSearchParams({ date: activeDate, type: bookingTypeSlug, timezone: visitorTimezone })}`, {
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
  }, [accessGranted, activeDate, bookingTypeSlug, visitorTimezone]);

  return (
    <div>
      {!accessGranted && <div className="mb-4 space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-4"><p className="text-sm text-zinc-300">Complete a quick check to view live availability.</p><TurnstileWidget onToken={grantAccess} resetKey={accessReset} /></div>}
      {accessGranted && <>
      <div className="flex gap-2 overflow-x-auto pb-3">
        {dates.map((date) => (
          <button key={date} type="button" onClick={() => { setResult({ loading: true, slots: [] }); setActiveDate(date); }}
            className={`min-w-24 rounded-xl border px-3 py-3 text-sm font-bold ${activeDate === date ? "border-purple-400/60 bg-purple-500/15 text-white" : "border-white/10 bg-black/20 text-zinc-400 hover:text-white"}`}>
            {dateLabel(date, visitorTimezone)}
          </button>
        ))}
      </div>
      </>}
      {accessGranted && <div className="mt-4">
        {result.loading && <div className="flex min-h-24 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-pink-400" /></div>}
        {!result.loading && result.error && <p className="rounded-xl border border-amber-400/20 bg-amber-500/5 p-4 text-sm text-amber-200">Live availability is temporarily unavailable. Please try another date.</p>}
        {!result.loading && !result.error && !result.slots.length && <p className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-zinc-400">No open times on this date. Try the next day.</p>}
        {!result.loading && !result.error && !!result.slots.length && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {result.slots.map((slot) => (
              <button key={slot.startsAt} type="button" onClick={() => onSelect(slot)} aria-pressed={selectedSlot?.startsAt === slot.startsAt}
                className={`min-h-11 rounded-xl border px-3 text-sm font-bold transition-colors ${selectedSlot?.startsAt === slot.startsAt ? "border-pink-400/70 bg-pink-500/20 text-white" : "border-white/10 bg-white/5 text-white hover:border-pink-400/50 hover:bg-pink-500/10"}`}>
                {new Intl.DateTimeFormat("en-US", { timeZone: visitorTimezone, hour: "numeric", minute: "2-digit" }).format(new Date(slot.startsAt))}
              </button>
            ))}
          </div>
        )}
      </div>}
    </div>
  );
}

export default function BookingManage({ token, bookingTypeSlug, visitorTimezone }) {
  const [mode, setMode] = useState("idle");
  const [selectedSlot, setSelectedSlot] = useState(null);
  /** @type {[{status: string, reason?: string, booking?: any}, (value: any) => void]} */
  const [state, setState] = useState({ status: "idle" });
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileReset, setTurnstileReset] = useState(0);
  const [cancellationReason, setCancellationReason] = useState("");
  const [cancellationDetail, setCancellationDetail] = useState("");
  const handleTurnstileToken = useCallback((value) => setTurnstileToken(value), []);

  function resetTurnstile() {
    setTurnstileToken("");
    setTurnstileReset((value) => value + 1);
  }

  async function submitCancel() {
    if (!turnstileToken) { setState({ status: "error", reason: "bot_verification_failed" }); return; }
    setState({ status: "loading" });
    try {
      const response = await fetch("/api/bookings/cancel", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          turnstileToken,
          reason: cancellationReason === "other"
            ? `other: ${cancellationDetail}`.slice(0, 500)
            : cancellationReason,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) { setState({ status: "error", reason: data.reason }); resetTurnstile(); return; }
      setState({ status: "cancelled" });
    } catch {
      setState({ status: "error", reason: "network_error" });
    }
  }

  async function submitReschedule() {
    if (!selectedSlot) return;
    if (!turnstileToken) { setState({ status: "error", reason: "bot_verification_failed" }); return; }
    setState({ status: "loading" });
    try {
      const response = await fetch("/api/bookings/reschedule", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, startsAt: selectedSlot.startsAt, visitorTimezone, turnstileToken }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) { setState({ status: "error", reason: data.reason }); resetTurnstile(); return; }
      setState({ status: "rescheduled", booking: data });
    } catch {
      setState({ status: "error", reason: "network_error" });
    }
  }

  if (state.status === "cancelled") {
    return (
      <div className="mt-8 flex items-start gap-3 rounded-2xl border border-emerald-400/25 bg-emerald-500/[0.07] p-5">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
        <div>
          <p className="font-bold text-white">You&rsquo;re canceled.</p>
          <p className="mt-1 text-sm text-zinc-300">A confirmation email is on its way. Want a new time? <a href="/book" className="text-pink-300">Book here</a>.</p>
        </div>
      </div>
    );
  }
  if (state.status === "rescheduled") {
    return (
      <div className="mt-8 flex items-start gap-3 rounded-2xl border border-emerald-400/25 bg-emerald-500/[0.07] p-5">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
        <div>
          <p className="font-bold text-white">You&rsquo;re rescheduled!</p>
          <p className="mt-1 text-sm text-zinc-300">
            {new Intl.DateTimeFormat("en-US", { timeZone: visitorTimezone, dateStyle: "full", timeStyle: "short" }).format(new Date(state.booking.startsAt))}
          </p>
          {state.booking.joinUrl && <a href={state.booking.joinUrl} className="mt-3 inline-flex text-sm font-bold text-pink-300 hover:text-pink-200">Zoom join link <ArrowRight className="ml-1 h-3.5 w-3.5" /></a>}
          {state.booking.manageToken && <a href={`/book/manage/${state.booking.manageToken}`} className="mt-3 ml-4 inline-flex text-sm font-bold text-purple-300 hover:text-purple-200">Manage this booking <ArrowRight className="ml-1 h-3.5 w-3.5" /></a>}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8">
      {mode === "idle" && (
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => setMode("reschedule")} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-pink-600 px-5 text-sm font-bold text-white hover:bg-pink-500">
            Reschedule
          </button>
          <button type="button" onClick={() => setMode("cancel")} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 px-5 text-sm font-bold text-white hover:bg-white/5">
            Cancel
          </button>
        </div>
      )}

      {mode === "cancel" && (
        <div className="mt-2 rounded-2xl border border-white/10 bg-black/20 p-5">
          <p className="font-bold text-white">Cancel this call?</p>
          <label className="mt-4 block text-sm text-zinc-300">
            Reason (optional)
            <select value={cancellationReason} onChange={(event) => setCancellationReason(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-zinc-900 px-3 text-white">
              <option value="">Prefer not to say</option>
              <option value="schedule_conflict">Schedule conflict</option>
              <option value="no_longer_needed">No longer needed</option>
              <option value="chose_another_option">Chose another time or option</option>
              <option value="technical_issue">Technical issue</option>
              <option value="other">Other</option>
            </select>
          </label>
          {cancellationReason === "other" && <textarea value={cancellationDetail} onChange={(event) => setCancellationDetail(event.target.value.slice(0, 450))} maxLength={450} placeholder="Optional details" className="mt-3 min-h-24 w-full rounded-xl border border-white/10 bg-zinc-900 p-3 text-sm text-white" />}
          <div className="mt-4">
            <TurnstileWidget onToken={handleTurnstileToken} resetKey={turnstileReset} />
          </div>
          {state.status === "error" && <p className="mt-2 text-sm text-amber-300">{errorMessage(state.reason)}</p>}
          <div className="mt-4 flex gap-3">
            <button type="button" onClick={submitCancel} disabled={state.status === "loading" || !turnstileToken} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-red-600 px-5 text-sm font-bold text-white hover:bg-red-500 disabled:opacity-60">
              {state.status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Yes, cancel it
            </button>
            <button type="button" onClick={() => { setMode("idle"); setState({ status: "idle" }); }} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 px-5 text-sm font-bold text-white hover:bg-white/5">
              Never mind
            </button>
          </div>
        </div>
      )}

      {mode === "reschedule" && (
        <div className="mt-2 rounded-2xl border border-white/10 bg-black/20 p-5">
          <p className="font-bold text-white">Pick a new time</p>
          <div className="mt-4">
            <SlotPicker bookingTypeSlug={bookingTypeSlug} visitorTimezone={visitorTimezone} selectedSlot={selectedSlot} onSelect={setSelectedSlot} />
          </div>
          {selectedSlot && (
            <div className="mt-4">
              <TurnstileWidget onToken={handleTurnstileToken} resetKey={turnstileReset} />
            </div>
          )}
          {state.status === "error" && <p className="mt-3 text-sm text-amber-300">{errorMessage(state.reason)}</p>}
          <div className="mt-4 flex gap-3">
            <button type="button" onClick={submitReschedule} disabled={!selectedSlot || state.status === "loading" || !turnstileToken} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-pink-600 px-5 text-sm font-bold text-white hover:bg-pink-500 disabled:opacity-60">
              {state.status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />} Confirm new time
            </button>
            <button type="button" onClick={() => { setMode("idle"); setSelectedSlot(null); setState({ status: "idle" }); }} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 px-5 text-sm font-bold text-white hover:bg-white/5">
              Never mind
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
