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
      className="fixed inset-x-3 bottom-3 sm:inset-x-6 sm:bottom-4 z-[100] rounded-xl border border-white/10 bg-zinc-900/95 backdrop-blur-xl shadow-2xl px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
    >
      <p className="text-xs text-zinc-400 leading-snug sm:pr-4">
        <span className="font-bold text-white">We use analytics cookies. </span>
        {optIn
          ? "We use PostHog to understand how people use Teamtastic. If you accept, we also enable ad measurement (Meta, Google) to see which campaigns bring real leads. We never sell your data."
          : "We use PostHog to understand how people use Teamtastic, and ad measurement (Meta, Google) to see which campaigns bring real leads. We never sell your data. You can opt out anytime."}
      </p>

      <div className="flex shrink-0 gap-2 self-end sm:self-auto">
        <button
          id="consent-accept"
          onClick={() => respond("granted")}
          className="h-9 whitespace-nowrap rounded-xl bg-brand-purple px-4 text-xs font-bold text-white transition-all hover:bg-brand-purple/90"
        >
          {optIn ? "Accept" : "OK"}
        </button>
        <button
          id="consent-decline"
          onClick={() => respond("denied")}
          className="h-9 whitespace-nowrap rounded-xl border border-white/10 bg-white/5 px-4 text-xs font-bold text-zinc-300 transition-all hover:bg-white/10"
        >
          {optIn ? "Decline" : "Opt out"}
        </button>
      </div>
    </div>
  );
}
