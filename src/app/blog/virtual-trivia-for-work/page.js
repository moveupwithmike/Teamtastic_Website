import Link from "next/link";
import { ArrowRight, Calendar, Clock, User } from "lucide-react";

export const metadata = {
  title: "Virtual Trivia for Work: How to Run a Game People Enjoy | Teamtastic",
  description:
    "Plan virtual trivia for work with better categories, pacing, team rules, and custom questions for remote employees.",
  alternates: {
    canonical: "https://teamtastic.events/blog/virtual-trivia-for-work",
  },
  openGraph: {
    title: "Virtual Trivia for Work",
    description: "A practical guide to running better online trivia for remote teams.",
    url: "https://teamtastic.events/blog/virtual-trivia-for-work",
  },
};

const rounds = [
  ["Company culture", "Questions about team history, product launches, values, office lore, and shared wins."],
  ["Pop culture mix", "A balanced blend of music, movies, sports, internet culture, and general knowledge."],
  ["Picture round", "Logos, blurred images, desk photos, childhood photos, or mystery objects."],
  ["Sound bite round", "Short clips from songs, jingles, movies, or famous moments."],
  ["Speed round", "Quick questions with shorter timers and bonus points for fast answers."],
  ["Survey round", "Guess the most popular answers from a pre-event team survey."],
  ["Emoji round", "Decode phrases, titles, or company jokes from emoji clues."],
  ["Final wager", "Let teams risk points on one last question to keep the ending exciting."],
];

const faqs = [
  {
    q: "How do you run virtual trivia for work?",
    a: "Choose categories, split people into teams, use short rounds, show scores often, and keep the host moving. Custom questions make the event feel more personal.",
  },
  {
    q: "How many questions do you need for virtual trivia?",
    a: "For a 45-minute event, plan 25 to 35 questions across five to seven rounds. Keep extra tiebreakers ready.",
  },
  {
    q: "What makes work trivia inclusive?",
    a: "Use varied categories, avoid questions that require niche cultural knowledge, allow team discussion, and include custom company questions that everyone can reasonably answer.",
  },
];

export default function VirtualTriviaForWork() {
  return (
    <main className="flex flex-col min-h-screen bg-brand-dark">
      <article className="py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 text-xs text-zinc-500 mb-8">
            <Link href="/blog" className="hover:text-zinc-300 transition-colors">Blog</Link>
            <span>/</span>
            <span className="text-zinc-400">Virtual Trivia for Work</span>
          </div>

          <span className="inline-flex mb-6 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border text-sky-400 border-sky-500/30 bg-sky-500/10">
            Trivia
          </span>

          <h1 className="text-3xl sm:text-5xl font-extrabold text-white leading-tight mb-6">
            Virtual Trivia for Work: How to Run a Game People Enjoy
          </h1>

          <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500 mb-10 border-b border-white/5 pb-8">
            <span className="flex items-center gap-1.5"><User className="h-3.5 w-3.5" /> Teamtastic Events Team</span>
            <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> July 9, 2026</span>
            <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> 7 min read</span>
          </div>

          <div className="space-y-5 text-zinc-400 leading-relaxed mb-12">
            <p className="text-lg text-zinc-300">
              Virtual trivia is one of the easiest remote team building formats to run, but it only works when the questions, teams, and pacing are designed for work groups.
            </p>
            <p>
              A good work trivia game should reward collaboration, not just the one person who knows every sports statistic or movie quote.
            </p>
          </div>

          <section className="space-y-4 mb-14">
            <h2 className="text-2xl font-extrabold text-white">Best Trivia Rounds for Work</h2>
            {rounds.map(([title, desc], index) => (
              <div key={title} className="glassmorphism rounded-2xl p-5 border border-white/5 flex gap-5">
                <span className="text-2xl font-extrabold text-sky-500/30 shrink-0 w-8">{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <h3 className="font-bold text-white mb-1">{title}</h3>
                  <p className="text-sm text-zinc-400">{desc}</p>
                </div>
              </div>
            ))}
          </section>

          <section className="space-y-4 mb-14">
            <h2 className="text-2xl font-extrabold text-white">Simple 45-Minute Format</h2>
            <p className="text-zinc-400">Start with a two-minute welcome, then run five rounds of five questions. Show scores after every round. Use one final wager question, announce the winners, and leave a few minutes for screenshots or shoutouts.</p>
            <p className="text-zinc-400">For larger teams, assign captains and let each team submit one answer. For smaller groups, individual play can work, but team play usually feels more social.</p>
          </section>

          <section className="glassmorphism rounded-2xl p-8 border border-purple-500/20 bg-purple-500/5 mb-14">
            <h2 className="text-2xl font-extrabold text-white mb-3">Want Custom Trivia Without Building It?</h2>
            <p className="text-zinc-400 mb-6">
              Teamtastic can turn your team facts, company moments, and event theme into a live trivia game or broader game show.
            </p>
            <Link href="/#quiz" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 transition-all">
              Plan Custom Trivia <ArrowRight className="h-4 w-4" />
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
