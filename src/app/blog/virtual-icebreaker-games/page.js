import Link from "next/link";
import { ArrowRight, Clock, User, Calendar } from "lucide-react";

export const metadata = {
  title: "21 Virtual Icebreaker Games That Don't Feel Awkward | Teamtastic",
  description:
    "Virtual icebreakers don't have to be cringe-worthy. These 21 low-pressure, genuinely fun icebreaker games work even for camera-shy remote employees.",
  openGraph: {
    title: "21 Virtual Icebreaker Games That Don't Feel Awkward",
    url: "https://teamtastic.events/blog/virtual-icebreaker-games",
  },
};

const icebreakers = [
  { title: "Two Truths and a Lie (with Stakes)", desc: "Classic format, but with a leaderboard. Whoever fools the most people wins a digital badge or a coffee card." },
  { title: "GIF Battle", desc: "Drop a scenario in Slack or chat. Everyone responds with a GIF. The funniest one (voted by the group) wins the round." },
  { title: "Emoji Mood Check-In", desc: "Everyone picks 3 emojis that describe their week. Zero pressure, highly expressive, and reveals a lot without requiring vulnerability." },
  { title: "Remote Office Show & Tell", desc: "One item from your desk, home office, or workspace. 60 seconds to explain why it matters. Instantly humanizing." },
  { title: "Speed Geography", desc: "Drop a city name. Everyone has 30 seconds to write one fact about it. The host reads them aloud and the group votes on the best." },
  { title: "The Teamtastic Quiz Warmup", desc: "Open a 5-question trivia round on teamtastic.games. No setup required — players join with one link." },
  { title: "Pet Parade", desc: "30 seconds per person to introduce their pet (or their neighbor's pet, or a stuffed animal, if pet-free). Always a crowd-pleaser." },
  { title: "Name That Sound", desc: "Play a mystery sound clip — ambient noise, an instrument, a movie sound effect. First to guess correctly wins." },
  { title: "Bingo (Custom Card)", desc: "Create a bingo card with things like 'Someone is muted', 'Dog barks', 'Working in pajamas'. Mark off during the call." },
  { title: "This or That (Corporate Edition)", desc: "Rapid-fire binary choices: 'Slack or email?' 'Async or live meetings?' 'WFH or office?' Reveals personality without pressure." },
  { title: "60-Second Story", desc: "Each person has 60 seconds to tell any story — real or fictional — that starts with 'Last week...' or 'One time...' Minimal prep, maximum entertainment." },
  { title: "Scavenger Hunt (Home Edition)", desc: "Give teams 3 minutes to find something: 'Oldest thing in your home', 'Something that inspires you', 'Best snack'. First back wins." },
  { title: "Trivia Pop Quiz", desc: "5-question pop quiz on any topic: sports, movies, company history, geography. Keep it moving and light." },
  { title: "One-Word Weather Report", desc: "Describe your mood/week in one word — and it must be a weather pattern. 'Thunderstormy', 'Partly cloudy', 'Sunny with a chance of meetings.'" },
  { title: "Virtual Photo Challenge", desc: "Give a prompt: 'Your view right now', 'Best thing near you', 'Something yellow'. Share screens or post in chat." },
];

export default function VirtualIcebreakerGames() {
  return (
    <main className="flex flex-col min-h-screen bg-brand-dark">
      <article className="py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 text-xs text-zinc-500 mb-8">
            <Link href="/blog" className="hover:text-zinc-300 transition-colors">Blog</Link>
            <span>/</span>
            <span className="text-zinc-400">Virtual Icebreaker Games</span>
          </div>

          <div className="mb-6">
            <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border text-sky-400 border-sky-500/30 bg-sky-500/10">
              Icebreakers
            </span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold text-white leading-tight mb-6">
            21 Virtual Icebreaker Games That Don&apos;t Feel Awkward
          </h1>

          <div className="flex items-center gap-6 text-xs text-zinc-500 mb-10 border-b border-white/5 pb-8">
            <span className="flex items-center gap-1.5"><User className="h-3.5 w-3.5" /> Teamtastic Events Team</span>
            <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> April 28, 2025</span>
            <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> 8 min read</span>
          </div>

          <div className="space-y-4 mb-12">
            <p className="text-lg text-zinc-300 leading-relaxed">
              The dreaded icebreaker. Even the word triggers flashbacks to &ldquo;tell us one fun fact about yourself&rdquo; followed by 45 seconds of dead silence.
            </p>
            <p className="text-zinc-400 leading-relaxed">
              The good news: icebreakers only feel awkward when they require vulnerability without structure, or participation without clear rules. The formats below work because they give people something specific to do — and they scale from the most extroverted to the most reserved team members.
            </p>
          </div>

          <div className="space-y-4 mb-12">
            {icebreakers.map((item, i) => (
              <div key={item.title} className="glassmorphism rounded-2xl p-5 border border-white/5 hover:border-sky-500/20 transition-colors flex gap-5">
                <span className="text-xl font-extrabold text-sky-500/30 shrink-0 w-7 mt-0.5">{i + 1}</span>
                <div>
                  <h3 className="font-bold text-white mb-1">{item.title}</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}

            {/* Items 16-21 teaser */}
            <div className="glassmorphism rounded-2xl p-8 border border-sky-500/20 bg-sky-500/5 text-center">
              <p className="text-white font-bold mb-2">Ideas 16–21: Want the Full Set?</p>
              <p className="text-sm text-zinc-400 mb-5">The best icebreaker is a live Teamtastic game round — no setup, just a link. Run a free 5-question trivia warmup in under 2 minutes.</p>
              <a
                href="https://teamtastic.games"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-sky-600 to-purple-600 hover:from-sky-500 hover:to-purple-500 transition-all"
              >
                Launch a Free Warmup <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>

          <div className="space-y-4 border-t border-white/5 pt-10">
            <h2 className="text-2xl font-extrabold text-white">The Golden Rule of Icebreakers</h2>
            <p className="text-zinc-400 leading-relaxed">
              The best icebreaker is the one that creates shared laughter within the first 3 minutes. If you&apos;re 5 minutes in and no one has laughed, switch formats immediately. Energy compounds — or it collapses. Don&apos;t let it collapse.
            </p>
            <Link
              href="/virtual-team-building"
              className="inline-flex items-center gap-1.5 text-sm text-sky-400 hover:text-sky-300 transition-colors"
            >
              Explore all virtual team building formats <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </article>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: "21 Virtual Icebreaker Games That Don't Feel Awkward",
            datePublished: "2025-04-28",
            author: { "@type": "Organization", name: "Teamtastic Events" },
            publisher: { "@type": "Organization", name: "Teamtastic", url: "https://teamtastic.events" },
          }),
        }}
      />
    </main>
  );
}
