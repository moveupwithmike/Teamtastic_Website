import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const capture = vi.fn(), identify = vi.fn(), effectiveConsent = vi.fn(), fetchMock = vi.fn();
vi.mock("posthog-js", () => ({ default: { capture: (...args) => capture(...args), identify: (...args) => identify(...args) } }));
vi.mock("@/lib/consent", () => ({ effectiveConsent: () => effectiveConsent() }));

describe("client analytics and lead capture", () => {
  beforeEach(() => {
    vi.resetModules(); vi.clearAllMocks();
    const values = new Map();
    vi.stubGlobal("localStorage", { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), clear: () => values.clear() });
    effectiveConsent.mockReturnValue("granted");
    window.history.replaceState({}, "", "/holiday?utm_source=google&utm_campaign=winter");
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ success: true, submissionId: "123e4567-e89b-12d3-a456-426614174000" }) });
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("removes PII and sends consented analytics", async () => {
    window.fbq = /** @type {Window["fbq"]} */ (/** @type {unknown} */ (vi.fn()));
    window.gtag = vi.fn();
    const { track } = await import("./analytics");
    track("lead_captured", { email: "private@example.com", package: "core" });
    expect(capture).toHaveBeenCalledWith("lead_captured", { package: "core" });
    expect(window.fbq).toHaveBeenCalledWith("track", "Lead", { package: "core" });
    expect(fetch).toHaveBeenCalledWith("/api/funnel-events", expect.objectContaining({ method: "POST" }));
  });

  it("does not track without consent and validates lead identities", async () => {
    const { track, identifyLead } = await import("./analytics");
    effectiveConsent.mockReturnValue("denied"); track("page_view"); identifyLead("bad");
    expect(capture).not.toHaveBeenCalled(); expect(identify).not.toHaveBeenCalled();
    effectiveConsent.mockReturnValue("granted"); identifyLead("123e4567-e89b-12d3-a456-426614174000");
    expect(identify).toHaveBeenCalledWith("lead:123e4567-e89b-12d3-a456-426614174000");
  });

  it("captures leads with attribution and identifies successful submissions", async () => {
    const { captureLead, getAttribution, createSubmissionId } = await import("./lead-client");
    expect(createSubmissionId()).toMatch(/[0-9a-f-]{36}/i);
    expect(getAttribution()).toMatchObject({ landingPage: "/holiday?utm_source=google&utm_campaign=winter", utm: { source: "google", campaign: "winter" } });
    const result = await captureLead({ name: "Taylor" });
    expect(result.success).toBe(true);
    expect(identify).toHaveBeenCalled();
  });

  it("throws the API's structured lead error", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ message: "Invalid", code: "INVALID", retryable: false }) });
    const { captureLead } = await import("./lead-client");
    await expect(captureLead({})).rejects.toMatchObject({ message: "Invalid", code: "INVALID", retryable: false });
  });
});
