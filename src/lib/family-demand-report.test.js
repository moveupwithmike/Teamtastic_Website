import { describe, expect, it } from "vitest";
import { buildFamilyDemandReport, FAMILY_REPORT_PAGES } from "@/lib/family-demand-report";

describe("family demand reporting", () => {
  it("combines first-party traffic with private-family inquiries and bookings", () => {
    const report = buildFamilyDemandReport({
      campaigns: [
        { landing_page: "/virtual-anniversary-party", visitors: 20, engaged_visitors: 8, revenue: 250 },
        { landing_page: "/virtual-anniversary-party", visitors: 5, engaged_visitors: 2, revenue: 0 },
        { landing_page: "/corporate", visitors: 99, engaged_visitors: 50, revenue: 900 },
      ],
      leads: [
        { id: "family-1", audience_type: "family", landing_page: "/virtual-anniversary-party", occasion: "anniversary", preferred_event_date: "2026-10-10", lead_score: 70 },
        { id: "family-2", audience_type: "friends", landing_page: "/unknown", occasion: "birthday", preferred_event_date: null, lead_score: 40 },
        { id: "corp-1", audience_type: "corporate", landing_page: "/virtual-anniversary-party", lead_score: 90 },
      ],
      bookings: [
        { lead_id: "family-1", status: "confirmed" },
        { lead_id: "family-2", status: "cancelled" },
      ],
    });

    expect(FAMILY_REPORT_PAGES).toHaveLength(8);
    expect(report.summary).toMatchObject({ visitors: 25, leads: 2, attributed_leads: 1, unattributed_leads: 1, date_requests: 1, qualified_leads: 1, bookings: 1, revenue: 250 });
    expect(report.pages[0]).toMatchObject({ landing_page: "/virtual-anniversary-party", visitors: 25, leads: 1, bookings: 1, visitor_to_lead_rate: 0.04 });
    expect(report.occasions).toEqual([{ occasion: "anniversary", count: 1 }, { occasion: "birthday", count: 1 }]);
  });
});
