// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  AGE_BUCKETS,
  HANDLED_INTENTS,
  HOT_INTENTS,
  HOT_MIN_CONFIDENCE,
  ageBucketForDate,
  ageBucketForMinutes,
  classifyHot,
  isHotIntent,
  isSuppressing,
  nextActionFor,
} from "./hot-lead";

describe("intent model", () => {
  it("treats only the three high-intent labels as hot and requires a confidence floor", () => {
    for (const label of HOT_INTENTS) {
      expect(isHotIntent(label, 0.9)).toBe(true);
      expect(isHotIntent(label, HOT_MIN_CONFIDENCE)).toBe(true);
      expect(isHotIntent(label, HOT_MIN_CONFIDENCE - 0.01)).toBe(false);
    }
    expect(isHotIntent("question", 0.99)).toBe(false);
    expect(isHotIntent("not_now", 0.99)).toBe(false);
    expect(isHotIntent("unknown", 0.9)).toBe(false);
  });

  it("never surfaces a hot alert for ambiguous or low-confidence replies", () => {
    expect(classifyHot("question", 0.8).hot).toBe(false);
    expect(classifyHot("interested", 0.6).hot).toBe(false);
    expect(classifyHot("unknown", 1).hot).toBe(false);
    expect(classifyHot("out_of_office", 0.99).hot).toBe(false);
  });

  it("gates every hot intent at the exact 0.75 confidence boundary, not just the JS module's own default", () => {
    // Regression: automation.handle_inbound_message() and the Office dashboard
    // query both used to bypass this floor for prospect status / task priority.
    // These exact values are the ones specified in the confidence-floor audit.
    for (const label of HOT_INTENTS) {
      expect(isHotIntent(label, 0.74)).toBe(false);
      expect(isHotIntent(label, 0.7499)).toBe(false);
      expect(isHotIntent(label, 0.75)).toBe(true); // inclusive boundary
      expect(isHotIntent(label, 0.7501)).toBe(true);
      expect(isHotIntent(label, 0.95)).toBe(true);
    }
  });

  it("never gates deterministic hard-stop suppression on confidence — a low-confidence unsubscribe must still suppress", () => {
    // Unlike hot-intent detection, suppression is deterministic by design:
    // classifyHardStop() in ingest-gmail-replies assigns unsubscribe/legal/
    // complaint/out_of_office via regex before the LLM ever runs, specifically
    // so these paths never depend on a confidence score. isSuppressing()
    // intentionally takes no confidence argument at all — confirm the
    // classification alone decides suppression, at every confidence level.
    for (const label of ["unsubscribe", "not_interested", "complaint", "legal"]) {
      expect(isSuppressing(label)).toBe(true);
      // isSuppressing has no confidence parameter — verify the function
      // signature itself can't accept one that would weaken this.
      expect(isSuppressing.length).toBe(1);
    }
  });

  it("suppresses only hard negatives; not_now and out_of_office are NOT suppression", () => {
    for (const label of ["unsubscribe", "not_interested", "complaint", "legal"]) {
      expect(isSuppressing(label)).toBe(true);
    }
    expect(isSuppressing("not_now")).toBe(false);
    expect(isSuppressing("out_of_office")).toBe(false);
    expect(isSuppressing("interested")).toBe(false);
  });

  it("the handled catalog is exhaustive and dedupes cleanly with no stray labels", () => {
    const unique = new Set(HANDLED_INTENTS);
    expect(unique.size).toBe(HANDLED_INTENTS.length);
    for (const label of HANDLED_INTENTS) {
      expect(nextActionFor(label)).toBeTruthy();
      expect(nextActionFor(label).length).toBeGreaterThan(10);
    }
    expect(nextActionFor("nonsense-label")).toBe(nextActionFor("unknown"));
  });

  it("age buckets match the business thresholds and boundary edges", () => {
    expect(ageBucketForMinutes(0)).toBe("NEW");
    expect(ageBucketForMinutes(59)).toBe("NEW");
    expect(ageBucketForMinutes(60)).toBe("WAITING");
    expect(ageBucketForMinutes(4 * 60 - 1)).toBe("WAITING");
    expect(ageBucketForMinutes(4 * 60)).toBe("OVERDUE");
    expect(ageBucketForMinutes(3 * 24 * 60 - 1)).toBe("OVERDUE");
    expect(ageBucketForMinutes(3 * 24 * 60)).toBe("STALE");
    expect(AGE_BUCKETS.every((bucket) => bucket.minMinutes < bucket.maxMinutes)).toBe(true);
    expect(ageBucketForDate(new Date())).toBe("NEW");
  });
});