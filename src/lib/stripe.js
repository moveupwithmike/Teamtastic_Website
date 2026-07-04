// Teamtastic hosted-event booking configuration.

export const PAYMENT_CONFIG = {
  // Hosted VIP MC Event Booking ($200 Deposit)
  // Clients select their date/time and are forced to pay the $200 deposit before confirmation
  calendlyUrl: process.env.NEXT_PUBLIC_CALENDLY_URL || (process.env.NODE_ENV === "production" ? "#booking-configuration-required" : "https://calendly.com/teamtastic-events/hosted-mc-deposit"),
};
