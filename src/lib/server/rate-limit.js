const buckets = new Map();

// In-memory, per-process — fine for this scale (matches the pattern already used
// in the booking confirm route). Resets on deploy; that's an acceptable tradeoff.
export function rateLimited(key, { windowMs = 10 * 60 * 1000, max = 5 } = {}) {
  const now = Date.now();
  const entries = (buckets.get(key) || []).filter((time) => now - time < windowMs);
  entries.push(now);
  buckets.set(key, entries);
  return entries.length > max;
}
