// Teamtastic Unified Payment & Booking Configurations
// Contains Stripe Payment Links (No-Code checkout) and Calendly Stripe Booking embeds

export const PAYMENT_CONFIG = {
  // 1. SaaS Pro Plan Subscription ($99/mo)
  // Enforces the 1 active session/week limit, Autoplay mode, and tutorial access
  proSaaSLink: process.env.NEXT_PUBLIC_STRIPE_PRO_LINK || (process.env.NODE_ENV === "production" ? "#payment-configuration-required" : "https://buy.stripe.com/pro_subscription_mock_99"),

  // 2. Custom Content Build Add-on (Starting at $99)
  // Let clients purchase custom trivia slides or themed rounds to run themselves
  customContentLink: process.env.NEXT_PUBLIC_STRIPE_CUSTOM_BUILD_LINK || (process.env.NODE_ENV === "production" ? "#payment-configuration-required" : "https://buy.stripe.com/custom_build_mock_99"),

  // 3. Hosted VIP MC Event Booking ($200 Deposit)
  // Clients select their date/time and are forced to pay the $200 deposit before confirmation
  calendlyUrl: process.env.NEXT_PUBLIC_CALENDLY_URL || (process.env.NODE_ENV === "production" ? "#booking-configuration-required" : "https://calendly.com/teamtastic-events/hosted-mc-deposit"),
  calendlyEmbedCode: `
    <div class="calendly-inline-widget" data-url="${process.env.NEXT_PUBLIC_CALENDLY_URL || (process.env.NODE_ENV === "production" ? "#booking-configuration-required" : "https://calendly.com/teamtastic-events/hosted-mc-deposit")}?hide_landing_page_details=1&primary_color=8b5cf6" style="min-width:320px;height:700px;"></div>
    <script type="text/javascript" src="https://assets.calendly.com/assets/external/widget.js" async></script>
  `
};
