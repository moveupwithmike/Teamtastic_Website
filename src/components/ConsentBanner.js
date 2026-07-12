"use client";

import { useEffect, useState } from "react";
import { CONSENT_KEY, requiresOptIn } from "@/lib/consent";

export default function ConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [optIn, setOptIn] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setOptIn(requiresOptIn());
      try {
        setVisible(!localStorage.getItem(CONSENT_KEY));
      } catch {
        setVisible(false);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const respond = (decision) => {
    try {
      localStorage.setItem(CONSENT_KEY, decision);
    } catch {
      // ignore
    }
    setVisible(false);

    // Reload when the decision changes what should be running: a grant in an
    // opt-in region boots PostHog with persistent storage and loads the ad
    // tags; a denial anywhere unloads tags that may already be active
    // (instrumentation-client.js and AdPixels read consent only at boot).
    if ((optIn && decision === "granted") || decision === "denied") {
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
          {optIn
            ? "We use PostHog to understand how people use Teamtastic. If you accept, we also enable ad measurement (Meta, Google) to see which campaigns bring real leads. We never sell your data."
            : "We use PostHog to understand how people use Teamtastic, and ad measurement (Meta, Google) to see which campaigns bring real leads. We never sell your data. You can opt out anytime."}
        </p>
      </div>

      <div className="flex gap-2">
        <button
          id="consent-accept"
          onClick={() => respond("granted")}
          className="flex-1 h-9 rounded-xl bg-brand-purple hover:bg-brand-purple/90 text-white text-xs font-bold transition-all"
        >
          {optIn ? "Accept" : "OK"}
        </button>
        <button
          id="consent-decline"
          onClick={() => respond("denied")}
          className="flex-1 h-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 text-xs font-bold transition-all"
        >
          {optIn ? "Decline" : "Opt out"}
        </button>
      </div>
    </div>
  );
}
