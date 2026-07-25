import { describe, expect, it } from "vitest";
import gamesData from "./gamesData.json";
import {
  getCorporateConciergeRecs,
  getFamilyConciergeRecs,
  getRecommendation,
  recommendations,
} from "./recommendations";

const catalogSlugs = new Set(gamesData.map((game) => game.slug));

describe("recommendations", () => {
  it("falls back to the competitive recommendation for an unknown vibe", () => {
    expect(getRecommendation("unknown")).toBe(recommendations.competitive);
  });

  it("only references games that exist in the catalog", () => {
    const slugs = [
      ...Object.values(recommendations).flatMap((item) => item.slugs),
      ...getCorporateConciergeRecs("trivia").map((item) => item.slug),
      ...getCorporateConciergeRecs("escape room").map((item) => item.slug),
      ...getCorporateConciergeRecs("music").map((item) => item.slug),
      ...getCorporateConciergeRecs().map((item) => item.slug),
      ...getFamilyConciergeRecs("trivia").map((item) => item.slug),
      ...getFamilyConciergeRecs("bingo").map((item) => item.slug),
      ...getFamilyConciergeRecs().map((item) => item.slug),
    ];

    expect(slugs.filter((slug) => !catalogSlugs.has(slug))).toEqual([]);
  });
});
