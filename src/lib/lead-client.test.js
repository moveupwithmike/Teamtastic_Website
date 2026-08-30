import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { captureFirstTouchAttribution, getAttribution } from "./lead-client";

function navigateTo(url) {
  window.history.pushState({}, "", url);
}

describe("first-touch UTM attribution", () => {
  beforeEach(() => {
    sessionStorage.clear();
    Object.defineProperty(document, "referrer", { value: "", configurable: true });
    const values = new Map();
    vi.stubGlobal("localStorage", { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) });
  });
  afterEach(() => {
    sessionStorage.clear();
  });

  it("direct conversion: captures UTM when the lead form is on the same landing page", () => {
    navigateTo("/virtual-team-building?utm_source=google&utm_medium=cpc&utm_campaign=fall_launch");
    captureFirstTouchAttribution();
    const attribution = getAttribution();
    expect(attribution.utm).toMatchObject({ source: "google", medium: "cpc", campaign: "fall_launch" });
    expect(attribution.landingPage).toBe("/virtual-team-building?utm_source=google&utm_medium=cpc&utm_campaign=fall_launch");
  });

  it("multi-page conversion: UTM survives browsing to a different page before the form is found", () => {
    navigateTo("/blog/virtual-team-building-ideas?utm_source=newsletter&utm_medium=email&utm_campaign=weekly_digest");
    captureFirstTouchAttribution();

    navigateTo("/games");
    captureFirstTouchAttribution();

    navigateTo("/virtual-team-building");
    captureFirstTouchAttribution();

    const attribution = getAttribution();
    expect(attribution.utm).toMatchObject({ source: "newsletter", medium: "email", campaign: "weekly_digest" });
    // The original entry page is preserved as the landing page, not the final page the form lived on.
    expect(attribution.landingPage).toBe("/blog/virtual-team-building-ideas?utm_source=newsletter&utm_medium=email&utm_campaign=weekly_digest");
  });

  it("no UTM: a direct visit with no campaign parameters does not fabricate attribution", () => {
    navigateTo("/virtual-team-building");
    captureFirstTouchAttribution();
    const attribution = getAttribution();
    expect(attribution.utm).toEqual({ source: null, medium: null, campaign: null, content: null, term: null });
    // Falls through to a live read of the current page rather than a stale empty capture.
    expect(attribution.landingPage).toBe("/virtual-team-building");
  });

  it("second internal page: plain internal navigation never replaces a captured source with Teamtastic itself", () => {
    navigateTo("/virtual-team-building?utm_source=linkedin&utm_medium=social&utm_campaign=q4_push");
    captureFirstTouchAttribution();

    navigateTo("/pricing");
    captureFirstTouchAttribution();
    navigateTo("/why-teamtastic");
    captureFirstTouchAttribution();

    const attribution = getAttribution();
    expect(attribution.utm.source).toBe("linkedin");
    expect(attribution.utm.campaign).toBe("q4_push");
  });

  it("captureFirstTouchAttribution is a safe no-op once a first touch is already stored", () => {
    navigateTo("/virtual-team-building?utm_source=first&utm_medium=cpc&utm_campaign=one");
    captureFirstTouchAttribution();
    navigateTo("/virtual-team-building?utm_source=second&utm_medium=cpc&utm_campaign=two");
    captureFirstTouchAttribution();

    expect(getAttribution().utm.source).toBe("first");
  });

  it("consent denied: attribution capture is unaffected by analytics consent state (first-party, not gated)", () => {
    localStorage.setItem("teamtastic_analytics_consent", "denied");
    navigateTo("/virtual-team-building?utm_source=google&utm_medium=cpc&utm_campaign=fall_launch");
    captureFirstTouchAttribution();
    const attribution = getAttribution();
    expect(attribution.utm.source).toBe("google");
  });
});
