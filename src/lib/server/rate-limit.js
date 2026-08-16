import { createHash } from "node:crypto";

const buckets = new Map();

// Named so the policy differences between routes read as intentional rather
// than as unlabeled magic numbers repeated at each call site.
export const RATE_LIMIT_TIERS = {
  standard: { windowMs: 10 * 60 * 1000, max: 5 }, // booking mutations, leads — the default below
  lenient: { windowMs: 10 * 60 * 1000, max: 30 }, // read-only lookups (availability)
  frequent: { windowMs: 60 * 1000, max: 60 }, // high-volume pings (funnel events)
};

// In-memory, per-process — fine for this scale (matches the pattern already used
// in the booking confirm route). Resets on deploy; that's an acceptable tradeoff.
export function rateLimited(key, { windowMs = RATE_LIMIT_TIERS.standard.windowMs, max = RATE_LIMIT_TIERS.standard.max } = {}) {
  const now = Date.now();
  const entries = (buckets.get(key) || []).filter((time) => now - time < windowMs);
  entries.push(now);
  buckets.set(key, entries);
  return entries.length > max;
}

// Shared "namespace + hash" helper for rate-limit keys and opaque lookup
// tokens (manage-booking tokens, payment-request tokens, …) — previously
// re-implemented inline at 13 call sites with createHash("sha256") directly.
export function hashKey(...parts) {
  return createHash("sha256").update(parts.join(":")).digest("hex");
}
