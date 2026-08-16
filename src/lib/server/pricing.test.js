import { describe, expect, it } from "vitest";
import { calculateHostedPrice, fixedDepositPrice, PRICING_VERSION } from "./pricing";
import { HOSTED_PRICING } from "@/lib/pricing";

describe("calculateHostedPrice", () => {
  it("charges the core per-person rate once it clears the minimum", () => {
    const result = calculateHostedPrice({ players: 20, packageType: "core" });
    expect(result.amountCents).toBe(20 * HOSTED_PRICING.corePerPerson * 100);
    expect(result.pricingVersion).toBe(PRICING_VERSION);
    expect(result.normalizedInputs).toEqual({ players: 20, packageType: "core", addOns: [] });
  });

  it("charges the premium per-person rate once it clears the minimum", () => {
    const result = calculateHostedPrice({ players: 10, packageType: "premium" });
    expect(result.amountCents).toBe(10 * HOSTED_PRICING.premiumPerPerson * 100);
  });

  it("floors small groups at the hosted-event minimum instead of the per-person rate", () => {
    const result = calculateHostedPrice({ players: 5, packageType: "core" });
    expect(5 * HOSTED_PRICING.corePerPerson).toBeLessThan(HOSTED_PRICING.minimum);
    expect(result.amountCents).toBe(HOSTED_PRICING.minimum * 100);
  });

  it("adds each requested add-on on top of the base price", () => {
    const result = calculateHostedPrice({ players: 10, packageType: "core", addOns: ["kits", "awards"] });
    const base = Math.max(10 * HOSTED_PRICING.corePerPerson, HOSTED_PRICING.minimum);
    const addOnTotal = 10 * 30 + 250; // kits: players * 30, awards: flat 250
    expect(result.amountCents).toBe((base + addOnTotal) * 100);
    expect(result.normalizedInputs.addOns).toEqual(["kits", "awards"]);
  });

  it("sums all four add-ons when every one is requested", () => {
    const result = calculateHostedPrice({
      players: 10, packageType: "core", addOns: ["kits", "awards", "premiumHost", "extraTime"],
    });
    const base = Math.max(10 * HOSTED_PRICING.corePerPerson, HOSTED_PRICING.minimum);
    const addOnTotal = 10 * 30 + 250 + 300 + 150;
    expect(result.amountCents).toBe((base + addOnTotal) * 100);
  });

  it("deduplicates a repeated add-on instead of charging it twice", () => {
    const result = calculateHostedPrice({ players: 10, packageType: "core", addOns: ["kits", "kits"] });
    expect(result.normalizedInputs.addOns).toEqual(["kits"]);
  });

  it("silently drops unknown add-on keys instead of charging for them", () => {
    const result = calculateHostedPrice({ players: 10, packageType: "core", addOns: ["kits", "bogus"] });
    expect(result.normalizedInputs.addOns).toEqual(["kits"]);
  });

  it.each([0, -1, 1001, 2.5, NaN, undefined])("rejects an invalid player count (%p)", (players) => {
    expect(() => calculateHostedPrice({ players, packageType: "core" })).toThrow("invalid_player_count");
  });

  it.each([undefined, "gold", "standard"])("rejects an invalid package type (%p)", (packageType) => {
    expect(() => calculateHostedPrice({ players: 10, packageType })).toThrow("invalid_package");
  });
});

describe("fixedDepositPrice", () => {
  it("returns the family event deposit", () => {
    expect(fixedDepositPrice("family_deposit")).toEqual({ amountCents: 10000, label: "Family Event Deposit" });
  });

  it("returns the corporate hosted-event deposit", () => {
    expect(fixedDepositPrice("corporate_deposit")).toEqual({ amountCents: 20000, label: "Hosted Event Deposit" });
  });

  it("rejects an unrecognized payment kind", () => {
    expect(() => fixedDepositPrice("something_else")).toThrow("invalid_payment_kind");
  });
});
