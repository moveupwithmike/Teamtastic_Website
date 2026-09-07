// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { requiresManualPost, slugify, buildTrackedUrl, normalizeMedia, socialContentFingerprint, socialScheduleFingerprint } from "./social-shared";

const baseItem = {
  id: "item_1",
  channel: "linkedin",
  format: "text",
  destination: "Teamtastic",
  caption: "Try our virtual holiday party.",
  hook: "Teams love this.",
  cta: "Book today.",
  media: [],
  target_page: "/virtual-holiday-party",
  tracked_url: "https://www.teamtastic.events/testing",
  platform_account_id: "acc_1",
};

describe("requiresManualPost", () => {
  it("treats reddit and explicit manual channels as manual", () => {
    expect(requiresManualPost("reddit")).toBe(true);
    expect(requiresManualPost("linkedin")).toBe(false);
  });
});

describe("slugify + buildTrackedUrl", () => {
  it("slugs titles for utm_content", () => {
    expect(slugify("  Virtual  Holiday Party!  ")).toBe("virtual-holiday-party");
  });

  it("builds a tracked url with channel, campaign, and content", () => {
    const url = buildTrackedUrl({ channel: "linkedin", targetPage: "/virtual-holiday-party", campaign: "social_2026_09", content: "virtual-holiday-party" });
    expect(url).toBe("https://www.teamtastic.events/virtual-holiday-party?utm_source=linkedin&utm_medium=organic_distribution&utm_campaign=social_2026_09&utm_content=virtual-holiday-party");
  });
});

describe("normalizeMedia", () => {
  it("maps an uploaded row into a normalized media asset", () => {
    expect(normalizeMedia([{ bucket: "distribution-media", path: "m@team/abc.png", mime: "image/png", kind: "image" }]))
      .toEqual([{ bucket: "distribution-media", path: "m@team/abc.png", mime: "image/png", kind: "image" }]);
  });

  it("refuses non-arrays and drops rows without a path", () => {
    expect(normalizeMedia([1, 2])).toEqual([]);
    expect(normalizeMedia(null)).toEqual([]);
    expect(normalizeMedia([{ mime: "image/png" }])).toEqual([]);
  });
});

describe("fingerprints", () => {
  it("is content-bound and changes when the caption changes", () => {
    const a = socialContentFingerprint(baseItem);
    const b = socialContentFingerprint({ ...baseItem, caption: "Changed." });
    expect(a).toBeTruthy();
    expect(a).not.toBe(b);
  });

  it("binds the exact schedule time", () => {
    const contentFp = socialContentFingerprint(baseItem);
    const t1 = socialScheduleFingerprint(contentFp, "2026-10-01T14:00:00.000Z");
    const t2 = socialScheduleFingerprint(contentFp, "2026-10-01T15:00:00.000Z");
    expect(t1).not.toBe(t2);
  });
});