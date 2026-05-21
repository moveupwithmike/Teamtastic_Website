import Link from "next/link";
import { ArrowRight, Clock, User, Calendar, CheckCircle } from "lucide-react";

export const metadata = {
  title: "How to Boost Remote Employee Engagement in 2025 | Teamtastic",
  description:
    "Remote employee engagement is declining globally. Here are the proven HR strategies — including live virtual events — that leading remote-first companies use to keep teams connected and motivated.",
  openGraph: {
    title: "How to Boost Remote Employee Engagement in 2025",
    url: "https://teamtastic.events/blog/remote-team-engagement-tips",
  },
};

const tips = [
  {
    title: "Prioritize Structured Social Time",
    desc: "Unstructured \"optional\" social hours rarely work. Schedule dedicated team social time with a clear format — a game, a quiz, a shared experience. Structure removes the awkwardness of open-ended hangouts.",
  },
  {
    title: "Make Events High-Energy by Default",
    desc: "Passive activities (watch parties, meditation sessions) engage a narrow audience. High-energy interactive formats — trivia battles, game shows, creative challenges — engage almost everyone regardless of personality type.",
  },
  {
    title: "Use a Professional Facilitator",
    desc: "The single biggest predictor of virtual event success is the quality of facilitation. A skilled emcee or host removes the awkward silences, reads the room, and maintains energy throughout the entire session.",
  },
  {
    title: "Celebrate Wins Loudly and Publicly",
    desc: "Remote workers miss the organic 'office buzz' of seeing colleagues succeed. Create deliberate digital spaces — Slack channels, all-hands shoutouts, or team newsletters — to amplify individual and team wins.",
  },
  {
    title: "Invest in Async Connection Tools",
    desc: "Not all engagement happens in live sessions. Loom video updates, virtual water cooler Slack channels, and collaborative Notion boards give remote workers touchpoints outside of scheduled meetings.",
  },
  {
    title: "Measure and Iterate",
    desc: "Send a 2-question engagement survey after every team event: 'How energized did you feel after this event? (1-10)' and 'Would you attend this again? (Yes/No)'. Track the data quarter-over-quarter and adjust your event mix accordingly.",
  },
];

export default function RemoteEngagementTips() {
  return (
    <main className="flex flex-col min-h-screen bg-brand-dark">
      <article className="py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 text-xs text-zinc-500 mb-8">
            <Link href="/blog" className="hover:text-zinc-300 transition-colors">Blog</Link>
            <span>/</span>
            <span className="text-zinc-400">Remote Engagement Tips</span>
          </div>

          <div className="mb-6">
            <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border text-emerald-400 border-emerald-500/30 bg-emerald-500/10">
              HR & Culture
            </span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold text-white leading-tight mb-6">
            How to Boost Remote Employee Engagement in 2025
          </h1>

          <div className="flex items-center gap-6 text-xs text-zinc-500 mb-10 border-b border-white/5 pb-8">
            <span className="flex items-center gap-1.5"><User className="h-3.5 w-3.5" /> Teamtastic Events Team</span>
            <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> May 8, 2025</span>
            <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> 9 min read</span>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-12">
            {[
              { stat: "76%", label: "of remote workers feel isolated at least sometimes" },
              { stat: "44%", label: "say lack of in-person interaction is the biggest downside of remote work" },
              { stat: "3×", label: "higher retention at companies that invest in team building" },
            ].map(({ stat, label }) => (
              <div key={stat} className="glassmorphism rounded-2xl p-4 border border-white/5 text-center">
                <span className="text-2xl font-extrabold text-purple-400 block">{stat}</span>
                <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">{label}</p>
              </div>
            ))}
          </div>

          <div className="space-y-4 mb-12">
            <p className="text-lg text-zinc-300 leading-relaxed">
              Remote work offers incredible flexibility — but it comes with a hidden cost. Without the organic social infrastructure of an office, distributed teams gradually lose connection, and disengagement quietly spreads.
            </p>
            <p className="text-zinc-400 leading-relaxed">
              The HR leaders solving this problem aren&apos;t throwing more Zoom happy hours at it. They&apos;re investing in high-quality structured experiences that create genuine shared memories for distributed employees.
            </p>
          </div>

          <h2 className="text-2xl font-extrabold text-white mb-6">6 Strategies That Actually Work</h2>
          <div className="space-y-5 mb-12">
            {tips.map((tip, i) => (
              <div key={tip.title} className="glassmorphism rounded-2xl p-6 border border-white/5">
                <div className="flex items-start gap-4">
                  <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-bold text-white mb-2">{String(i + 1)}. {tip.title}</h3>
                    <p className="text-sm text-zinc-400 leading-relaxed">{tip.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="glassmorphism rounded-2xl p-8 border border-purple-500/20 bg-purple-500/5 mb-10">
            <h3 className="text-xl font-bold text-white mb-3">The Teamtastic Approach</h3>
            <p className="text-sm text-zinc-400 leading-relaxed mb-5">
              Teamtastic is built specifically around the research on what drives remote engagement: structured social time, high-energy facilitation, real-time competition, and shared experiences that create genuine memories. Our live-hosted game shows consistently deliver 90%+ satisfaction scores from remote participants.
            </p>
            <Link
              href="/#quiz"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 transition-all"
            >
              Get a Custom Event Recommendation <ArrowRight className="h-4 w-4" />
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
            headline: "How to Boost Remote Employee Engagement in 2025",
            datePublished: "2025-05-08",
            author: { "@type": "Organization", name: "Teamtastic Events" },
            publisher: { "@type": "Organization", name: "Teamtastic", url: "https://teamtastic.events" },
          }),
        }}
      />
    </main>
  );
}
