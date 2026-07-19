import BookingScheduler from "@/components/BookingScheduler";

export const metadata = {
  title: "Book a Planning Call | Teamtastic",
  description: "Choose a convenient time for a quick Teamtastic event-planning call.",
  robots: { index: false, follow: false },
};

export default function BookPage() {
  const fallbackUrl = process.env.NEXT_PUBLIC_CALENDLY_URL || "https://calendly.com/teamtastic-events/15min";
  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-14 text-white sm:px-6 sm:py-20">
      <div className="mx-auto max-w-5xl">
        <div className="mb-10 max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-pink-400">Teamtastic planning call</p>
          <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-6xl">Pick a time. We’ll bring the game plan.</h1>
          <p className="mt-5 text-lg leading-relaxed text-zinc-300">
            Fifteen focused minutes to talk about your team, your timing, and the kind of experience people will still be talking about afterward.
          </p>
        </div>
        <BookingScheduler fallbackUrl={fallbackUrl} />
      </div>
    </main>
  );
}
