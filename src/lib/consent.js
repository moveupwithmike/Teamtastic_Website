export const CONSENT_KEY = "teamtastic_analytics_consent";

// GDPR/ePrivacy regions get an opt-in banner; everywhere else defaults to
// granted with an opt-out. Timezone is a heuristic, but it avoids making
// every page dynamic to read geo headers, and it fails toward opt-in.
const OPT_IN_TZ = /^(Europe\/|Atlantic\/(Azores|Madeira|Canary|Faroe|Reykjavik))/;

export function requiresOptIn() {
  try {
    return OPT_IN_TZ.test(Intl.DateTimeFormat().resolvedOptions().timeZone || "");
  } catch {
    return true;
  }
}

export function storedConsent() {
  try {
    return window.localStorage.getItem(CONSENT_KEY);
  } catch {
    return null;
  }
}

// Resolves the visitor's stored decision against the regional default:
// opt-in regions are "denied" until they accept, everyone else is
// "granted" until they opt out.
export function effectiveConsent() {
  const stored = storedConsent();
  if (stored === "granted" || stored === "denied") return stored;
  return requiresOptIn() ? "denied" : "granted";
}
