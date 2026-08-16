// Shared request-input sanitizer, previously copy-pasted into 5 route files
// with one silent divergence (stripe/checkout coerced non-strings via
// String(value || ""); everywhere else discarded them). Standardized here on
// the stricter typeof-check variant used by 4 of the 5 original copies.
export function clean(value, max = 300) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
