import Link from "next/link";
import { ArrowRight, Calendar, Clock, User } from "lucide-react";

export const metadata = {
  title: "Virtual Holiday Party Games for Work: 15 Easy Ideas | Teamtastic",
  description:
    "Plan a virtual holiday party employees will enjoy. Try these 15 online holiday games for Zoom, Teams, and remote company celebrations.",
  alternates: {
    canonical: "https://teamtastic.events/blog/virtual-holiday-party-games",
  },
  openGraph: {
    title: "Virtual Holiday Party Games for Work",
    description: "15 online holiday party games for remote and hybrid companies.",
    url: "https://teamtastic.events/blog/virtual-holiday-party-games",
  },
};

const games = [
  ["Holiday trivia show", "Mix festive questions with company-specific moments from the year."],
  ["Seasonal Survey Showdown", "Teams guess the most popular answers to holiday workplace prompts."],
  ["Name that holiday tune", "Play short song clips and award points for fast guesses."],
  ["Year-in-review quiz", "Turn company milestones, product launches, and team wins into trivia."],
  ["Ugly sweater vote", "Keep it optional and award playful categories."],
  ["Holiday movie quote round", "Players guess the film from a short quote or scene clue."],
  ["Gift guesser", "People submit a surprising gift idea and teams guess who chose it."],
  ["Winter emoji puzzles", "Decode seasonal phrases, films, or songs from emojis."],
  ["Desk decoration tour", "Short, opt-in show-and-tell for decorated workspaces."],
  ["Holiday bingo", "Use custom cards based on remote work, travel, snacks, and traditions."],
  ["Festive meme battle", "Teams caption holiday images with office-safe jokes."],
  ["Recipe roulette", "Players guess the dish from ingredient clues."],
  ["Global traditions round", "A respectful trivia round about winter celebrations around the world."],
  ["Team awards show", "Celebrate specific wins and funny moments from the year."],
  ["Hosted game show finale", "Close the party with a high-energy scoreboard and winner reveal."],
];

const faqs = [
  {
    q: "What is a good virtual holiday party game for work?",
    a: "A good virtual holiday party game is easy to explain, inclusive, and not too personal. Holiday trivia, music rounds, survey games, bingo, and hosted game shows are reliable choices.",
  },
  {
    q: "How long should a virtual holiday party be?",
    a: "Most company holiday parties work best at 45 to 75 minutes. That leaves enough time for welcome remarks, games, awards, and casual conversation without draining the room.",
  },
  {
    q: "How do you make a remote holiday party feel less awkward?",
    a: "Use structured games, team play, a visible scoreboard, and a confident host. Avoid long open-ended small talk and forced individual performances.",
  },
];

export default function VirtualHolidayPartyGames() {
  return (
    <main className="flex flex-col min-h-screen bg-brand-dark">
      <article className="py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 text-xs text-zinc-500 mb-8">
            <Link href="/blog" className="hover:text-zinc-300 transition-colors">Blog</Link>
            <span>/</span>
            <span className="text-zinc-400">Virtual Holiday Party Games</span>
          </div>

          <span className="inline-flex mb-6 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border text-amber-400 border-amber-500/30 bg-amber-500/10">
            Seasonal Events
          </span>

          <h1 className="text-3xl sm:text-5xl font-extrabold text-white leading-tight mb-6">
            Virtual Holiday Party Games for Work: 15 Easy Ideas
          </h1>

          <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500 mb-10 border-b border-white/5 pb-8">
            <span className="flex items-center gap-1.5"><User className="h-3.5 w-3.5" /> Teamtastic Events Team</span>
            <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> July 9, 2026</span>
            <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> 7 min read</span>
          </div>

          <div className="space-y-5 text-zinc-400 leading-relaxed mb-12">
            <p className="text-lg text-zinc-300">
              A remote holiday party should feel like a celebration, not another meeting with seasonal clip art. The best games create shared moments quickly and give people permission to relax.
            </p>
            <p>
              Use these ideas for Zoom, Microsoft Teams, Google Meet, or any browser-based company event.
            </p>
          </div>

          <section className="space-y-4 mb-14">
            {games.map(([title, desc], index) => (
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
            <h2 className="text-2xl font-extrabold text-white">Holiday Party Planning Tips</h2>
            <p className="text-zinc-400">Send the invite with a clear agenda, keep optional dress-up truly optional, and pick games that do not depend on alcohol, gift budgets, or personal traditions. For global teams, use winter or year-end themes alongside holiday-specific rounds.</p>
            <p className="text-zinc-400">If leaders want remarks, keep them short and put them before the main game. End with a winner reveal or awards moment so the event has a natural finish.</p>
          </section>

          <section className="glassmorphism rounded-2xl p-8 border border-purple-500/20 bg-purple-500/5 mb-14">
            <h2 className="text-2xl font-extrabold text-white mb-3">Need a Hosted Holiday Game?</h2>
            <p className="text-zinc-400 mb-6">
              Teamtastic can run a live-hosted virtual holiday game show with custom trivia, music rounds, survey prompts, and a real emcee.
            </p>
            <Link href="/#quiz" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 transition-all">
              Plan My Holiday Event <ArrowRight className="h-4 w-4" />
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
