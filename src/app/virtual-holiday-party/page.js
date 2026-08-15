import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle,
  Gift,
  Music,
  PartyPopper,
  ShieldCheck,
  Snowflake,
  Sparkles,
  Trophy,
  Users,
  Clock3,
  CreditCard,
} from "lucide-react";
import CorporateLeadForm from "@/components/CorporateLeadForm";
import HolidayChecklistForm from "@/components/HolidayChecklistForm";
import { HOLIDAY_CAMPAIGN, holidayOfferCopy } from "@/lib/holiday-campaign";

export const revalidate = 3600;

export const metadata = {
  title: "Virtual Holiday Party for Work | Hosted Online Holiday Games | Teamtastic",
  description:
    "Book a live-hosted virtual holiday party for remote and hybrid teams. Custom trivia, Name That Holiday Tune, Survey Showdown, winter games, and no downloads.",
  alternates: {
    canonical: "https://teamtastic.events/virtual-holiday-party",
  },
  openGraph: {
    title: "The Virtual Holiday Party Your Remote Team Will Actually Show Up For",
    description:
      "Live-hosted online holiday party games for work, with custom trivia, music rounds, Survey Showdown, and a $200 date-hold deposit.",
    url: "https://teamtastic.events/virtual-holiday-party",
  },
};

const formats = [
  {
    title: "Holiday Trivia Spectacular",
    desc: "Company trivia, year-in-review questions, holiday movie clues, and fast team scoring.",
    icon: Trophy,
    color: "border-amber-500/30 bg-amber-500/5 text-amber-300",
  },
  {
    title: "Name That Holiday Tune",
    desc: "Short music clips, jingles, movie scores, and festive audio rounds that wake up the room.",
    icon: Music,
    color: "border-sky-500/30 bg-sky-500/5 text-sky-300",
  },
  {
    title: "White Elephant-Style Games",
    desc: "Gift guessing, playful swaps, mystery prompts, and opt-in surprises without shipping chaos.",
    icon: Gift,
    color: "border-rose-500/30 bg-rose-500/5 text-rose-300",
  },
  {
    title: "Winter Escape Room",
    desc: "Collaborative clues and team puzzle rounds for groups that like problem solving more than small talk.",
    icon: Snowflake,
    color: "border-emerald-500/30 bg-emerald-500/5 text-emerald-300",
  },
];

const baseReasons = [
  "Live emcee keeps the room moving, not awkward",
  "Works on Zoom, Microsoft Teams, Google Meet, and Webex",
  "Players join in-browser with no downloads",
  "Custom company questions, inside jokes, team names, and awards",
  "$200 deposit locks your date while you finalize details",
];

const campaignHeadlines = {
  "people-ops": "The Virtual Holiday Party Your Remote Team Will Actually Show Up For",
  "large-teams": "A Virtual Holiday Game Show Built to Engage the Whole Company",
  "year-end": "Turn Your Year-End Celebration Into a Live Team Game Show",
};

const faqs = [
  {
    q: "How far in advance should we book a virtual holiday party?",
    a: "For December events, book as early as possible. Early-to-mid December dates are limited because live-hosted events depend on emcee availability. A $200 deposit reserves your preferred date while the rest of the details are finalized.",
  },
  {
    q: "What does the early-bird holiday offer include?",
    a: "The current early-bird offer includes a free custom company-trivia round and first pick of available December dates. The active booking deadline is shown next to the availability form.",
  },
  {
    q: "How long is a Teamtastic virtual holiday party?",
    a: "Most holiday events run 45 to 75 minutes. We can also design a shorter kickoff game or a longer company celebration with multiple rounds.",
  },
  {
    q: "Can the games be customized for our company?",
    a: "Yes. Holiday events can include company trivia, year-in-review questions, team shoutouts, custom awards, brand colors, and inside jokes.",
  },
  {
    q: "Do employees need to download anything?",
    a: "No. Teamtastic works in the browser alongside your video platform, including Zoom, Microsoft Teams, Google Meet, and Webex.",
  },
  {
    q: "Is this inclusive for global or mixed-holiday teams?",
    a: "Yes. We can make the event holiday-specific, winter-themed, year-end themed, or fully company-celebration focused depending on your team.",
  },
];

