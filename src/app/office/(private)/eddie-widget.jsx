"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const SECTION_LABELS = {
  "": "Needs Michael",
  "command-center": "Command Center",
  "appointments": "Appointments",
  "roadmap": "Today's agenda",
  "prospects": "Prospects",
  "organic": "Intent radar",
  "growth": "Growth brief",
  "roi": "Campaign ROI",
  "scoring": "Lead scoring",
  "warm-signals": "Warm signals",
  "respond": "Respond",
  "distribution": "Social desk",
  "social-accounts": "Social accounts",
  "voice": "Voice library",
  "audience": "Audience intelligence",
  "health": "Conversion health",
  "launch": "Launch control",
  "sla": "Holiday SLA",
  "capacity": "Holiday capacity",
  "certification": "Certification",
  "final-certification": "Final certification",
  "activation": "Activation",
  "deliverability": "Deliverability",
  "incidents": "Incidents",
  "activity": "Activity feed",
  "settings": "Settings",
};

function friendlyError(reason) {
  const messages = {
    office_login_required: "Your Office session expired. Refresh the page and sign in again.",
    ai_gateway_not_configured: "Eddie's AI connection is not available yet.",
    ai_gateway_unavailable: "Eddie could not reach the AI service. Please try again in a moment.",
    sales_data_unavailable: "Eddie could not safely load the live sales data.",
    confirmation_expired: "That confirmation expired. Ask Eddie to prepare the action again.",
    slow_down: "Eddie is receiving requests too quickly. Wait a moment and try again.",
  };
  return messages[reason] || "Eddie could not safely complete that request. Nothing was changed.";
}

