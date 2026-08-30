import { describe, expect, it } from "vitest";
import { CANCELLATION_TIERS, CANCELLATION_POLICY_TABLE, computeCancellationPolicy, computeRefundAmountCents, noShowPolicy } from "./cancellation-policy";

const EVENT_START = new Date("2026-09-15T18:00:00.000Z");
const SECOND = 1000;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function cancelledAt(offsetMs) {
  return new Date(EVENT_START.getTime() - offsetMs);
}

describe("computeCancellationPolicy — boundary matrix", () => {
  it("7 days + 1 second before start: 100% (full)", () => {
    const result = computeCancellationPolicy({ eventStartsAt: EVENT_START, cancelledAt: cancelledAt(7 * DAY + SECOND) });
    expect(result).toMatchObject({ tier: CANCELLATION_TIERS.FULL, refundPercent: 100 });
  });

  it("exactly 7 days before start: 100% (full — boundary is inclusive)", () => {
    const result = computeCancellationPolicy({ eventStartsAt: EVENT_START, cancelledAt: cancelledAt(7 * DAY) });
    expect(result).toMatchObject({ tier: CANCELLATION_TIERS.FULL, refundPercent: 100 });
  });

  it("7 days - 1 second before start: 50% (crosses into the 48h-7d tier)", () => {
    const result = computeCancellationPolicy({ eventStartsAt: EVENT_START, cancelledAt: cancelledAt(7 * DAY - SECOND) });
    expect(result).toMatchObject({ tier: CANCELLATION_TIERS.FIFTY_PERCENT, refundPercent: 50 });
  });

  it("48 hours + 1 second before start: 50%", () => {
    const result = computeCancellationPolicy({ eventStartsAt: EVENT_START, cancelledAt: cancelledAt(48 * HOUR + SECOND) });
    expect(result).toMatchObject({ tier: CANCELLATION_TIERS.FIFTY_PERCENT, refundPercent: 50 });
  });

  it("exactly 48 hours before start: 50% (boundary is inclusive)", () => {
    const result = computeCancellationPolicy({ eventStartsAt: EVENT_START, cancelledAt: cancelledAt(48 * HOUR) });
    expect(result).toMatchObject({ tier: CANCELLATION_TIERS.FIFTY_PERCENT, refundPercent: 50 });
  });

  it("48 hours - 1 second before start: 25% (crosses into the <48h tier)", () => {
    const result = computeCancellationPolicy({ eventStartsAt: EVENT_START, cancelledAt: cancelledAt(48 * HOUR - SECOND) });
    expect(result).toMatchObject({ tier: CANCELLATION_TIERS.TWENTY_FIVE_PERCENT, refundPercent: 25 });
  });

  it("1 minute before start: 25%", () => {
    const result = computeCancellationPolicy({ eventStartsAt: EVENT_START, cancelledAt: cancelledAt(60 * SECOND) });
    expect(result).toMatchObject({ tier: CANCELLATION_TIERS.TWENTY_FIVE_PERCENT, refundPercent: 25 });
  });

  it("exactly at event start: 0% (no refund)", () => {
    const result = computeCancellationPolicy({ eventStartsAt: EVENT_START, cancelledAt: EVENT_START });
    expect(result).toMatchObject({ tier: CANCELLATION_TIERS.NONE, refundPercent: 0 });
  });

  it("after event start: 0% (no refund)", () => {
    const result = computeCancellationPolicy({
      eventStartsAt: EVENT_START,
      cancelledAt: new Date(EVENT_START.getTime() + 10 * 60 * SECOND),
    });
    expect(result).toMatchObject({ tier: CANCELLATION_TIERS.NONE, refundPercent: 0 });
  });
});

