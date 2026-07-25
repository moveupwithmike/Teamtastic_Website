import { describe, expect, it } from "vitest";
import { HOSTED_PRICING, hostedStartingPriceCopy } from "./pricing";

describe("hosted pricing", () => {
  it("keeps the customer-facing copy aligned with the pricing constants", () => {
    expect(hostedStartingPriceCopy()).toBe(
      `Live-hosted Teamtastic events start at $${HOSTED_PRICING.corePerPerson} per person, with a $${HOSTED_PRICING.minimum} minimum for groups up to ${HOSTED_PRICING.minimumGroupSize}.`,
    );
  });

  it("keeps the reservation deposit below the hosted-event minimum", () => {
    expect(HOSTED_PRICING.deposit).toBeLessThan(HOSTED_PRICING.minimum);
  });
});
