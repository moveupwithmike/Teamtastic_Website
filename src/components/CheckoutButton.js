"use client";

import { useState } from "react";

export default function CheckoutButton({
  submissionId,
  paymentKind,
  className,
  children,
  onClick,
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function beginCheckout() {
    if (loading) return;
    setLoading(true);
    setError("");
    onClick?.();
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId, paymentKind }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.url) throw new Error(result.error || "checkout_unavailable");
      window.location.assign(result.url);
    } catch {
      setError("Checkout is temporarily unavailable. Please book a call or try again.");
      setLoading(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={beginCheckout} disabled={loading} className={className}>
        {loading ? "Opening secure checkout…" : children}
      </button>
      {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
    </div>
  );
}
