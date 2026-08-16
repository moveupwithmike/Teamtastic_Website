import { describe, expect, it } from "vitest";
import {
  addWallMinutes,
  dateInTimeZone,
  overlaps,
  validTimeZone,
  wallMinutes,
  weekdayForDate,
  zonedDayRangeUtc,
  zonedWallTimeToUtc,
} from "./booking-time";

describe("validTimeZone", () => {
  it("accepts a real IANA zone", () => {
    expect(validTimeZone("America/New_York")).toBe(true);
  });

  it("rejects a made-up zone", () => {
    expect(validTimeZone("Not/AZone")).toBe(false);
  });
});

describe("wallMinutes / addWallMinutes", () => {
  it("converts HH:MM to minutes since midnight", () => {
    expect(wallMinutes("00:00")).toBe(0);
    expect(wallMinutes("09:30")).toBe(570);
    expect(wallMinutes("23:59")).toBe(1439);
  });

  it("adds minutes to a wall-clock time", () => {
    expect(addWallMinutes("09:30", 45)).toBe("10:15");
    expect(addWallMinutes("09:00", 0)).toBe("09:00");
  });

  it("does not wrap past 24:00 — callers own day-boundary handling", () => {
    // 23:45 + 30 minutes is "24:15", not "00:15": this function has no concept
    // of the calendar date, so it must not silently roll over to a new day.
    expect(addWallMinutes("23:45", 30)).toBe("24:15");
  });
});

describe("overlaps", () => {
  it("is true when two ranges genuinely intersect", () => {
    const a = [new Date("2026-01-01T10:00:00Z"), new Date("2026-01-01T11:00:00Z")];
    const b = [new Date("2026-01-01T10:30:00Z"), new Date("2026-01-01T11:30:00Z")];
    expect(overlaps(a[0], a[1], b[0], b[1])).toBe(true);
  });

  it("is false when one range fully precedes the other", () => {
    const a = [new Date("2026-01-01T10:00:00Z"), new Date("2026-01-01T11:00:00Z")];
    const b = [new Date("2026-01-01T11:30:00Z"), new Date("2026-01-01T12:00:00Z")];
    expect(overlaps(a[0], a[1], b[0], b[1])).toBe(false);
  });

  it("is false when two ranges only touch at the boundary", () => {
    // Booking buffers rely on back-to-back slots not counting as a conflict.
    const a = [new Date("2026-01-01T10:00:00Z"), new Date("2026-01-01T11:00:00Z")];
    const b = [new Date("2026-01-01T11:00:00Z"), new Date("2026-01-01T12:00:00Z")];
    expect(overlaps(a[0], a[1], b[0], b[1])).toBe(false);
  });

  it("is true when one range fully contains the other", () => {
    const a = [new Date("2026-01-01T09:00:00Z"), new Date("2026-01-01T13:00:00Z")];
    const b = [new Date("2026-01-01T10:00:00Z"), new Date("2026-01-01T11:00:00Z")];
    expect(overlaps(a[0], a[1], b[0], b[1])).toBe(true);
  });
});

describe("weekdayForDate", () => {
  it("returns the correct weekday name for a known date", () => {
    // 2026-01-01 is a Thursday (verified against Date.UTC(...).getUTCDay()).
    expect(weekdayForDate("2026-01-01")).toBe("thursday");
  });
});

describe("zonedWallTimeToUtc", () => {
  it("passes UTC wall time through unchanged", () => {
    expect(zonedWallTimeToUtc("2026-01-15", "09:00", "UTC")).toEqual(new Date("2026-01-15T09:00:00Z"));
  });

  it("applies the EST offset in winter", () => {
    // America/New_York is UTC-5 outside DST; Jan 15 is safely clear of any transition.
    expect(zonedWallTimeToUtc("2026-01-15", "09:00", "America/New_York")).toEqual(
      new Date("2026-01-15T14:00:00Z"),
    );
  });

  it("applies the EDT offset in summer", () => {
    // America/New_York is UTC-4 during DST; Jul 15 is safely clear of any transition.
    expect(zonedWallTimeToUtc("2026-07-15", "09:00", "America/New_York")).toEqual(
      new Date("2026-07-15T13:00:00Z"),
    );
  });
});

describe("dateInTimeZone", () => {
  it("rolls back to the previous calendar day when the local time is still 'yesterday'", () => {
    // 2026-01-01T02:00:00Z is 2025-12-31 21:00 in America/New_York (EST, UTC-5).
    expect(dateInTimeZone(new Date("2026-01-01T02:00:00Z"), "America/New_York")).toBe("2025-12-31");
  });

  it("matches the UTC date when the zone is UTC", () => {
    expect(dateInTimeZone(new Date("2026-01-01T02:00:00Z"), "UTC")).toBe("2026-01-01");
  });
});

describe("zonedDayRangeUtc", () => {
  it("returns the UTC instants for the start and end of a local calendar day", () => {
    const [start, end] = zonedDayRangeUtc("2026-01-15", "America/New_York");
    expect(start).toEqual(new Date("2026-01-15T05:00:00Z")); // 2026-01-15T00:00 EST
    expect(end).toEqual(new Date("2026-01-16T05:00:00Z")); // 2026-01-16T00:00 EST
  });
});
