import { afterEach, describe, expect, it } from "vitest";
import { classifyStripeSession, PRODUCT_KEYS } from "./products";

describe("classifyStripeSession", () => {
  const originalEnv = { ...process.env };
  afterEach(() => { process.env = { ...originalEnv }; });
  it("uses valid metadata before payment-link heuristics", () => {
    expect(classifyStripeSession({ metadata: { product_key: PRODUCT_KEYS.CUSTOM_CONTENT }, mode: "payment" })).toBe(PRODUCT_KEYS.CUSTOM_CONTENT);
  });

  it("classifies payment, subscription, and unknown sessions", () => {
    expect(classifyStripeSession({ mode: "payment" })).toBe(PRODUCT_KEYS.DEPOSIT);
    expect(classifyStripeSession({ mode: "subscription" })).toBe(PRODUCT_KEYS.PRO);
    expect(classifyStripeSession({ mode: "setup" })).toBe(PRODUCT_KEYS.UNCLASSIFIED);
  });

  it("classifies string and expanded Payment Link references", () => {
    process.env.STRIPE_PRO_PAYMENT_LINK_ID = "plink_pro";
    process.env.STRIPE_DEPOSIT_PAYMENT_LINK_ID = "plink_deposit";
    process.env.STRIPE_FAMILY_DEPOSIT_PAYMENT_LINK_ID = "plink_family";
    expect(classifyStripeSession({ payment_link: "plink_pro" })).toBe(PRODUCT_KEYS.PRO);
    expect(classifyStripeSession({ payment_link: { id: "plink_deposit" } })).toBe(PRODUCT_KEYS.DEPOSIT);
    expect(classifyStripeSession({ payment_link: "plink_family" })).toBe(PRODUCT_KEYS.DEPOSIT);
  });
});
