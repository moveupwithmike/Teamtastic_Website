"use client";

import { useEffect, useRef, useState } from "react";

const welcome = {
  id: "welcome",
  role: "assistant",
  content: "Good morning. Ask me what needs attention, which leads are hottest, or tell me to prepare a sales task. I will always ask before changing anything or sending an email.",
};

function friendlyError(reason) {
  const messages = {
    office_login_required: "Your Office session expired. Refresh the page and sign in again.",
    ai_gateway_not_configured: "Eddie's AI connection is not available yet.",
    ai_gateway_unavailable: "Eddie could not reach the AI service. Please try again in a moment.",
    sales_data_unavailable: "Eddie could not safely load the live sales data.",
    confirmation_expired: "That confirmation expired. Ask Eddie to prepare the action again.",
    draft_changed_since_confirmation: "That draft changed after you reviewed it, so Eddie did not send it. Ask to review it again.",
    prospect_changed_since_confirmation: "That prospect changed after you reviewed the action, so Eddie stopped.",
    action_already_started: "That action is already being processed.",
    action_previously_failed: "That action previously failed. Ask Eddie to prepare a fresh confirmation.",
    slow_down: "Eddie is receiving requests too quickly. Wait a moment and try again.",
  };
  return messages[reason] || "Eddie could not safely complete that request. Nothing was changed.";
}

