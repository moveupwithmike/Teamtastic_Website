import Link from "next/link";
import { ArrowRight, Calendar, Clock, User } from "lucide-react";

export const metadata = {
  title: "Virtual Holiday Party Packages for Work: What to Compare | Teamtastic",
  description:
    "Compare virtual holiday party packages by group size, host support, customization, games, production needs, and pricing model.",
  alternates: {
    canonical: "https://teamtastic.events/blog/virtual-holiday-party-packages",
  },
  openGraph: {
    title: "Virtual Holiday Party Packages for Work",
    description: "A pricing and package guide for remote company holiday parties.",
    url: "https://teamtastic.events/blog/virtual-holiday-party-packages",
  },
};

const packageFactors = [
  ["Group size", "Larger groups need stronger pacing, team structure, scoring, and sometimes extra host support."],
  ["Hosting level", "Self-run packages are cheaper. Live-hosted packages reduce planner work and usually produce a better event."],
  ["Game format", "Trivia, survey games, music rounds, escape rooms, and workshops require different levels of production."],
  ["Customization", "Company trivia, year-in-review content, branded visuals, and awards should be priced separately when they require prep work."],
  ["Platform and camera needs", "Standard Zoom-style events are simpler. Camera-forward or broadcast-style formats require more setup."],
  ["Timing", "Prime December dates are operationally scarce, so date holds and deposits are reasonable."],
];

const faqs = [
  {
    q: "How are virtual holiday party packages usually priced?",
    a: "Most providers price by group size, format, hosting level, customization, and production complexity. Larger groups and custom hosted events usually cost more than self-run games.",
  },
  {
    q: "What should be included in a virtual holiday party package?",
    a: "A strong package should include a host or clear facilitation plan, game instructions, player joining details, support, scoring, timing, and any agreed custom content.",
  },
  {
    q: "Should I choose a self-run or hosted holiday party package?",
    a: "Choose self-run for small, low-stakes teams with an internal organizer. Choose hosted when the event is larger, leadership-facing, or important enough that you want a professional to manage the room.",
  },
];

export default function VirtualHolidayPartyPackages() {
  return (
    <main className="flex flex-col min-h-screen bg-brand-dark">
      <article className="py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 text-xs text-zinc-500 mb-8">
            <Link href="/blog" className="hover:text-zinc-300 transition-colors">Blog</Link>
            <span>/</span>
            <span className="text-zinc-400">Virtual Holiday Party Packages</span>
          </div>

          <span className="inline-flex mb-6 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border text-amber-400 border-amber-500/30 bg-amber-500/10">
            Pricing Guide
          </span>

          <h1 className="text-3xl sm:text-5xl font-extrabold text-white leading-tight mb-6">
            Virtual Holiday Party Packages for Work: What to Compare
          </h1>

          <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500 mb-10 border-b border-white/5 pb-8">
            <span className="flex items-center gap-1.5"><User className="h-3.5 w-3.5" /> Teamtastic Events Team</span>
            <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> July 30, 2026</span>
            <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> 7 min read</span>
          </div>

          <div className="space-y-5 text-zinc-400 leading-relaxed mb-12">
            <p className="text-lg text-zinc-300">
              Virtual holiday party packages can look similar on the surface, but the actual value depends on hosting, customization, group size, and how much planning work the provider removes.
            </p>
            <p>
              Use this guide to compare packages without reducing the decision to the lowest per-person price.
            </p>
          </div>

          <section className="space-y-4 mb-14">
            {packageFactors.map(([title, desc], index) => (
              <div key={title} className="glassmorphism rounded-2xl p-5 border border-white/5 flex gap-5">
                <span className="text-2xl font-extrabold text-amber-500/30 shrink-0 w-8">{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <h2 className="font-bold text-white mb-1">{title}</h2>
                  <p className="text-sm text-zinc-400">{desc}</p>
                </div>
              </div>
            ))}
          </section>

          <section className="space-y-4 mb-14">
            <h2 className="text-2xl font-extrabold text-white">Teamtastic Package Logic</h2>
            <p className="text-zinc-400">
              Teamtastic pricing is based on group size, hosting format, and production needs. Standard hosted events cover the core live game show experience. Larger groups may require more facilitation. Premium formats can add Live Camera Mode or custom production support.
            </p>
            <p className="text-zinc-400">
              That keeps pricing tied to operational reality: more players, more moving pieces, and more production support when needed.
            </p>
          </section>

          <section className="glassmorphism rounded-2xl p-8 border border-purple-500/20 bg-purple-500/5 mb-14">
            <h2 className="text-2xl font-extrabold text-white mb-3">Get the Right Package for Your Team Size</h2>
            <p className="text-zinc-400 mb-6">
              Share your headcount, date options, and preferred style. We will recommend the simplest package that still delivers a strong holiday event.
            </p>
            <Link href="/virtual-holiday-party" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 transition-all">
              Plan My Holiday Package <ArrowRight className="h-4 w-4" />
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
