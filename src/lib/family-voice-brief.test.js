import { describe, expect, it } from "vitest";
import { buildFamilyDemandSnapshot } from "../../supabase/functions/_shared/family-demand";

describe("family demand voice snapshot", () => {
  it("summarizes real family demand and excludes marked tests", () => {
    const snapshot = buildFamilyDemandSnapshot({
      now: new Date("2026-09-06T13:00:00Z"),
      leads: [
        { id: "family-1", audience_type: "family", occasion: "birthday", landing_page: "/virtual-birthday-game-show", preferred_event_date: "2026-09-16", lead_score: 72, status: "new", created_at: "2026-09-06T12:00:00Z", context: {} },
        { id: "family-2", audience_type: "friends", occasion: "birthday", landing_page: "/virtual-birthday-game-show", preferred_event_date: null, lead_score: 40, status: "new", created_at: "2026-09-01T12:00:00Z", context: {} },
        { id: "test-1", audience_type: "family", occasion: "reunion", landing_page: "/virtual-family-reunion-game-show", preferred_event_date: "2026-09-10", lead_score: 90, status: "suppressed", created_at: "2026-09-06T12:30:00Z", context: { synthetic_test: true } },
        { id: "company-1", audience_type: "corporate", occasion: "retreat", landing_page: "/virtual-team-building", lead_score: 80, status: "new", created_at: "2026-09-06T12:30:00Z", context: {} },
      ],
      bookings: [
        { lead_id: "family-1", status: "confirmed" },
        { lead_id: "test-1", status: "confirmed" },
      ],
    });

    expect(snapshot).toMatchObject({
      available: true,
      inquiries: 2,
      new_inquiries_24h: 1,
      date_requests: 1,
      qualified_inquiries: 1,
      confirmed_bookings: 1,
      strongest_occasion: { name: "birthday", count: 2 },
      strongest_landing_page: { name: "/virtual-birthday-game-show", count: 2 },
    });
    expect(snapshot.upcoming_date_requests).toEqual([
      { lead_id: "family-1", occasion: "birthday", requested_date: "2026-09-16" },
    ]);
  });

  it("returns an honest empty snapshot", () => {
    expect(buildFamilyDemandSnapshot({ now: new Date("2026-09-06T13:00:00Z") })).toMatchObject({
      inquiries: 0,
      new_inquiries_24h: 0,
      date_requests: 0,
      qualified_inquiries: 0,
      confirmed_bookings: 0,
      strongest_occasion: null,
      strongest_landing_page: null,
      upcoming_date_requests: [],
    });
  });
});
