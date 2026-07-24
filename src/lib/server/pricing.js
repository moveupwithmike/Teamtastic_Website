import { HOSTED_PRICING } from "@/lib/pricing";

export const PRICING_VERSION = "hosted-v1";

const ADD_ONS = {
  kits: ({ players }) => players * 30,
  awards: () => 250,
  premiumHost: () => 300,
  extraTime: () => 150,
};

export function calculateHostedPrice(input) {
  const players = Number(input?.players);
  const packageType = input?.packageType;
  if (!Number.isInteger(players) || players < 1 || players > 1000) {
    throw new Error("invalid_player_count");
  }
  if (!["core", "premium"].includes(packageType)) {
    throw new Error("invalid_package");
  }
  const selectedAddOns = Array.isArray(input?.addOns)
    ? [...new Set(input.addOns.filter((key) => key in ADD_ONS))]
    : [];
  const perPerson = packageType === "premium"
    ? HOSTED_PRICING.premiumPerPerson
    : HOSTED_PRICING.corePerPerson;
  const base = Math.max(players * perPerson, HOSTED_PRICING.minimum);
  const addOnTotal = selectedAddOns.reduce(
    (sum, key) => sum + ADD_ONS[key]({ players }),
    0,
  );
  return {
    amountCents: (base + addOnTotal) * 100,
    pricingVersion: PRICING_VERSION,
    normalizedInputs: { players, packageType, addOns: selectedAddOns },
  };
}

export function fixedDepositPrice(kind) {
  if (kind === "family_deposit") {
    return { amountCents: 10000, label: "Family Event Deposit" };
  }
  if (kind === "corporate_deposit") {
    return { amountCents: 20000, label: "Hosted Event Deposit" };
  }
  throw new Error("invalid_payment_kind");
}
