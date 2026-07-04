export const PRODUCT_KEYS = {
  DEPOSIT: "hosted_event_deposit",
  PRO: "pro_subscription",
  CUSTOM_CONTENT: "custom_content",
  UNCLASSIFIED: "unclassified",
};

export const PRODUCTS = {
  [PRODUCT_KEYS.DEPOSIT]: {
    name: "Hosted Event Deposit",
    analyticsEvent: "deposit_completed",
  },
  [PRODUCT_KEYS.PRO]: {
    name: "Professional Self-Service Subscription",
    analyticsEvent: "subscription_started",
  },
  [PRODUCT_KEYS.CUSTOM_CONTENT]: {
    name: "Custom Content Purchase",
    analyticsEvent: "custom_content_purchased",
  },
  [PRODUCT_KEYS.UNCLASSIFIED]: {
    name: "Unclassified Stripe Checkout",
    analyticsEvent: "unclassified_checkout_completed",
  },
};

function paymentLinkId(session) {
  if (typeof session.payment_link === "string") return session.payment_link;
  return session.payment_link?.id || null;
}

export function classifyStripeSession(session) {
  const linkId = paymentLinkId(session);
  if (linkId && linkId === process.env.STRIPE_PRO_PAYMENT_LINK_ID) return PRODUCT_KEYS.PRO;
  if (linkId && linkId === process.env.STRIPE_CUSTOM_CONTENT_PAYMENT_LINK_ID) {
    return PRODUCT_KEYS.CUSTOM_CONTENT;
  }
  if (linkId && linkId === process.env.STRIPE_DEPOSIT_PAYMENT_LINK_ID) return PRODUCT_KEYS.DEPOSIT;

  // Calendly-created paid bookings do not use a Teamtastic Payment Link.
  if (!linkId && session.mode === "payment") return PRODUCT_KEYS.DEPOSIT;
  if (session.mode === "subscription") return PRODUCT_KEYS.PRO;
  return PRODUCT_KEYS.UNCLASSIFIED;
}

