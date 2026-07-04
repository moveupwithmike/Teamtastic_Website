export function createSubmissionId() {
  return crypto.randomUUID();
}

export function getAttribution() {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  return {
    landingPage: `${window.location.pathname}${window.location.search}`,
    referrer: document.referrer || null,
    utm: {
      source: params.get("utm_source"),
      medium: params.get("utm_medium"),
      campaign: params.get("utm_campaign"),
      content: params.get("utm_content"),
      term: params.get("utm_term"),
    },
  };
}

export async function captureLead(payload) {
  const response = await fetch("/api/leads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, ...getAttribution() }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.success) {
    const error = new Error(result?.message || "We couldn't save your details. Please try again.");
    error.code = result?.code || "UNKNOWN";
    error.retryable = result?.retryable ?? true;
    throw error;
  }
  return result;
}

