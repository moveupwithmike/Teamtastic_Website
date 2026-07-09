import Link from "next/link";
import { ArrowRight, Calendar, Clock, User } from "lucide-react";

export const metadata = {
  title: "Corporate Game Show Ideas for Work: 12 Formats Teams Love | Teamtastic",
  description:
    "Use these corporate game show ideas for virtual team events, holiday parties, sales kickoffs, onboarding, and remote employee engagement.",
  alternates: {
    canonical: "https://teamtastic.events/blog/corporate-game-show-ideas-for-work",
  },
  openGraph: {
    title: "Corporate Game Show Ideas for Work",
    description: "12 game show formats for virtual and hybrid company events.",
    url: "https://teamtastic.events/blog/corporate-game-show-ideas-for-work",
  },
};

const ideas = [
  ["Survey Showdown", "Teams guess the most popular answers to workplace survey prompts."],
  ["Lightning trivia", "Fast trivia rounds with short timers and quick score updates."],
  ["Name that tune", "Audio clips, lyrics, movie scores, or commercial jingles."],
  ["Office Feud", "A company-safe spin on family survey games with custom prompts."],
  ["Meme championship", "Teams write captions and vote on the best one."],
  ["The Price Is Weird", "Guess the price of odd office supplies, snacks, or internet products."],
  ["Logo recall", "Guess brands, apps, clients, or internal project names from partial visuals."],
  ["Year-in-review showdown", "Questions based on company milestones and cultural moments."],
  ["Mystery teammate", "Guess the teammate from clues, desk photos, or fun facts."],
  ["Pitch battle", "Teams improvise funny product pitches from random prompts."],
  ["Emoji decoder", "Decode phrases, movies, company values, or team jokes."],
  ["Final wager", "A dramatic final question where teams can risk points to win."],
];

const faqs = [
  {
    q: "What is a corporate game show?",
    a: "A corporate game show is a structured team competition for employees, usually with a host, rounds, scoring, and workplace-safe prompts or trivia.",
  },
  {
    q: "Can a corporate game show work virtually?",
    a: "Yes. Virtual corporate game shows work well when players can join easily, teams can collaborate, and the host keeps the rules and scoring clear.",
  },
  {
    q: "What events are corporate game shows good for?",
    a: "They are useful for holiday parties, sales kickoffs, onboarding, intern cohorts, quarterly meetings, all-hands celebrations, and remote team engagement.",
  },
];

export default function CorporateGameShowIdeasForWork() {
  return (
    <main className="flex flex-col min-h-screen bg-brand-dark">
      <article className="py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 text-xs text-zinc-500 mb-8">
            <Link href="/blog" className="hover:text-zinc-300 transition-colors">Blog</Link>
            <span>/</span>
            <span className="text-zinc-400">Corporate Game Show Ideas</span>
          </div>

          <span className="inline-flex mb-6 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border text-amber-400 border-amber-500/30 bg-amber-500/10">
            Game Shows
          </span>

          <h1 className="text-3xl sm:text-5xl font-extrabold text-white leading-tight mb-6">
            Corporate Game Show Ideas for Work: 12 Formats Teams Love
          </h1>

          <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500 mb-10 border-b border-white/5 pb-8">
            <span className="flex items-center gap-1.5"><User className="h-3.5 w-3.5" /> Teamtastic Events Team</span>
            <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> July 9, 2026</span>
            <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> 8 min read</span>
          </div>

          <div className="space-y-5 text-zinc-400 leading-relaxed mb-12">
            <p className="text-lg text-zinc-300">
              Corporate game shows work because they give employees a role, a goal, and a reason to pay attention. Instead of hoping conversation happens, the format creates momentum.
            </p>
            <p>
              These ideas work for remote, hybrid, and in-person teams, but they are especially useful on video calls where open-ended social time can get quiet fast.
            </p>
          </div>

          <section className="space-y-4 mb-14">
            {ideas.map(([title, desc], index) => (
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
            <h2 className="text-2xl font-extrabold text-white">How to Choose the Right Format</h2>
            <p className="text-zinc-400">Use trivia when your group enjoys knowledge and speed. Use survey games when you want more laughs and less pressure. Use meme or pitch rounds when creativity matters. For large events, combine several round types so different personalities get a chance to shine.</p>
            <p className="text-zinc-400">The most important ingredient is the host. A game show needs pace, transitions, and a clear sense that someone is steering the room.</p>
          </section>

          <section className="glassmorphism rounded-2xl p-8 border border-purple-500/20 bg-purple-500/5 mb-14">
            <h2 className="text-2xl font-extrabold text-white mb-3">Bring the Game Show to Your Team</h2>
            <p className="text-zinc-400 mb-6">
              Teamtastic runs live-hosted corporate game shows with custom trivia, survey rounds, music clips, and team scoring.
            </p>
            <Link href="/#quiz" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 transition-all">
              Build My Game Show <ArrowRight className="h-4 w-4" />
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
