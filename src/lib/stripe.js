// Teamtastic hosted-event booking configuration.

export const PAYMENT_CONFIG = {
  depositUrl:
    process.env.NEXT_PUBLIC_STRIPE_DEPOSIT_URL ||
    (process.env.NODE_ENV === "production"
      ? "#deposit-configuration-required"
      : "https://buy.stripe.com/test_deposit"),
  calendlyUrl:
    process.env.NEXT_PUBLIC_CALENDLY_URL ||
    (process.env.NODE_ENV === "production"
      ? "#booking-configuration-required"
      : "https://calendly.com/teamtastic-events/15min"),
};
