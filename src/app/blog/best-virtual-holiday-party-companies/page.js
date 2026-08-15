import Link from "next/link";
import { ArrowRight, Calendar, Clock, User } from "lucide-react";

export const metadata = {
  title: "Best Virtual Holiday Party Companies for Work | Teamtastic",
  description:
    "Compare the main types of virtual holiday party companies for work, including hosted game shows, activity marketplaces, trivia providers, and DIY platforms.",
  alternates: {
    canonical: "https://teamtastic.events/blog/best-virtual-holiday-party-companies",
  },
  openGraph: {
    title: "Best Virtual Holiday Party Companies for Work",
    description: "A practical buyer guide for choosing a virtual holiday party provider.",
    url: "https://teamtastic.events/blog/best-virtual-holiday-party-companies",
  },
};

const providerTypes = [
  ["Hosted game show companies", "Best for companies that want one high-energy event with a live host, scoring, music, custom trivia, and a clear finish."],
  ["Trivia specialists", "Best when your team already likes trivia and you want custom holiday, company, or year-in-review questions."],
  ["Virtual activity marketplaces", "Best when you want to compare cooking, crafts, tastings, comedy, magic, or wellness experiences in one catalog."],
  ["Escape room providers", "Best for puzzle-heavy groups that prefer collaboration and problem solving over holiday small talk."],
  ["DIY game platforms", "Best for smaller teams with an internal organizer who is comfortable running the room."],
];

const faqs = [
  {
    q: "What should I look for in a virtual holiday party company?",
    a: "Look for clear hosting, simple joining, strong pacing, customization options, inclusive holiday language, platform compatibility, and transparent pricing for your group size.",
  },
  {
    q: "Are hosted virtual holiday parties worth it?",
    a: "Hosted events are worth it when the party is company-wide, leadership-facing, or important enough that you do not want an internal organizer managing rules, scoring, and awkward transitions.",
  },
  {
    q: "What type of virtual holiday party company is best for remote teams?",
    a: "For most remote teams, a hosted game show company is the safest fit because it creates structure, competition, laughter, and a clean event arc inside a normal video call.",
  },
];

export default function BestVirtualHolidayPartyCompanies() {
  return (
    <main className="flex flex-col min-h-screen bg-brand-dark">
      <article className="py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 text-xs text-zinc-500 mb-8">
            <Link href="/blog" className="hover:text-zinc-300 transition-colors">Blog</Link>
            <span>/</span>
            <span className="text-zinc-400">Virtual Holiday Party Companies</span>
          </div>

          <span className="inline-flex mb-6 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border text-purple-400 border-purple-500/30 bg-purple-500/10">
            Buyer Guide
          </span>

          <h1 className="text-3xl sm:text-5xl font-extrabold text-white leading-tight mb-6">
            Best Virtual Holiday Party Companies for Work
          </h1>

          <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500 mb-10 border-b border-white/5 pb-8">
            <span className="flex items-center gap-1.5"><User className="h-3.5 w-3.5" /> Teamtastic Events Team</span>
            <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> July 30, 2026</span>
            <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> 8 min read</span>
          </div>

          <div className="space-y-5 text-zinc-400 leading-relaxed mb-12">
            <p className="text-lg text-zinc-300">
              The best virtual holiday party company depends on what you need the event to do. Some providers sell catalogs of activities. Others specialize in hosted games, trivia, puzzles, or DIY tools.
            </p>
            <p>
              For work teams, the main decision is whether you want a planner-friendly event that runs itself with a host, or a lower-cost format your internal team manages.
            </p>
          </div>

          <section className="space-y-4 mb-14">
            {providerTypes.map(([title, desc], index) => (
              <div key={title} className="glassmorphism rounded-2xl p-5 border border-white/5 flex gap-5">
                <span className="text-2xl font-extrabold text-purple-500/30 shrink-0 w-8">{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <h2 className="font-bold text-white mb-1">{title}</h2>
                  <p className="text-sm text-zinc-400">{desc}</p>
                </div>
              </div>
            ))}
          </section>

          <section className="space-y-4 mb-14">
            <h2 className="text-2xl font-extrabold text-white">Recommendation for Most Companies</h2>
            <p className="text-zinc-400">
              If you are planning for HR, People Ops, an executive team, or a distributed department, prioritize a provider with live facilitation. The host is what turns a video meeting into an actual party.
            </p>
            <p className="text-zinc-400">
              Teamtastic fits the hosted game show category: custom trivia, Survey Showdown, music rounds, year-in-review prompts, browser-based play, and a live emcee.
            </p>
          </section>

          <section className="glassmorphism rounded-2xl p-8 border border-purple-500/20 bg-purple-500/5 mb-14">
            <h2 className="text-2xl font-extrabold text-white mb-3">Want the Hosted Game Show Option?</h2>
            <p className="text-zinc-400 mb-6">
              Teamtastic runs virtual holiday parties for work teams on Zoom, Teams, Meet, or Webex. December dates are limited, and a deposit can lock your preferred slot.
            </p>
            <Link href="/virtual-holiday-party" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 transition-all">
              Compare Holiday Party Options <ArrowRight className="h-4 w-4" />
            </Link>
          </section>

          <section className="space-y-5">
            <h2 className="text-2xl font-extrabold text-white">FAQ</h2>
            {faqs.map((faq) => (
              <div key={faq.q} className="border-t border-white/5 pt-5">
                <h3 className="font-bold text-white mb-2">{faq.q}</h3>
                <p className="text-sm text-zinc-400">{faq.a}</p>
              </div>
            ))}
          </section>
        </div>
      </article>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faqs.map((faq) => ({
              "@type": "Question",
              name: faq.q,
              acceptedAnswer: { "@type": "Answer", text: faq.a },
            })),
          }),
        }}
      />
    </main>
  );
}
