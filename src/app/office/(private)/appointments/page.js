import Link from "next/link";
import { getOfficeDb } from "@/lib/server/office-auth";
import { dateInTimeZone, zonedDayRangeUtc } from "@/lib/server/booking-time";
import { ProspectLink, formatDate } from "../../office-ui";
import { loadLiveRecordFilter } from "@/lib/server/office/live-records";

const STATUSES = ["held", "confirmed", "completed", "cancelled", "rescheduled", "no_show", "expired", "failed"];
const STATUS_TONE = {
  held: "bg-amber-500/15 text-amber-300",
  confirmed: "bg-sky-500/15 text-sky-300",
  completed: "bg-emerald-500/15 text-emerald-300",
  cancelled: "bg-red-500/15 text-red-300",
  rescheduled: "bg-amber-500/15 text-amber-300",
  no_show: "bg-red-500/15 text-red-300",
  expired: "bg-white/5 text-slate-400",
  failed: "bg-red-500/15 text-red-300",
};
const TIMEFRAMES = { upcoming: "Upcoming", today: "Today", past: "Past", all: "All" };
const SORTS = { date: "starts_at", status: "status", client: "name", source: "source" };

function buildHref(params, changes) {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...params, ...changes })) if (value) next.set(key, value);
  return `/office/appointments?${next.toString()}`;
}

function SortHeading({ label, column, sort, direction, params }) {
  const active = sort === column;
  const nextDirection = active && direction === "asc" ? "desc" : "asc";
  return (
    <th className="p-4" aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}>
      <Link href={buildHref(params, { sort: column, direction: nextDirection })} className="inline-flex items-center gap-1 rounded text-slate-300 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400">
        {label} <span aria-hidden="true" className={active ? "text-purple-300" : "text-slate-600"}>{active ? (direction === "asc" ? "↑" : "↓") : "↕"}</span>
      </Link>
    </th>
  );
}

export default async function AppointmentsPage({ searchParams }) {
  const params = await searchParams;
  const timeframe = Object.hasOwn(TIMEFRAMES, params?.timeframe) ? params.timeframe : "upcoming";
  const status = STATUSES.includes(params?.status) ? params.status : "";
  const search = String(params?.q || "").trim().slice(0, 100);
  const sort = Object.hasOwn(SORTS, params?.sort) ? params.sort : "date";
  const direction = ["asc", "desc"].includes(params?.direction) ? params.direction : (["upcoming", "today"].includes(timeframe) ? "asc" : "desc");
  const db = (await getOfficeDb()).db;
  const nowDate = new Date();
  const now = nowDate.toISOString();
  const easternDate = dateInTimeZone(nowDate, "America/New_York");
  const [todayStart, todayEnd] = zonedDayRangeUtc(easternDate, "America/New_York").map((date) => date.toISOString());

  let query = db.from("bookings").select("id,prospect_id,booking_type_id,name,email,company,starts_at,ends_at,status,zoom_join_url,source,created_at").limit(200);
  if (timeframe === "upcoming") query = query.gte("starts_at", now);
  else if (timeframe === "today") query = query.gte("starts_at", todayStart).lt("starts_at", todayEnd);
  else if (timeframe === "past") query = query.lt("starts_at", now);
  if (status) query = query.eq("status", status);
  if (search) {
    const safe = search.replace(/[,()%]/g, " ");
    query = query.or(`name.ilike.%${safe}%,email.ilike.%${safe}%,company.ilike.%${safe}%`);
  }

  query = query.order(SORTS[sort], { ascending: direction === "asc", nullsFirst: false });

  const [{ data: rawBookings = [], error }, liveRecords] = await Promise.all([
    query,
    loadLiveRecordFilter(db, ["booking"]),
  ]);
  const bookings = liveRecords.ready ? rawBookings.filter((booking) => liveRecords.isLiveRecord("booking", booking)) : [];
  const typeIds = [...new Set(bookings.map((b) => b.booking_type_id).filter(Boolean))];
  const { data: bookingTypes = [] } = typeIds.length ? await db.from("booking_types").select("id,name").in("id", typeIds) : { data: [] };
  const typeNames = new Map(bookingTypes.map((t) => [t.id, t.name]));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-purple-300">Sales calendar</p>
        <h2 className="mt-1 text-3xl font-bold sm:text-4xl">Appointments</h2>
        <p className="mt-2 text-slate-400">Every live customer call in one searchable, sortable list. Times display in Eastern time.</p>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        {Object.entries(TIMEFRAMES).map(([value, label]) => (
          <Link key={value} href={buildHref({ status, q: search, sort, direction }, { timeframe: value })} className={`rounded-full border px-4 py-2 ${timeframe === value ? "border-purple-400 bg-purple-500/15 text-purple-200" : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"}`}>{label}</Link>
        ))}
      </div>

      <form className="grid gap-3 rounded-2xl border border-white/10 bg-slate-900/65 p-4 sm:grid-cols-[minmax(220px,1fr)_190px_auto]">
        <input type="hidden" name="timeframe" value={timeframe} />
        <input type="hidden" name="sort" value={sort} />
        <input type="hidden" name="direction" value={direction} />
        <input name="q" defaultValue={search} placeholder="Search client, email, or company" className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 outline-none focus:border-purple-400" />
        <select name="status" defaultValue={status} className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3"><option value="">All statuses</option>{STATUSES.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</select>
        <button className="rounded-xl bg-purple-600 px-5 py-3 font-semibold hover:bg-purple-500">Search</button>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-400">
        <p>{error || !liveRecords.ready ? "The live appointment list could not be verified." : `${bookings.length} appointment${bookings.length === 1 ? "" : "s"}`}{rawBookings.length === 200 ? " · showing the first 200 matches" : ""}</p>
        <p className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">Clean-start view · test records hidden</p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/65">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-white/10 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <SortHeading label="Date & time" column="date" sort={sort} direction={direction} params={{ timeframe, status, q: search }} />
              <th className="p-4">Type</th>
              <SortHeading label="Status" column="status" sort={sort} direction={direction} params={{ timeframe, status, q: search }} />
              <SortHeading label="Client" column="client" sort={sort} direction={direction} params={{ timeframe, status, q: search }} />
              <th className="p-4">Zoom</th>
              <SortHeading label="Source" column="source" sort={sort} direction={direction} params={{ timeframe, status, q: search }} />
            </tr>
          </thead>
          <tbody>
            {bookings.map((booking) => (
              <tr key={booking.id} className="border-b border-white/5 hover:bg-white/[0.03]">
                <td className="p-4 whitespace-nowrap">{formatDate(booking.starts_at)}</td>
                <td className="p-4 text-slate-300">{typeNames.get(booking.booking_type_id) || "Call"}</td>
                <td className="p-4"><span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${STATUS_TONE[booking.status] || "bg-white/5 text-slate-300"}`}>{booking.status.replaceAll("_", " ")}</span></td>
                <td className="p-4"><ProspectLink id={booking.prospect_id} name={booking.name} email={booking.email} />{booking.company && <p className="text-slate-500">{booking.company}</p>}</td>
                <td className="p-4">{booking.zoom_join_url ? <a className="font-medium text-sky-300 hover:text-sky-200" href={booking.zoom_join_url} target="_blank" rel="noreferrer">Join Zoom</a> : <span className="text-slate-500">—</span>}</td>
                <td className="p-4 text-slate-400">{booking.source || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!bookings.length && <p className="p-8 text-center text-slate-400">No appointments match those filters.</p>}
      </div>
    </div>
  );
}
