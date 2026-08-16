import { describe, expect, it } from "vitest";
import { clean } from "./validation";

describe("clean", () => {
  it("trims and truncates a string to the max length", () => {
    expect(clean("  hello world  ", 5)).toBe("hello");
  });

  it("defaults to a 300-character max", () => {
    expect(clean("a".repeat(400))).toHaveLength(300);
  });

  it("discards non-string input instead of coercing it", () => {
    expect(clean(123)).toBe("");
    expect(clean({ toString: () => "sneaky" })).toBe("");
    expect(clean(null)).toBe("");
    expect(clean(undefined)).toBe("");
  });
});
