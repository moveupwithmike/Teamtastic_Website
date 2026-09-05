import { describe, expect, it } from "vitest";
import { FAMILY_DEMAND_ROUTES, FAMILY_OCCASIONS } from "@/lib/family-demand";

describe("family demand pages", () => {
  it("defines the first three distinct search pages", () => {
    expect(FAMILY_DEMAND_ROUTES).toEqual([
      "/virtual-family-reunion-game-show",
      "/virtual-birthday-game-show",
      "/long-distance-family-game-night",
    ]);
    expect(new Set(Object.values(FAMILY_OCCASIONS).map((page) => page.title)).size).toBe(3);
    expect(new Set(Object.values(FAMILY_OCCASIONS).map((page) => page.metaDescription)).size).toBe(3);
  });

  it("includes honest page essentials without unverified testimonials", () => {
    for (const page of Object.values(FAMILY_OCCASIONS)) {
      expect(page.faqs.length).toBeGreaterThanOrEqual(4);
      expect(page.games.length).toBe(3);
      expect(page.benefits.length).toBeGreaterThanOrEqual(4);
      expect(page).not.toHaveProperty("testimonials");
    }
  });
});