describe("computeCancellationPolicy — misc", () => {
  it("defaults cancelledAt to now when omitted", () => {
    const farFuture = new Date(Date.now() + 30 * DAY);
    const result = computeCancellationPolicy({ eventStartsAt: farFuture });
    expect(result).toMatchObject({ tier: CANCELLATION_TIERS.FULL, refundPercent: 100 });
  });

  it("accepts ISO string inputs, not just Date objects", () => {
    const result = computeCancellationPolicy({
      eventStartsAt: EVENT_START.toISOString(),
      cancelledAt: cancelledAt(8 * DAY).toISOString(),
    });
    expect(result).toMatchObject({ tier: CANCELLATION_TIERS.FULL, refundPercent: 100 });
  });

  it("is timezone-agnostic: absolute instants compare the same regardless of display timezone", () => {
    // 2026-09-15T18:00:00Z is 2026-09-15T14:00:00-04:00 (America/New_York) and
    // 2026-09-16T03:00:00+09:00 (Asia/Tokyo) — same instant, same policy result.
    const nyLabelForSameInstant = "2026-09-15T14:00:00.000-04:00";
    const tokyoLabelForSameInstant = "2026-09-16T03:00:00.000+09:00";
    const cancelIso = cancelledAt(8 * DAY).toISOString();
    expect(computeCancellationPolicy({ eventStartsAt: nyLabelForSameInstant, cancelledAt: cancelIso }))
      .toMatchObject({ tier: CANCELLATION_TIERS.FULL, refundPercent: 100 });
    expect(computeCancellationPolicy({ eventStartsAt: tokyoLabelForSameInstant, cancelledAt: cancelIso }))
      .toMatchObject({ tier: CANCELLATION_TIERS.FULL, refundPercent: 100 });
  });

  it("throws on an invalid date instead of silently misclassifying", () => {
    expect(() => computeCancellationPolicy({ eventStartsAt: "not-a-date" })).toThrow();
  });
});

describe("noShowPolicy", () => {
  it("is always 0% and distinct from a time-based cancellation", () => {
    expect(noShowPolicy()).toMatchObject({ tier: CANCELLATION_TIERS.NONE, refundPercent: 0, reason: "no_show" });
  });
});

describe("computeRefundAmountCents", () => {
  it("computes the exact worked example from the audit: $1,000 paid, 50% eligible -> $500", () => {
    expect(computeRefundAmountCents(100_000, 50)).toBe(50_000);
  });

  it("rounds to the nearest cent", () => {
    expect(computeRefundAmountCents(9_999, 25)).toBe(2_500); // 2499.75 -> 2500
  });

  it("0% and 100% are exact", () => {
    expect(computeRefundAmountCents(12_345, 0)).toBe(0);
    expect(computeRefundAmountCents(12_345, 100)).toBe(12_345);
  });

  it("rejects an out-of-range refund percent", () => {
    expect(() => computeRefundAmountCents(1000, 101)).toThrow();
    expect(() => computeRefundAmountCents(1000, -1)).toThrow();
  });

  it("rejects a negative amount", () => {
    expect(() => computeRefundAmountCents(-1, 50)).toThrow();
  });
});

describe("CANCELLATION_POLICY_TABLE", () => {
  const DAY = 24 * 3_600_000;
  const EVENT_START = new Date("2026-11-01T17:00:00Z");

  it("carries exactly the four approved tiers in policy order", () => {
    expect(CANCELLATION_POLICY_TABLE.map((row) => row.tier)).toEqual([
      CANCELLATION_TIERS.FULL,
      CANCELLATION_TIERS.FIFTY_PERCENT,
      CANCELLATION_TIERS.TWENTY_FIVE_PERCENT,
      CANCELLATION_TIERS.NONE,
    ]);
    expect(CANCELLATION_POLICY_TABLE.map((row) => row.refundPercent)).toEqual([100, 50, 25, 0]);
  });

  it("matches the computed policy at each threshold boundary", () => {
    const full = computeCancellationPolicy({ eventStartsAt: EVENT_START, cancelledAt: new Date(EVENT_START.getTime() - 7 * DAY) });
    expect(CANCELLATION_POLICY_TABLE.find((r) => r.tier === full.tier).refundPercent).toBe(100);

    const fifty = computeCancellationPolicy({ eventStartsAt: EVENT_START, cancelledAt: new Date(EVENT_START.getTime() - 48 * 3_600_000) });
    expect(CANCELLATION_POLICY_TABLE.find((r) => r.tier === fifty.tier).refundPercent).toBe(50);

    const quarter = computeCancellationPolicy({ eventStartsAt: EVENT_START, cancelledAt: new Date(EVENT_START.getTime() - 3_600_000) });
    expect(CANCELLATION_POLICY_TABLE.find((r) => r.tier === quarter.tier).refundPercent).toBe(25);

    const none = noShowPolicy();
    expect(CANCELLATION_POLICY_TABLE.find((r) => r.tier === none.tier).refundPercent).toBe(0);
  });

  it("uses customer-facing wording for every tier", () => {
    for (const row of CANCELLATION_POLICY_TABLE) {
      expect(row.appliesTo.length).toBeGreaterThan(10);
    }
  });
});
