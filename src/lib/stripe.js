// Teamtastic Unified Payment & Booking Configurations
// Contains Stripe Payment Links (No-Code checkout) and Calendly Stripe Booking embeds

export const PAYMENT_CONFIG = {
  // 1. SaaS Pro Plan Subscription ($99/mo)
  // Enforces the 1 active session/week limit, Autoplay mode, and tutorial access
  proSaaSLink: "https://buy.stripe.com/pro_subscription_mock_99", // Replace with your live buy.stripe.com URL

  // 2. Custom Content Build Add-on (Starting at $99)
  // Let clients purchase custom trivia slides or themed rounds to run themselves
  customContentLink: "https://buy.stripe.com/custom_build_mock_99", // Replace with your live buy.stripe.com URL

  // 3. Hosted VIP MC Event Booking ($200 Deposit)
  // Clients select their date/time and are forced to pay the $200 deposit before confirmation
  calendlyUrl: "https://calendly.com/teamtastic-events/hosted-mc-deposit", // Replace with your live Calendly link
  calendlyEmbedCode: `
    <div class="calendly-inline-widget" data-url="https://calendly.com/teamtastic-events/hosted-mc-deposit?hide_landing_page_details=1&primary_color=8b5cf6" style="min-width:320px;height:700px;"></div>
    <script type="text/javascript" src="https://assets.calendly.com/assets/external/widget.js" async></script>
  `
};
