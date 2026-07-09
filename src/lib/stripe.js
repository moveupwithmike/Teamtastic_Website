// Teamtastic hosted-event booking configuration.

export const PAYMENT_CONFIG = {
  depositUrl:
    process.env.NEXT_PUBLIC_STRIPE_DEPOSIT_URL ||
    (process.env.NODE_ENV === "production"
      ? "#deposit-configuration-required"
      : "https://buy.stripe.com/test_deposit"),
  familyDepositUrl:
    process.env.NEXT_PUBLIC_STRIPE_FAMILY_DEPOSIT_URL ||
    // Public $100 family payment link; env var above overrides when set.
    "https://buy.stripe.com/28EbJ0gz65UW8mn9z65Ne02",
  calendlyUrl:
    process.env.NEXT_PUBLIC_CALENDLY_URL ||
    (process.env.NODE_ENV === "production"
      ? "#booking-configuration-required"
      : "https://calendly.com/teamtastic-events/15min"),
};
