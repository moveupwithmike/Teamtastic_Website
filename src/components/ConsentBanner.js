"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "teamtastic_analytics_consent";

export default function ConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        setVisible(!localStorage.getItem(STORAGE_KEY));
      } catch {
        setVisible(false);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const respond = (decision) => {
    try {
      localStorage.setItem(STORAGE_KEY, decision);
    } catch {
      // ignore
    }
    setVisible(false);

    // If the user grants consent, reload so PostHog reinitialises with
    // localStorage+cookie persistence (instrumentation-client.js reads the
    // consent value only once at boot time).
    if (decision === "granted") {
      window.location.reload();
    }
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie consent"
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-sm z-[100] rounded-2xl border border-white/10 bg-zinc-900/95 backdrop-blur-xl shadow-2xl p-5 space-y-4"
    >
      <div className="space-y-1">
        <p className="text-sm font-bold text-white">We use analytics cookies</p>
        <p className="text-xs text-zinc-400 leading-relaxed">
          We use PostHog to understand how people use Teamtastic. If you accept, we also enable ad measurement (Meta, Google) to see which campaigns bring real leads. We never sell your data.
        </p>
      </div>

      <div className="flex gap-2">
        <button
          id="consent-accept"
          onClick={() => respond("granted")}
          className="flex-1 h-9 rounded-xl bg-brand-purple hover:bg-brand-purple/90 text-white text-xs font-bold transition-all"
        >
          Accept
        </button>
        <button
          id="consent-decline"
          onClick={() => respond("denied")}
          className="flex-1 h-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 text-xs font-bold transition-all"
        >
          Decline
        </button>
      </div>
    </div>
  );
}
