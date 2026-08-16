import { afterEach, describe, expect, it, vi } from "vitest";

describe("core utility modules", () => {
  afterEach(() => vi.restoreAllMocks());

  it("resolves consent from storage and regional defaults", async () => {
    const values = new Map();
    vi.stubGlobal("localStorage", { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) });
    const consent = await import("./consent");
    vi.spyOn(Intl, "DateTimeFormat").mockReturnValue(/** @type {Intl.DateTimeFormat} */ ({ resolvedOptions: () => ({ timeZone: "Europe/London" }) }));
    expect(consent.effectiveConsent()).toBe("denied");
    localStorage.setItem(consent.CONSENT_KEY, "granted");
    expect(consent.storedConsent()).toBe("granted");
    expect(consent.effectiveConsent()).toBe("granted");
  });

  it("formats active and expired holiday offers", async () => {
    const { holidayDeadlineLabel, holidayOfferCopy } = await import("./holiday-campaign");
    expect(holidayDeadlineLabel()).toBe("September 30");
    expect(holidayOfferCopy(new Date("2026-09-01T00:00:00Z"))).toMatchObject({ active: true });
    expect(holidayOfferCopy(new Date("2026-10-02T00:00:00Z"))).toMatchObject({ active: false, deadlineLabel: null });
  });

  it("exports payment configuration and corporate FAQs", async () => {
    const [{ PAYMENT_CONFIG }, { corporateFaqs }] = await Promise.all([import("./stripe"), import("./corporate-faqs")]);
    expect(PAYMENT_CONFIG.depositUrl).toBeTruthy();
    expect(corporateFaqs).toHaveLength(8);
  });
});
