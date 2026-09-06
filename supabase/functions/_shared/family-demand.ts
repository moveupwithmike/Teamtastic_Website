const PRIVATE_AUDIENCES = new Set(["family", "friends", "other_private_event"]);
const COMPLETED_BOOKING_STATUSES = new Set(["confirmed", "completed", "rescheduled"]);

type FamilyLead = {
  id?: string;
  audience_type?: string | null;
  occasion?: string | null;
  preferred_event_date?: string | null;
  lead_score?: number | string | null;
  landing_page?: string | null;
  status?: string | null;
  context?: Record<string, unknown> | null;
  created_at?: string | null;
};

type FamilyBooking = {
  lead_id?: string | null;
  status?: string | null;
};

function countBy(rows: FamilyLead[], value: (row: FamilyLead) => string) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = value(row).trim();
    if (key) counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function validDateOnly(value: unknown) {
  const text = String(value || "");
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

export function buildFamilyDemandSnapshot({
  leads = [],
  bookings = [],
  now = new Date(),
}: {
  leads?: FamilyLead[];
  bookings?: FamilyBooking[];
  now?: Date;
} = {}) {
  const realLeads = leads.filter((lead) =>
    PRIVATE_AUDIENCES.has(String(lead.audience_type || "")) && lead.context?.synthetic_test !== true
  );
  const leadIds = new Set(realLeads.map((lead) => lead.id).filter(Boolean));
  const cutoff24h = now.getTime() - 24 * 60 * 60 * 1000;
  const today = now.toISOString().slice(0, 10);
  const attentionLimit = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const occasions = countBy(realLeads, (lead) => String(lead.occasion || ""));
  const landingPages = countBy(realLeads, (lead) => String(lead.landing_page || "").split(/[?#]/)[0]);
  const upcomingDateRequests = realLeads
    .filter((lead) => !["suppressed", "disqualified", "converted"].includes(String(lead.status || "")))
    .map((lead) => ({
      lead_id: lead.id || null,
      occasion: String(lead.occasion || "Not specified"),
      requested_date: validDateOnly(lead.preferred_event_date),
    }))
    .filter((lead) => lead.requested_date && lead.requested_date >= today && lead.requested_date <= attentionLimit)
    .sort((a, b) => String(a.requested_date).localeCompare(String(b.requested_date)));

  return {
    available: true,
    window_days: 30,
    inquiries: realLeads.length,
    new_inquiries_24h: realLeads.filter((lead) => {
      const createdAt = Date.parse(String(lead.created_at || ""));
      return Number.isFinite(createdAt) && createdAt >= cutoff24h;
    }).length,
    date_requests: realLeads.filter((lead) => validDateOnly(lead.preferred_event_date)).length,
    qualified_inquiries: realLeads.filter((lead) => Number(lead.lead_score || 0) >= 60).length,
    confirmed_bookings: bookings.filter((booking) =>
      Boolean(booking.lead_id && leadIds.has(booking.lead_id)) && COMPLETED_BOOKING_STATUSES.has(String(booking.status || ""))
    ).length,
    strongest_occasion: occasions[0] || null,
    strongest_landing_page: landingPages[0] || null,
    upcoming_date_requests: upcomingDateRequests.slice(0, 5),
  };
}