export default async function VirtualHolidayParty({ searchParams }) {
  const params = await searchParams;
  const headline = campaignHeadlines[params?.utm_content] || campaignHeadlines[params?.utm_campaign] || campaignHeadlines["people-ops"];
  const offer = holidayOfferCopy();
  const reasons = [...baseReasons, offer.reason];
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "Service",
      name: "Virtual Holiday Party for Work",
      serviceType: "Live-hosted virtual holiday party games",
      provider: { "@type": "Organization", name: "Teamtastic", url: "https://teamtastic.events" },
      areaServed: "Worldwide",
      offers: {
        "@type": "Offer",
        price: "35",
        priceCurrency: "USD",
        description: "$35 per person with a $350 minimum. A $200 deposit reserves your date.",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((faq) => ({
        "@type": "Question",
        name: faq.q,
        acceptedAnswer: { "@type": "Answer", text: faq.a },
      })),
    },
  ];

  return (
    <main className="min-h-screen bg-brand-dark text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
      />

      <section className="relative overflow-hidden pt-24 pb-16 md:pt-32 md:pb-20">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_rgba(190,24,93,0.22),_rgba(3,7,18,0.98)_58%,_#030712_100%)]" />
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-12 lg:px-8">
          <div className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-amber-200">
              <CalendarDays className="h-4 w-4" />
              {HOLIDAY_CAMPAIGN.availabilityMessage}
            </div>

            <h1 className="mt-6 max-w-3xl text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-6xl">
              {headline}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-zinc-300">
              A live-hosted online holiday game show with custom trivia, festive music rounds, Survey Showdown, and just enough competition to make the end of year feel like a real celebration.
            </p>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <Link
                href="#holiday-availability"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#D81B60] px-7 text-sm font-bold text-white shadow-[0_0_28px_rgba(216,27,96,0.35)] transition hover:bg-pink-600"
              >
                Plan my holiday party <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/blog/virtual-holiday-party-games"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-7 text-sm font-bold text-zinc-100 transition hover:bg-white/10"
              >
                See holiday game ideas
              </Link>
            </div>

            <div className="mt-6 flex flex-wrap gap-3 text-xs font-semibold text-zinc-300">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">$35/person</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">$350 minimum</span>
              <span className="rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1.5 text-amber-200">$200 reserves your date</span>
            </div>
          </div>

          <div className="lg:col-span-5" id="holiday-availability">
            <CorporateLeadForm
              source="holiday_party_money_page"
              entryPoint="virtual_holiday_party_inline"
              eyebrow="Holiday availability"
              title="Check December dates"
              subtitle={`${offer.short} + first pick of December dates`}
              successTitle="Your holiday party request is saved."
              successBody="Michael will confirm available December dates and the best-fit holiday format. You can lock the date now with a $200 deposit."
              submitLabel="Check holiday availability"
              depositLabel="Lock my date with $200"
              defaultOccasion="holiday"
              holidayQualification
            />
          </div>
        </div>
      </section>

      <section className="border-y border-white/5 bg-zinc-950/50 py-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-8 gap-y-3 px-4 text-sm font-semibold text-zinc-300 sm:px-6 lg:px-8">
          <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-300" /> Zoom</span>
          <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-300" /> Microsoft Teams</span>
          <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-300" /> Google Meet</span>
          <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-300" /> Webex</span>
          <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-300" /> No downloads</span>
        </div>
      </section>

      <section className="py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto mb-12 max-w-3xl text-center">
            <span className="text-xs font-black uppercase tracking-[0.2em] text-brand-pink">Holiday formats</span>
            <h2 className="mt-3 text-3xl font-extrabold text-white sm:text-5xl">Pick the party format. We run the show.</h2>
            <p className="mt-4 text-zinc-400">Choose one signature format or combine a few into a full hosted holiday game show.</p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {formats.map(({ title, desc, icon: Icon, color }) => (
              <div key={title} className={`rounded-2xl border p-6 ${color}`}>
                <Icon className="h-8 w-8" />
                <h3 className="mt-5 text-lg font-bold text-white">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-white/5 bg-zinc-950/50 py-16">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div>
            <span className="text-xs font-black uppercase tracking-[0.2em] text-amber-300">Early-bird advantage</span>
            <h2 className="mt-3 text-3xl font-extrabold text-white sm:text-5xl">Book before the rush starts.</h2>
            <p className="mt-4 text-zinc-300">
              Planning early gives you the best choice of dates. A $200 deposit starts the date-hold process, and {offer.active ? <>teams that book by {offer.deadlineLabel} receive {HOLIDAY_CAMPAIGN.bonus}.</> : <>you can ask about current seasonal customization bonuses.</>}
            </p>
            <Link
              href="#holiday-availability"
              className="mt-7 inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#D81B60] px-7 text-sm font-bold text-white transition hover:bg-pink-600"
            >
              Hold a December date <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
            <h3 className="text-xl font-extrabold text-white">What your team gets</h3>
            <ul className="mt-6 space-y-4">
              {reasons.map((reason) => (
                <li key={reason} className="flex gap-3 text-sm leading-relaxed text-zinc-300">
                  <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <span className="text-xs font-black uppercase tracking-[0.2em] text-sky-300">A clear 60-minute show</span>
            <h2 className="mt-3 text-3xl font-extrabold text-white sm:text-5xl">A complete party—with no awkward dead time.</h2>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-6">
            {[
              ["0–5", "Welcome + team setup"], ["5–15", "Holiday warm-up"], ["15–30", "Company trivia"],
              ["30–42", "Survey or music round"], ["42–52", "Team challenge"], ["52–60", "Final scores + awards"],
            ].map(([time, label]) => (
              <div key={time} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <p className="text-sm font-black text-brand-pink">{time} min</p><p className="mt-2 text-sm font-semibold text-zinc-200">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-white/5 bg-zinc-950/50 py-16">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div className="rounded-3xl border border-amber-400/20 bg-amber-400/5 p-7 sm:p-9">
            <p className="text-amber-300">★★★★★</p>
            <blockquote className="mt-4 text-xl font-bold leading-relaxed text-white">“Michael kept 80 people laughing and engaged the entire time. It wasn’t just a game—it was an experience.”</blockquote>
            <p className="mt-4 text-sm text-zinc-400">Verified organizer · 80-person corporate event</p>
          </div>
          <div className="rounded-3xl border border-purple-400/20 bg-purple-400/5 p-7 sm:p-9">
            <p className="text-purple-300">Pittsburgh Public Schools</p>
            <blockquote className="mt-4 text-xl font-bold leading-relaxed text-white">“The energy was AMAZING! Everyone was engaged and involved.”</blockquote>
            <p className="mt-4 text-sm text-zinc-400">Leah McCord · Principal</p>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-7 sm:p-9">
            <CreditCard className="h-8 w-8 text-emerald-300" />
            <h2 className="mt-5 text-2xl font-extrabold text-white">What happens after the $200 deposit?</h2>
            <ol className="mt-6 space-y-4 text-sm text-zinc-300">
              <li><strong className="text-white">1. We confirm your date.</strong> Michael checks your requested date, time zone, and event format.</li>
              <li><strong className="text-white">2. You finalize the experience.</strong> We confirm headcount, games, customization, and the run of show.</li>
              <li><strong className="text-white">3. The deposit applies to your event.</strong> Your remaining balance follows the approved event plan.</li>
              <li><strong className="text-white">4. Your portal keeps everything together.</strong> Event details and game preparation carry into the Teamtastic client experience.</li>
            </ol>
            <div className="mt-6 flex items-center gap-2 text-xs text-zinc-500"><Clock3 className="h-4 w-4" /> Date requests are reviewed before availability is promised.</div>
          </div>
          <HolidayChecklistForm />
        </div>
      </section>

      <section className="py-16 md:py-24">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:px-6 lg:grid-cols-3 lg:px-8">
          <div className="lg:col-span-1">
            <span className="text-xs font-black uppercase tracking-[0.2em] text-brand-purple">Planning checklist</span>
            <h2 className="mt-3 text-3xl font-extrabold text-white">Steal the easy holiday party checklist.</h2>
            <p className="mt-4 text-zinc-400">
              Use this as your planning framework now, then send the form when you want availability and exact pricing.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2">
            {[
              "Pick 2-3 target dates before leadership asks",
              "Decide inclusive holiday, winter, or year-end theme",
              "Collect 8-12 company trivia prompts",
              "Choose prizes, awards, or bragging rights",
              "Confirm Zoom, Teams, Meet, or Webex link",
              "Reserve your live host before December fills",
            ].map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm font-semibold text-zinc-200">
                <Sparkles className="mb-4 h-5 w-5 text-amber-300" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-white/5 bg-zinc-950/50 py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <PartyPopper className="mx-auto h-10 w-10 text-brand-pink" />
            <h2 className="mt-4 text-3xl font-extrabold text-white">Virtual holiday party FAQ</h2>
          </div>
          <div className="mt-10 space-y-5">
            {faqs.map((faq) => (
              <div key={faq.q} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                <h3 className="font-bold text-white">{faq.q}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">{faq.a}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Link
              href="#holiday-availability"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#D81B60] px-7 text-sm font-bold text-white transition hover:bg-pink-600"
            >
              Plan my holiday party <Users className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
