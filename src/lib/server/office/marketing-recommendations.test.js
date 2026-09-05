// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/supabase-admin", () => ({ getSupabaseAdmin: vi.fn() }));

describe("marketing recommendations", () => {
  it("turns first-party growth evidence into a complete, recommendation-only ad proposal", async () => {
    const { recommendationFromGrowthItem } = await import("./marketing-recommendations");
    const result = recommendationFromGrowthItem({
      segment: "/virtual-family-reunion-game-show · google · reunion-test",
      action: "Review targeting and the lead promise.",
      evidence: { leads: 5, qualified_leads: 0, conversions: 0, revenue: 0 },
    }, { id: "b1", brief_date: "2026-09-05" });

    expect(result).toMatchObject({
      recommendation_type: "advertising",
      occasion: "Family reunion",
      platform: "Google Ads — recommendation only",
      suggested_daily_budget_cents: 1500,
      test_days: 14,
      landing_page: "/virtual-family-reunion-game-show",
    });
    expect(result.expected_result).toContain("no booking result is promised");
    expect(result.evidence.external_platform_data_connected).toBe(false);
  });

  it("does not attach an advertising budget to an organic recommendation", async () => {
    const { recommendationFromGrowthItem } = await import("./marketing-recommendations");
    const result = recommendationFromGrowthItem({ segment: "/virtual-birthday-game-show · organic · none", action: "Improve organic demand.", evidence: {} }, { id: "b1", brief_date: "2026-09-05" });
    expect(result).toMatchObject({ recommendation_type: "seo", platform: "SEO — recommendation only", suggested_daily_budget_cents: 0, test_days: 0 });
  });
});
