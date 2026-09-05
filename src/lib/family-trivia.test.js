import { describe, expect, it } from "vitest";
import { buildFamilyTrivia } from "@/lib/family-trivia";

describe("family trivia starter", () => {
  it("creates a complete, occasion-aware twelve-question starter", () => {
    const questions = buildFamilyTrivia({
      occasion: "reunion",
      ageRange: "three or more generations",
      playerCount: "10-25",
      interests: "music, baseball, cooking",
      memory: "the rainy camping trip",
    });

    expect(questions).toHaveLength(12);
    expect(new Set(questions).size).toBe(12);
    expect(questions.join(" ")).toContain("family reunion");
    expect(questions.join(" ")).toContain("music");
    expect(questions.join(" ")).toContain("rainy camping trip");
  });

  it("limits visitor-provided text before placing it in a question", () => {
    const questions = buildFamilyTrivia({ interests: "x".repeat(500), memory: "y".repeat(500) });
    expect(Math.max(...questions.map((question) => question.length))).toBeLessThan(260);
  });
});
