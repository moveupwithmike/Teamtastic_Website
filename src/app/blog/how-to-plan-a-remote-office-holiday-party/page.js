import Link from "next/link";
import { ArrowRight, Calendar, Clock, User } from "lucide-react";

export const metadata = {
  title: "How to Plan a Remote Office Holiday Party: Step-by-Step Guide | Teamtastic",
  description:
    "Plan a remote office holiday party with a simple timeline, agenda, inclusive game ideas, host tips, and a checklist for HR and event planners.",
  alternates: {
    canonical: "https://teamtastic.events/blog/how-to-plan-a-remote-office-holiday-party",
  },
  openGraph: {
    title: "How to Plan a Remote Office Holiday Party",
    description: "A practical holiday party planning guide for remote and hybrid companies.",
    url: "https://teamtastic.events/blog/how-to-plan-a-remote-office-holiday-party",
  },
};

const steps = [
  ["Pick the goal", "Decide whether the party should feel celebratory, competitive, cozy, appreciation-focused, or fully hosted."],
  ["Hold target dates", "Collect two or three preferred dates before December calendars get crowded."],
  ["Choose the theme", "Pick holiday-specific, winter-themed, or year-end celebration language based on your team's culture."],
  ["Set the runtime", "Most remote office holiday parties work best at 45 to 75 minutes."],
  ["Choose the main activity", "Use a hosted game show, trivia, music round, awards show, or winter puzzle challenge."],
  ["Collect custom prompts", "Gather company trivia, team wins, product milestones, funny moments, and shoutouts."],
  ["Confirm the platform", "Use Zoom, Teams, Meet, Webex, or the video tool your team already knows."],
  ["Make participation easy", "Use team play, chat, polls, and captains so nobody has to perform alone."],
  ["Plan leader remarks", "Keep executive remarks short and place them before the main game."],
  ["Decide on prizes", "Use gift cards, PTO hours, charitable donations, small swag, or bragging rights."],
  ["Send a clear invite", "Include the date, time zone, platform link, theme, and whether cameras or dress-up are optional."],
  ["End with a moment", "Close with winners, awards, screenshots, or a short year-end toast."],
];

const faqs = [
  {
    q: "How long should a remote office holiday party be?",
    a: "Most remote office holiday parties should run 45 to 75 minutes. That gives enough time for a welcome, main activity, awards, and a clean finish.",
  },
  {
    q: "What is the easiest remote holiday party to plan?",
    a: "The easiest option is a live-hosted game show because the host manages pacing, rules, transitions, and energy while the planner handles the invite and guest list.",
  },
  {
    q: "When should HR start planning a remote holiday party?",
    a: "Start in July or August if you want first choice of December dates. At minimum, book the host or platform by September or October.",
  },
];

export default function HowToPlanARemoteOfficeHolidayParty() {
  return (
    <main className="flex flex-col min-h-screen bg-brand-dark">
      <article className="py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 text-xs text-zinc-500 mb-8">
            <Link href="/blog" className="hover:text-zinc-300 transition-colors">Blog</Link>
            <span>/</span>
            <span className="text-zinc-400">Remote Office Holiday Party Planning</span>
          </div>

          <span className="inline-flex mb-6 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border text-amber-400 border-amber-500/30 bg-amber-500/10">
            Planning Guide
          </span>

          <h1 className="text-3xl sm:text-5xl font-extrabold text-white leading-tight mb-6">
            How to Plan a Remote Office Holiday Party: Step-by-Step Guide
          </h1>

          <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500 mb-10 border-b border-white/5 pb-8">
            <span className="flex items-center gap-1.5"><User className="h-3.5 w-3.5" /> Teamtastic Events Team</span>
            <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> July 9, 2026</span>
            <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> 9 min read</span>
          </div>

          <div className="space-y-5 text-zinc-400 leading-relaxed mb-12">
            <p className="text-lg text-zinc-300">
              A remote office holiday party has to be planned more deliberately than an in-person event. You cannot rely on food, music, and room energy to carry the experience.
            </p>
            <p>
              The good news: a simple structure does most of the work. Use this timeline to move from &quot;we should do something&quot; to a real event your team will remember.
            </p>
          </div>

          <section className="space-y-4 mb-14">
            {steps.map(([title, desc], index) => (
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
            <h2 className="text-2xl font-extrabold text-white">Sample 60-Minute Agenda</h2>
            <p className="text-zinc-400">0-5 minutes: welcome and tech check. 5-10 minutes: quick leader toast. 10-50 minutes: hosted holiday game show. 50-55 minutes: winners and awards. 55-60 minutes: screenshots, shoutouts, and close.</p>
            <p className="text-zinc-400">For larger teams, use team captains and shared answers. For quieter groups, use more trivia, music, and survey rounds so people can participate without solo performance.</p>
          </section>

          <section className="glassmorphism rounded-2xl p-8 border border-purple-500/20 bg-purple-500/5 mb-14">
            <h2 className="text-2xl font-extrabold text-white mb-3">Want the Planning Handled?</h2>
            <p className="text-zinc-400 mb-6">
              Teamtastic can host the holiday game, build custom rounds, keep the energy moving, and help you lock a December date with a $200 deposit.
            </p>
            <Link href="/virtual-holiday-party" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 transition-all">
              Check Holiday Availability <ArrowRight className="h-4 w-4" />
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
