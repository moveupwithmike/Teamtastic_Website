import Link from "next/link";
import { ArrowRight, Calendar, Clock, User } from "lucide-react";

export const metadata = {
  title: "Holiday Team Building Activities for Remote Teams | Teamtastic",
  description:
    "Use these holiday team building activities for remote teams to create connection, recognition, and end-of-year energy without another awkward video call.",
  alternates: {
    canonical: "https://teamtastic.events/blog/holiday-team-building-activities-for-remote-teams",
  },
  openGraph: {
    title: "Holiday Team Building Activities for Remote Teams",
    description: "Remote-friendly holiday team building activities for work.",
    url: "https://teamtastic.events/blog/holiday-team-building-activities-for-remote-teams",
  },
};

const activities = [
  ["Holiday team trivia", "Use company moments, seasonal clues, and year-in-review questions."],
  ["Survey Showdown", "Teams guess the most popular answers to workplace holiday prompts."],
  ["Name That Holiday Tune", "Audio rounds create fast participation without forcing anyone to speak alone."],
  ["Year-end awards", "Recognize launches, hidden helpers, customer wins, and team milestones."],
  ["Winter puzzle challenge", "Give quieter or analytical teams a collaborative problem-solving format."],
  ["Gift guessing game", "Let employees submit fictional gifts or perks and guess who chose them."],
  ["Holiday meme round", "Teams caption seasonal or workplace images with clean jokes."],
  ["Remote desk decoration prompt", "Use optional photos instead of mandatory camera performance."],
  ["Global traditions round", "Use respectful winter and year-end prompts for distributed teams."],
  ["Department vs department finale", "Create a simple scoreboard that gives the event stakes."],
];

const faqs = [
  {
    q: "What holiday team building activities work for remote teams?",
    a: "Structured activities work best: hosted trivia, survey games, music rounds, awards, puzzle challenges, and team-based competitions with clear rules.",
  },
  {
    q: "How do you avoid awkward remote holiday team building?",
    a: "Use team play, short rounds, clear instructions, and optional personal sharing. Avoid open-ended social time as the main event.",
  },
  {
    q: "Should holiday team building be competitive?",
    a: "Light competition helps remote events maintain energy, but it should be team-based and inclusive. Mix trivia, surveys, music, and recognition so different people can contribute.",
  },
];

export default function HolidayTeamBuildingActivitiesForRemoteTeams() {
  return (
    <main className="flex flex-col min-h-screen bg-brand-dark">
      <article className="py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 text-xs text-zinc-500 mb-8">
            <Link href="/blog" className="hover:text-zinc-300 transition-colors">Blog</Link>
            <span>/</span>
            <span className="text-zinc-400">Holiday Team Building</span>
          </div>

          <span className="inline-flex mb-6 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border text-emerald-400 border-emerald-500/30 bg-emerald-500/10">
            Remote Teams
          </span>

          <h1 className="text-3xl sm:text-5xl font-extrabold text-white leading-tight mb-6">
            Holiday Team Building Activities for Remote Teams
          </h1>

          <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500 mb-10 border-b border-white/5 pb-8">
            <span className="flex items-center gap-1.5"><User className="h-3.5 w-3.5" /> Teamtastic Events Team</span>
            <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> July 30, 2026</span>
            <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> 7 min read</span>
          </div>

          <div className="space-y-5 text-zinc-400 leading-relaxed mb-12">
            <p className="text-lg text-zinc-300">
              Holiday team building for remote teams should create a shared end-of-year moment without adding another unfocused video call to the calendar.
            </p>
            <p>
              The best activities are structured, short, inclusive, and easy to join from the video platform your team already uses.
            </p>
          </div>

          <section className="space-y-4 mb-14">
            {activities.map(([title, desc], index) => (
              <div key={title} className="glassmorphism rounded-2xl p-5 border border-white/5 flex gap-5">
                <span className="text-2xl font-extrabold text-emerald-500/30 shrink-0 w-8">{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <h2 className="font-bold text-white mb-1">{title}</h2>
                  <p className="text-sm text-zinc-400">{desc}</p>
                </div>
              </div>
            ))}
          </section>

          <section className="space-y-4 mb-14">
            <h2 className="text-2xl font-extrabold text-white">Best Format for Most Remote Teams</h2>
            <p className="text-zinc-400">
              Use a live-hosted game show when you want the holiday event to feel important. The host handles rules, pacing, scoring, transitions, and the awkward silence risk.
            </p>
            <p className="text-zinc-400">
              For smaller recurring teams, self-run games can work. For company-wide Q4 events, hosted facilitation is usually the safer choice.
            </p>
          </section>

          <section className="glassmorphism rounded-2xl p-8 border border-purple-500/20 bg-purple-500/5 mb-14">
            <h2 className="text-2xl font-extrabold text-white mb-3">Run the Holiday Team Building Event as a Show</h2>
            <p className="text-zinc-400 mb-6">
              Teamtastic turns holiday team building into a live-hosted game show with custom questions, music rounds, team scoring, and no downloads.
            </p>
            <Link href="/virtual-holiday-party" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 transition-all">
              Plan Holiday Team Building <ArrowRight className="h-4 w-4" />
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
