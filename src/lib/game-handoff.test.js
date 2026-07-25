import { describe, expect, it } from "vitest";
import { buildGameHandoffUrl } from "./game-handoff";

describe("buildGameHandoffUrl", () => {
  it("builds the canonical game handoff URL", () => {
    const url = new URL(
      buildGameHandoffUrl({
        vibe: "social",
        size: "11-25",
        occasion: "team social",
        recommendation: "The Hot Seat",
        submissionId: "submission-123",
      }),
    );

    expect(url.origin).toBe("https://teamtastic.games");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      vibe: "social",
      size: "11-25",
      occasion: "team social",
      recommendation: "The Hot Seat",
      submission_id: "submission-123",
    });
  });

  it("uses an empty canonical parameter set when no context is supplied", () => {
    const url = new URL(buildGameHandoffUrl());
    expect([...url.searchParams.keys()]).toEqual([
      "vibe",
      "size",
      "occasion",
      "recommendation",
      "submission_id",
    ]);
    expect([...url.searchParams.values()]).toEqual(["", "", "", "", ""]);
  });
});