export default function EddieWidget() {
  const pathname = usePathname();
  const segment = (pathname || "").replace(/^\/office\/?/, "").split("/")[0] || "";
  const sectionLabel = SECTION_LABELS[segment];

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const endRef = useRef(null);
  const messagesRef = useRef(messages);
  const busyRef = useRef(busy);
  const sectionRef = useRef(sectionLabel || "Sales engine");

  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { busyRef.current = busy; }, [busy]);
  useEffect(() => { sectionRef.current = sectionLabel || "Sales engine"; }, [sectionLabel]);
  useEffect(() => {
    if (typeof endRef.current?.scrollIntoView === "function") endRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, pendingAction, open]);

  useEffect(() => {
    function onAsk(event) {
      const question = String(event.detail?.question || "").trim();
      if (!question) return;
      setOpen(true);
      if (messagesRef.current.length === 0) setMessages([welcomeMessage()]);
      if (event.detail?.autoSend === false) setInput(question);
      else submitQuestion(question);
    }
    window.addEventListener("office:ask-eddie", onAsk);
    return () => window.removeEventListener("office:ask-eddie", onAsk);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hide on the full Eddie experience page — the immersive chat there already covers this.
  if (segment === "morning-brief") return null;

  function welcomeMessage() {
    return {
      id: "welcome",
      role: "assistant",
      content: sectionLabel
        ? `Ask me anything about ${sectionLabel}, or tell me what you'd like handled.`
        : "Ask me a question about the sales engine, or tell me what you'd like handled.",
    };
  }

  function toggleOpen() {
    setOpen((value) => {
      const next = !value;
      if (next && messagesRef.current.length === 0) setMessages([welcomeMessage()]);
      return next;
    });
  }

  async function submitQuestion(override) {
    const content = String(override ?? input).trim();
    if (!content || busyRef.current) return;
    const userMessage = { id: crypto.randomUUID(), role: "user", content };
    const conversation = [...messagesRef.current, userMessage].map(({ role, content: text }, index, all) => ({
      role,
      content: index === all.length - 1 && role === "user" ? `[Current Office page: ${sectionRef.current}]\n${text}` : text,
    }));
    setMessages((current) => [...current, userMessage]);
    setInput("");
    setPendingAction(null);
    busyRef.current = true;
    setBusy(true);
    try {
      const response = await fetch("/api/office/eddie", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "chat", messages: conversation }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.reason || "eddie_unavailable");
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", content: result.message }]);
      setPendingAction(result.pendingAction || null);
    } catch (error) {
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", content: friendlyError(error.message), error: true }]);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function confirmAction() {
    if (!pendingAction?.token || busy) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const response = await fetch("/api/office/eddie", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "execute", token: pendingAction.token }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.reason || "action_failed");
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", content: result.message }]);
      setPendingAction(null);
    } catch (error) {
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", content: friendlyError(error.message), error: true }]);
      setPendingAction(null);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {open && (
        <div className="fixed inset-x-3 bottom-20 flex h-[min(34rem,calc(100vh-7rem))] flex-col overflow-hidden rounded-2xl border border-purple-400/30 bg-slate-950/97 shadow-2xl shadow-purple-950/40 backdrop-blur sm:inset-x-auto sm:bottom-20 sm:right-5 sm:w-[24rem]">
          <div className="flex items-center justify-between border-b border-white/10 bg-gradient-to-r from-purple-600/20 to-slate-900/40 px-4 py-3">
            <div>
              <div className="flex items-center gap-2"><span aria-hidden="true" className="relative flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-purple-400 via-fuchsia-500 to-indigo-700 shadow-lg shadow-purple-500/20"><span className="h-2 w-2 rounded-full bg-white shadow-[0_0_10px_white]" /></span><div><p className="text-sm font-semibold text-white">Eddie</p><p className="text-xs text-slate-400">Working with you in {sectionLabel || "Sales engine"}</p></div></div>
            </div>
            <div className="flex items-center gap-2">
              <a href="/office/morning-brief" className="text-xs font-semibold text-purple-300 hover:text-purple-200">Open voice →</a>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close Eddie" className="rounded-lg border border-white/10 px-2 py-1 text-xs hover:bg-white/5">✕</button>
            </div>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-3" aria-live="polite">
            {messages.length === 1 && !busy && (
              <div className="grid gap-2">
                {["What needs my attention?", "What should I do next?", "Explain this page"].map((question) => <button key={question} type="button" onClick={() => submitQuestion(question)} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-left text-xs text-slate-300 transition hover:border-purple-400/30 hover:bg-purple-500/10 hover:text-white">{question}</button>)}
              </div>
            )}
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${message.role === "user" ? "bg-purple-600 text-white" : message.error ? "bg-red-500/10 text-red-200" : "bg-white/[0.07] text-slate-200"}`}>
                  {message.content}
                </div>
              </div>
            ))}
            {busy && <p className="text-xs text-purple-300">Eddie is checking the live sales engine…</p>}

            {pendingAction && !busy && (
              <div className={`rounded-xl border p-3 ${pendingAction.dangerous ? "border-red-400/30 bg-red-500/10" : "border-amber-400/30 bg-amber-500/10"}`}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-200">Confirmation required</p>
                <h3 className="mt-1 text-sm font-semibold">{pendingAction.title}</h3>
                <ul className="mt-2 space-y-1 text-xs text-slate-300">
                  {(pendingAction.details || []).map((detail, index) => <li key={`${index}-${detail}`} className="whitespace-pre-wrap">{detail}</li>)}
                </ul>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={confirmAction} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${pendingAction.dangerous ? "bg-red-600 hover:bg-red-500" : "bg-purple-600 hover:bg-purple-500"}`}>Confirm exact action</button>
                  <button type="button" onClick={() => setPendingAction(null)} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs hover:bg-white/5">Cancel</button>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form className="flex gap-2 border-t border-white/10 p-3" onSubmit={(event) => { event.preventDefault(); submitQuestion(); }}>
            <label className="sr-only" htmlFor="eddie-widget-question">Ask Eddie</label>
            <textarea
              id="eddie-widget-question"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); submitQuestion(); } }}
              maxLength={2000}
              rows={1}
              placeholder={sectionLabel ? `Ask about ${sectionLabel}…` : "Ask Eddie…"}
              className="min-h-10 flex-1 resize-none rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-purple-400"
            />
            <button type="submit" disabled={busy || !input.trim()} className="rounded-xl bg-purple-600 px-4 text-sm font-semibold hover:bg-purple-500 disabled:opacity-40">Send</button>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={toggleOpen}
        aria-expanded={open}
        aria-label={open ? "Close Eddie" : "Ask Eddie"}
        className="flex items-center gap-2 rounded-full border border-purple-300/30 bg-slate-950/95 px-3 py-2.5 text-sm font-semibold text-white shadow-xl shadow-purple-950/40 transition hover:-translate-y-0.5 hover:border-purple-300/60 hover:bg-purple-950"
      >
        <span aria-hidden="true" className="relative flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-purple-400 via-fuchsia-500 to-indigo-700"><span className="h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_8px_white]" /></span> {open ? "Close Eddie" : "Ask Eddie"}
      </button>
    </div>
  );
}