export default function EddieChat() {
  const [messages, setMessages] = useState([welcome]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [speakReplies, setSpeakReplies] = useState(true);
  const [pendingAction, setPendingAction] = useState(null);
  const endRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [messages, pendingAction]);
  useEffect(() => () => {
    recognitionRef.current?.abort?.();
    window.speechSynthesis?.cancel();
  }, []);

  function speak(text) {
    if (!speakReplies || !window.speechSynthesis || !text) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.96;
    const voices = window.speechSynthesis.getVoices();
    utterance.voice = voices.find((voice) => voice.lang.startsWith("en") && /Daniel|Alex|Aaron|Arthur|Eddy/i.test(voice.name))
      || voices.find((voice) => voice.lang.startsWith("en"))
      || null;
    window.speechSynthesis.speak(utterance);
  }

  async function submitQuestion(question = input) {
    const content = String(question || "").trim();
    if (!content || busy) return;
    const userMessage = { id: crypto.randomUUID(), role: "user", content };
    const conversation = [...messages, userMessage].map(({ role, content: text }) => ({ role, content: text }));
    setMessages((current) => [...current, userMessage]);
    setInput("");
    setPendingAction(null);
    setBusy(true);
    try {
      const response = await fetch("/api/office/eddie", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "chat", messages: conversation }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.reason || "eddie_unavailable");
      const reply = { id: crypto.randomUUID(), role: "assistant", content: result.message };
      setMessages((current) => [...current, reply]);
      setPendingAction(result.pendingAction || null);
      speak(result.message);
    } catch (error) {
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", content: friendlyError(error.message), error: true }]);
    } finally {
      setBusy(false);
    }
  }

  function startListening() {
    if (busy || listening) return;
    const Recognition = Reflect.get(window, "SpeechRecognition") || Reflect.get(window, "webkitSpeechRecognition");
    if (!Recognition) {
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", content: "Voice input is not supported by this browser. You can still type your request below.", error: true }]);
      return;
    }
    window.speechSynthesis?.cancel();
    const recognition = new Recognition();
    recognitionRef.current = recognition;
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim();
      if (transcript) submitQuestion(transcript);
    };
    recognition.start();
  }

  async function confirmAction() {
    if (!pendingAction?.token || busy) return;
    setBusy(true);
    window.speechSynthesis?.cancel();
    try {
      const response = await fetch("/api/office/eddie", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "execute", token: pendingAction.token }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.reason || "action_failed");
      const reply = { id: crypto.randomUUID(), role: "assistant", content: result.message };
      setMessages((current) => [...current, reply]);
      setPendingAction(null);
      speak(result.message);
    } catch (error) {
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", content: friendlyError(error.message), error: true }]);
      setPendingAction(null);
    } finally {
      setBusy(false);
    }
  }

  function clearConversation() {
    window.speechSynthesis?.cancel();
    setMessages([welcome]);
    setPendingAction(null);
    setInput("");
  }

  return (
    <section className="rounded-2xl border border-purple-400/20 bg-gradient-to-br from-purple-500/10 to-slate-900/70 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Talk with Eddie</h2>
          <p className="mt-1 text-sm text-slate-400">Live sales answers and confirmed actions. Eddie cannot change or send anything without your approval.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setSpeakReplies((value) => !value)} className="rounded-lg border border-white/10 px-3 py-2 text-xs hover:bg-white/5">
            {speakReplies ? "Voice replies on" : "Voice replies off"}
          </button>
          <button type="button" onClick={clearConversation} disabled={busy} className="rounded-lg border border-white/10 px-3 py-2 text-xs hover:bg-white/5 disabled:opacity-40">New conversation</button>
        </div>
      </div>

      <div className="mt-5 max-h-[34rem] space-y-3 overflow-y-auto rounded-xl border border-white/5 bg-slate-950/45 p-4" aria-live="polite">
        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm ${message.role === "user" ? "bg-purple-600 text-white" : message.error ? "bg-red-500/10 text-red-200" : "bg-white/[0.07] text-slate-200"}`}>
              {message.content}
            </div>
          </div>
        ))}
        {busy && <p className="text-sm text-purple-300">Eddie is checking the live sales engine…</p>}

        {pendingAction && !busy && (
          <div className={`rounded-2xl border p-4 ${pendingAction.dangerous ? "border-red-400/30 bg-red-500/10" : "border-amber-400/30 bg-amber-500/10"}`}>
            <p className="text-xs font-bold uppercase tracking-wider text-amber-200">Confirmation required</p>
            <h3 className="mt-1 font-semibold">{pendingAction.title}</h3>
            <ul className="mt-3 space-y-1 text-sm text-slate-300">
              {(pendingAction.details || []).map((detail, index) => <li key={`${index}-${detail}`} className="whitespace-pre-wrap">{detail}</li>)}
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={confirmAction} className={`rounded-lg px-4 py-2 text-sm font-semibold ${pendingAction.dangerous ? "bg-red-600 hover:bg-red-500" : "bg-purple-600 hover:bg-purple-500"}`}>Confirm action</button>
              <button type="button" onClick={() => setPendingAction(null)} className="rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/5">Cancel</button>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form className="mt-4 flex flex-col gap-3 sm:flex-row" onSubmit={(event) => { event.preventDefault(); submitQuestion(); }}>
        <label className="sr-only" htmlFor="eddie-question">Ask Eddie</label>
        <textarea id="eddie-question" value={input} onChange={(event) => setInput(event.target.value)} maxLength={2000} rows={2} placeholder="Ask: What should I focus on first today?" className="min-h-14 flex-1 resize-none rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-purple-400" />
        <div className="flex gap-2 sm:flex-col">
          <button type="button" onClick={startListening} disabled={busy || listening} className={`flex-1 rounded-xl border px-4 py-2 text-sm font-semibold sm:flex-none ${listening ? "border-red-400 bg-red-500/15 text-red-200" : "border-white/10 hover:bg-white/5"}`}>
            {listening ? "Listening…" : "Speak"}
          </button>
          <button type="submit" disabled={busy || !input.trim()} className="flex-1 rounded-xl bg-purple-600 px-5 py-2 text-sm font-semibold hover:bg-purple-500 disabled:opacity-40 sm:flex-none">Ask Eddie</button>
        </div>
      </form>
      <p className="mt-3 text-xs text-slate-500">Try: “Summarize my hottest leads,” “Create a task to call Jordan tomorrow,” or “Show me the email draft waiting for approval.”</p>
    </section>
  );
}
