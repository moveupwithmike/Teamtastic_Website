import { describe, expect, it } from "vitest";
import { createLiveRecordFilter } from "./live-records";

const classifications = [
  { record_type: "prospect", record_id: "live", classification: "production", classified_at: null },
  { record_type: "prospect", record_id: "test", classification: "test_qa", classified_at: null },
  { record_type: "deal", record_id: "promoted", classification: "production", classified_at: "2026-09-08T12:00:00Z" },
];

describe("createLiveRecordFilter", () => {
  it("shows only production records created after the clean-start boundary", () => {
    const filter = createLiveRecordFilter({ classifications, reportingSince: "2026-09-07T12:00:00Z" });
    expect(filter.isLiveId("prospect", "live", "2026-09-08T12:00:00Z")).toBe(true);
    expect(filter.isLiveId("prospect", "live", "2026-09-06T12:00:00Z")).toBe(false);
    expect(filter.isLiveId("prospect", "test", "2026-09-08T12:00:00Z")).toBe(false);
    expect(filter.isLiveId("prospect", "missing", "2026-09-08T12:00:00Z")).toBe(false);
  });

  it("allows an older record deliberately promoted after the boundary", () => {
    const filter = createLiveRecordFilter({ classifications, reportingSince: "2026-09-07T12:00:00Z" });
    expect(filter.isLiveId("deal", "promoted", "2026-08-01T12:00:00Z")).toBe(true);
  });

  it("fails closed when classification data is unavailable", () => {
    const filter = createLiveRecordFilter({ classifications, ready: false });
    expect(filter.isLiveId("prospect", "live", "2026-09-08T12:00:00Z")).toBe(false);
    expect(filter.ready).toBe(false);
  });
});
