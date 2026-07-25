import { createHash } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import BookingManage from "@/components/BookingManage";
import { resolveManagedBooking } from "@/lib/server/booking-manage";

export const metadata = {
  title: "Manage your booking | Teamtastic",
  robots: { index: false, follow: false },
};

function Shell({ children }) {
  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-14 text-white sm:px-6 sm:py-20">
      <div className="mx-auto max-w-2xl">{children}</div>
    </main>
  );
}

export default async function ManageBookingPage({ params }) {
  const { token } = await params;
  const tokenHash = createHash("sha256").update(String(token || "")).digest("hex");
  const supabase = getSupabaseAdmin();

  const { booking } = await resolveManagedBooking(
    supabase,
    tokenHash,
    "id,name,email,visitor_timezone,starts_at,ends_at,status,zoom_join_url,rescheduled_to_id,booking_types(name,slug,duration_minutes)",
  );

  if (!booking) {
    return (
      <Shell>
        <h1 className="text-2xl font-black">This link isn&rsquo;t valid.</h1>
        <p className="mt-3 text-zinc-400">Double-check the link from your email, or reach out to hello@teamtastic.events.</p>
      </Shell>
    );
  }

  const bookingType = Array.isArray(booking.booking_types) ? booking.booking_types[0] : booking.booking_types;
  const whenText = new Intl.DateTimeFormat("en-US", {
    timeZone: booking.visitor_timezone, dateStyle: "full", timeStyle: "short",
  }).format(new Date(booking.starts_at));

  if (booking.status === "cancelled") {
    return (
      <Shell>
        <h1 className="text-2xl font-black">This booking has been canceled.</h1>
        <p className="mt-3 text-zinc-400">Want to find a new time? <a className="text-pink-300" href="/book">Book here</a>.</p>
      </Shell>
    );
  }
  if (booking.status === "rescheduled") {
    return (
      <Shell>
        <h1 className="text-2xl font-black">This booking was rescheduled.</h1>
        <p className="mt-3 text-zinc-400">
          Check your email for the new confirmation, or <a className="text-pink-300" href="/book">book a new time</a>.
        </p>
      </Shell>
    );
  }
  if (booking.status !== "confirmed" || new Date(booking.starts_at) <= new Date()) {
    return (
      <Shell>
        <h1 className="text-2xl font-black">This call has already happened.</h1>
        <p className="mt-3 text-zinc-400">Need something else? <a className="text-pink-300" href="/book">Book a new call</a>.</p>
      </Shell>
    );
  }

  return (
    <Shell>
      <p className="text-xs font-black uppercase tracking-[0.22em] text-pink-400">Manage your booking</p>
      <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">{bookingType?.name || "Your call"} with Teamtastic</h1>
      <p className="mt-3 text-lg text-zinc-300">{whenText} ({booking.visitor_timezone.replaceAll("_", " ")})</p>
      {booking.zoom_join_url && <a href={booking.zoom_join_url} className="mt-2 inline-block text-sm font-bold text-pink-300 hover:text-pink-200">Zoom join link</a>}
      <BookingManage
        token={token}
        bookingTypeSlug={bookingType?.slug}
        visitorTimezone={booking.visitor_timezone}
      />
    </Shell>
  );
}
