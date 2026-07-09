import Link from "next/link";
import { ArrowRight, Calendar, Clock, User } from "lucide-react";

export const metadata = {
  title: "Virtual Holiday Party Ideas for Large Teams | Teamtastic",
  description:
    "Plan virtual holiday parties for large remote teams with scalable games, team formats, breakout alternatives, and hosting tips for 50, 100, or 300+ employees.",
  alternates: {
    canonical: "https://teamtastic.events/blog/virtual-holiday-party-ideas-for-large-teams",
  },
  openGraph: {
    title: "Virtual Holiday Party Ideas for Large Teams",
    description: "Scalable holiday party formats for large remote and hybrid teams.",
    url: "https://teamtastic.events/blog/virtual-holiday-party-ideas-for-large-teams",
  },
};

const ideas = [
  ["Team-based holiday trivia", "Divide people into teams and let captains submit one answer per round."],
  ["Survey Showdown", "Large groups are perfect for survey games because the answers feel more representative."],
  ["Name That Holiday Tune", "Audio rounds work well at scale because everyone understands the task immediately."],
  ["Company year-in-review", "Use milestones, launches, customer wins, and internal moments as game material."],
  ["Department vs department", "Create friendly competition between teams, regions, or functions."],
  ["Chat-based lightning rounds", "Let everyone participate through chat while the host calls out selected answers."],
  ["Poll tournaments", "Use quick polls to vote through snacks, movies, songs, and team traditions."],
  ["Awards show breaks", "Between game rounds, recognize teams, values, launches, and hidden helpers."],
  ["Breakout puzzle rooms", "Use small-group puzzle rounds only when you have enough facilitation support."],
  ["Regional holiday round", "Celebrate global traditions, local foods, and winter customs respectfully."],
  ["Photo wall prompts", "Collect optional photos before the event and reveal them during the show."],
  ["Final scoreboard reveal", "End with a clear winner, runner-up, and a screenshot-worthy celebration."],
];

const faqs = [
  {
    q: "How do you run a virtual holiday party for a large team?",
    a: "Use a hosted format, team captains, visible scoring, chat participation, and simple rounds that do not require every person to speak individually.",
  },
  {
    q: "What size group can play a virtual holiday game show?",
    a: "A virtual holiday game show can work for small teams and large groups of 100 or more when the format uses teams, captains, chat, and a strong host.",
  },
  {
    q: "Should large virtual holiday parties use breakout rooms?",
    a: "Breakout rooms can work, but they add logistics. For many large teams, a main-room game show with team captains and chat participation is smoother.",
  },
];

export default function VirtualHolidayPartyIdeasForLargeTeams() {
  return (
    <main className="flex flex-col min-h-screen bg-brand-dark">
      <article className="py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 text-xs text-zinc-500 mb-8">
            <Link href="/blog" className="hover:text-zinc-300 transition-colors">Blog</Link>
            <span>/</span>
            <span className="text-zinc-400">Large-Team Holiday Parties</span>
          </div>

          <span className="inline-flex mb-6 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border text-purple-400 border-purple-500/30 bg-purple-500/10">
            Large Teams
          </span>

          <h1 className="text-3xl sm:text-5xl font-extrabold text-white leading-tight mb-6">
            Virtual Holiday Party Ideas for Large Teams
          </h1>

          <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500 mb-10 border-b border-white/5 pb-8">
            <span className="flex items-center gap-1.5"><User className="h-3.5 w-3.5" /> Teamtastic Events Team</span>
            <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> July 9, 2026</span>
            <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> 8 min read</span>
          </div>

          <div className="space-y-5 text-zinc-400 leading-relaxed mb-12">
            <p className="text-lg text-zinc-300">
              Large virtual holiday parties fail when they ask 100 people to act like they are at a small dinner table. They work when the format is designed for scale.
            </p>
            <p>
              The key is team play, visible scoring, simple rules, and a host who can keep hundreds of people oriented without making anyone feel lost.
            </p>
          </div>

          <section className="space-y-4 mb-14">
            {ideas.map(([title, desc], index) => (
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
            <h2 className="text-2xl font-extrabold text-white">Large-Team Format Recommendation</h2>
            <p className="text-zinc-400">For 50 to 300+ people, use one main room, a live host, team captains, chat participation, and five to seven short rounds. Avoid long breakout logistics unless you have facilitators for each room.</p>
            <p className="text-zinc-400">The format should feel like a show: clear welcome, fast rules, score updates, recognition moments, final reveal, and a clean ending.</p>
          </section>

          <section className="glassmorphism rounded-2xl p-8 border border-purple-500/20 bg-purple-500/5 mb-14">
            <h2 className="text-2xl font-extrabold text-white mb-3">Planning for 50, 100, or 300+?</h2>
            <p className="text-zinc-400 mb-6">
              Teamtastic runs scalable virtual holiday game shows with team modes, custom questions, music rounds, and a live emcee to keep large groups engaged.
            </p>
            <Link href="/virtual-holiday-party" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 transition-all">
              Plan a Large Holiday Party <ArrowRight className="h-4 w-4" />
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
