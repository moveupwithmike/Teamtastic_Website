"use client";

import { useEffect, useId, useRef, useState } from "react";

const SCRIPT_ID = "cloudflare-turnstile-script";

export default function TurnstileWidget({ onToken, resetKey = 0 }) {
  const reactId = useId().replaceAll(":", "");
  const containerRef = useRef(null);
  const widgetId = useRef(null);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const [status, setStatus] = useState(() => siteKey
    ? "loading"
    : process.env.NODE_ENV === "production" ? "misconfigured" : "ready");

  useEffect(() => {
    if (!siteKey) {
      queueMicrotask(() => onToken(process.env.NODE_ENV !== "production" ? "development-bypass" : ""));
      return;
    }

    let cancelled = false;
    const render = () => {
      if (cancelled || !containerRef.current || !window.turnstile || widgetId.current) return;
      widgetId.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        theme: "dark",
        size: "flexible",
        callback: (token) => {
          setStatus("ready");
          onToken(token);
        },
        "expired-callback": () => {
          setStatus("expired");
          onToken("");
        },
        "error-callback": () => {
          setStatus("error");
          onToken("");
        },
      });
    };

    if (window.turnstile) render();
    else {
      let script = /** @type {HTMLScriptElement | null} */ (document.getElementById(SCRIPT_ID));
      if (!script) {
        script = document.createElement("script");
        script.id = SCRIPT_ID;
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
      script.addEventListener("load", render, { once: true });
    }

    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [siteKey, onToken, resetKey]);

  return (
    <div className="space-y-2" aria-live="polite">
      <div id={`turnstile-${reactId}`} ref={containerRef} />
      {status === "loading" && siteKey && <p className="text-xs text-zinc-500">Loading secure verification…</p>}
      {status === "expired" && <p className="text-xs text-amber-400">Verification expired. Please verify again.</p>}
      {status === "error" && <p className="text-xs text-rose-400">Verification could not load. Please refresh and retry.</p>}
      {status === "misconfigured" && <p className="text-xs text-rose-400">Secure verification is temporarily unavailable.</p>}
    </div>
  );
}
