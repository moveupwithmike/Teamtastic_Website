import { FAMILY_OCCASIONS } from "@/lib/family-demand";

const PRIVATE_AUDIENCES = new Set(["family", "friends", "other_private_event"]);

export const FAMILY_REPORT_PAGES = [
  ...Object.values(FAMILY_OCCASIONS).map(({ slug, title }) => ({ path: `/${slug}`, title })),
  { path: "/family-trivia-starter", title: "Custom Family Trivia Starter" },
];

const PAGE_TITLES = new Map(FAMILY_REPORT_PAGES.map((page) => [page.path, page.title]));

function number(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function pathOnly(value) {
  if (!value) return "";
  try {
    const path = value.startsWith("http") ? new URL(value).pathname : value.split(/[?#]/)[0];
    return path.length > 1 ? path.replace(/\/$/, "") : path;
  } catch {
    return "";
  }
}

export function buildFamilyDemandReport({ campaigns = [], leads = [], bookings = [], days = 30 } = {}) {
  const tracked = new Set(FAMILY_REPORT_PAGES.map((page) => page.path));
  const pageRows = new Map(FAMILY_REPORT_PAGES.map((page) => [page.path, {
    landing_page: page.path,
    title: page.title,
    visitors: 0,
    engaged_visitors: 0,
    leads: 0,
    date_requests: 0,
    qualified_leads: 0,
    bookings: 0,
    revenue: 0,
  }]));

  for (const campaign of campaigns) {
    const path = pathOnly(campaign.landing_page);
    if (!tracked.has(path)) continue;
    const row = pageRows.get(path);
    row.visitors += number(campaign.visitors);
    row.engaged_visitors += number(campaign.engaged_visitors);
    row.revenue += number(campaign.revenue);
  }

  const familyLeads = leads.filter((lead) => PRIVATE_AUDIENCES.has(lead.audience_type));
  const familyLeadIds = new Set(familyLeads.map((lead) => lead.id));
  const occasionCounts = new Map();
  let attributedLeads = 0;
  let dateRequests = 0;
  let qualifiedLeads = 0;

  for (const lead of familyLeads) {
    const path = pathOnly(lead.landing_page);
    const row = pageRows.get(path);
    const qualified = number(lead.lead_score) >= 60;
    if (lead.preferred_event_date) dateRequests += 1;
    if (qualified) qualifiedLeads += 1;
    if (row) {
      attributedLeads += 1;
      row.leads += 1;
      if (lead.preferred_event_date) row.date_requests += 1;
      if (qualified) row.qualified_leads += 1;
    }
    const occasion = String(lead.occasion || "Not specified").trim() || "Not specified";
    occasionCounts.set(occasion, (occasionCounts.get(occasion) || 0) + 1);
  }

  const completedBookings = bookings.filter((booking) => familyLeadIds.has(booking.lead_id) && ["confirmed", "completed", "rescheduled"].includes(booking.status));
  for (const booking of completedBookings) {
    const lead = familyLeads.find((item) => item.id === booking.lead_id);
    const row = pageRows.get(pathOnly(lead?.landing_page));
    if (row) row.bookings += 1;
  }

  const pages = [...pageRows.values()].map((row) => ({
    ...row,
    visitor_to_lead_rate: row.visitors ? Number((row.leads / row.visitors).toFixed(4)) : null,
  })).sort((a, b) => b.leads - a.leads || b.visitors - a.visitors || a.title.localeCompare(b.title));
  const visitors = pages.reduce((sum, row) => sum + row.visitors, 0);
  const engagedVisitors = pages.reduce((sum, row) => sum + row.engaged_visitors, 0);
  const revenue = pages.reduce((sum, row) => sum + row.revenue, 0);

  return {
    days,
    summary: {
      visitors,
      engaged_visitors: engagedVisitors,
      leads: familyLeads.length,
      attributed_leads: attributedLeads,
      unattributed_leads: familyLeads.length - attributedLeads,
      date_requests: dateRequests,
      qualified_leads: qualifiedLeads,
      bookings: completedBookings.length,
      revenue,
      visitor_to_lead_rate: visitors ? Number((attributedLeads / visitors).toFixed(4)) : null,
    },
    pages,
    occasions: [...occasionCounts.entries()].map(([occasion, count]) => ({ occasion, count })).sort((a, b) => b.count - a.count || a.occasion.localeCompare(b.occasion)),
    tracked_pages: FAMILY_REPORT_PAGES.map((page) => ({ ...page, title: PAGE_TITLES.get(page.path) })),
  };
}
