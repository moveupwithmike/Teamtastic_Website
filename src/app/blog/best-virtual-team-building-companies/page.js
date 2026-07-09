import Link from "next/link";
import { ArrowRight, Calendar, Clock, User } from "lucide-react";

export const metadata = {
  title: "Best Virtual Team Building Companies: How to Choose the Right Fit | Teamtastic",
  description:
    "Compare the main types of virtual team building companies and learn how to choose the best option for remote teams, HR events, onboarding, and company celebrations.",
  alternates: {
    canonical: "https://teamtastic.events/blog/best-virtual-team-building-companies",
  },
  openGraph: {
    title: "Best Virtual Team Building Companies",
    description: "A practical buyer guide for choosing a virtual team building company.",
    url: "https://teamtastic.events/blog/best-virtual-team-building-companies",
  },
};

const companyTypes = [
  {
    title: "Live-hosted game show companies",
    bestFor: "High-energy events, holiday parties, onboarding cohorts, and team celebrations.",
    lookFor: "A confident host, custom questions, visible scoring, easy joining, and games that work for shy and outgoing employees.",
  },
  {
    title: "Self-service game platforms",
    bestFor: "Recurring team rituals, smaller teams, manager-led events, and lower-budget activities.",
    lookFor: "Browser-based play, simple setup, clear instructions, and game modes that do not require a professional facilitator.",
  },
  {
    title: "Virtual escape room providers",
    bestFor: "Puzzle-heavy groups, engineering teams, cross-functional problem solving, and smaller breakout groups.",
    lookFor: "Good pacing, accessible clues, breakout support, and a facilitator who prevents teams from getting stuck too long.",
  },
  {
    title: "Trivia specialists",
    bestFor: "Custom trivia nights, company culture events, fundraisers, and teams that love knowledge-based competition.",
    lookFor: "Custom writing, balanced categories, fast scoring, and questions that do not punish non-US or non-pop-culture participants.",
  },
  {
    title: "Workshop and experience marketplaces",
    bestFor: "Teams that want cooking, wellness, art, magic, tasting kits, or speaker-led sessions.",
    lookFor: "Strong logistics, shipping support, clear cancellation terms, and hosts who can manage remote attention.",
  },
];

const faqs = [
  {
    q: "What should I look for in a virtual team building company?",
    a: "Look for easy joining, clear facilitation, inclusive game design, customization, strong support, and formats that match your team size and energy level.",
  },
  {
    q: "Are hosted virtual team building events worth it?",
    a: "Hosted events are worth it when the event is high-stakes, large, or meant to feel special. A good host removes awkwardness and keeps the pace moving.",
  },
  {
    q: "What is the best virtual team building company for remote teams?",
    a: "The best company depends on the job. Game show platforms fit high-energy connection, escape rooms fit puzzle-solving, and workshop marketplaces fit slower shared experiences.",
  },
];

export default function BestVirtualTeamBuildingCompanies() {
  return (
    <main className="flex flex-col min-h-screen bg-brand-dark">
      <article className="py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 text-xs text-zinc-500 mb-8">
            <Link href="/blog" className="hover:text-zinc-300 transition-colors">Blog</Link>
            <span>/</span>
            <span className="text-zinc-400">Best Virtual Team Building Companies</span>
          </div>

          <span className="inline-flex mb-6 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border text-purple-400 border-purple-500/30 bg-purple-500/10">
            Buyer Guide
          </span>

          <h1 className="text-3xl sm:text-5xl font-extrabold text-white leading-tight mb-6">
            Best Virtual Team Building Companies: How to Choose the Right Fit
          </h1>

          <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500 mb-10 border-b border-white/5 pb-8">
            <span className="flex items-center gap-1.5"><User className="h-3.5 w-3.5" /> Teamtastic Events Team</span>
            <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> July 9, 2026</span>
            <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> 8 min read</span>
          </div>

          <div className="space-y-5 text-zinc-400 leading-relaxed mb-12">
            <p className="text-lg text-zinc-300">
              The best virtual team building company is not always the one with the biggest catalog. It is the one that fits your event goal, team size, budget, and tolerance for planning.
            </p>
            <p>
              Use this guide to choose the right type of provider before you compare prices or book a demo.
            </p>
          </div>

          <section className="space-y-4 mb-14">
            {companyTypes.map((type, index) => (
              <div key={type.title} className="glassmorphism rounded-2xl p-6 border border-white/5">
                <div className="flex gap-5">
                  <span className="text-2xl font-extrabold text-purple-500/30 shrink-0 w-8">{String(index + 1).padStart(2, "0")}</span>
                  <div className="space-y-3">
                    <h2 className="text-xl font-bold text-white">{type.title}</h2>
                    <p className="text-sm text-zinc-300"><span className="font-semibold text-zinc-100">Best for:</span> {type.bestFor}</p>
                    <p className="text-sm text-zinc-400"><span className="font-semibold text-zinc-200">Look for:</span> {type.lookFor}</p>
                  </div>
                </div>
              </div>
            ))}
          </section>

          <section className="space-y-4 mb-14">
            <h2 className="text-2xl font-extrabold text-white">Quick Recommendation</h2>
            <p className="text-zinc-400">
              If you want a lively company-wide event, choose a live-hosted game show. If you want a repeatable weekly or monthly ritual, choose a self-service game platform. If your team loves puzzles, choose an escape room. If you want a calmer shared experience, choose a workshop provider.
            </p>
            <p className="text-zinc-400">
              Teamtastic sits in the game show and self-service categories: browser-based team games, custom trivia, Survey Showdown, and optional live hosting.
            </p>
          </section>

          <section className="glassmorphism rounded-2xl p-8 border border-purple-500/20 bg-purple-500/5 mb-14">
            <h2 className="text-2xl font-extrabold text-white mb-3">Want the Teamtastic Fit Check?</h2>
            <p className="text-zinc-400 mb-6">
              Answer a few questions and we will point you toward the right game format for your team size, vibe, and event goal.
            </p>
            <Link href="/#quiz" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 transition-all">
              Get a Recommendation <ArrowRight className="h-4 w-4" />
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
