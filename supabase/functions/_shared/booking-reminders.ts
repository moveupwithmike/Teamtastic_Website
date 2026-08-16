export const REMINDER_WINDOWS = [
  { column: "reminder_24h_sent_at", minHours: 23.75, maxHours: 24.25, label: "24h" },
  { column: "reminder_1h_sent_at", minHours: 0.75, maxHours: 1.25, label: "1h" },
] as const;

export function buildReminderEmail(label: "24h" | "1h", booking: Record<string, unknown>, bookingTypeName: string) {
  const timezone = String(booking.visitor_timezone);
  const whenText = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone, dateStyle: "full", timeStyle: "short",
  }).format(new Date(String(booking.starts_at)));
  const joinLine = booking.zoom_join_url ? `Join link: ${booking.zoom_join_url}` : null;
  if (label === "24h") return {
    subject: `Tomorrow: your ${bookingTypeName} with Teamtastic`,
    bodyLines: [`Hi ${booking.name},`, "", `Quick reminder — our ${bookingTypeName} is tomorrow, ${whenText} (${timezone.replaceAll("_", " ")}).`, "", joinLine, "", "Come with your team in mind — we'll map out the rest together.", "", "Need to reschedule? Just reply to this email.", "", "Michael"],
  };
  return {
    subject: "Starting soon: your Teamtastic call",
    bodyLines: [`Hi ${booking.name},`, "", `Just a heads up — our ${bookingTypeName} starts in about an hour, at ${whenText}.`, "", joinLine, "", "See you soon!", "", "Michael"],
  };
}
