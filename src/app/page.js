import Hero from "@/components/Hero";
import GameQuiz from "@/components/GameQuiz";
import SoloDemo from "@/components/SoloDemo";
import Pricing from "@/components/Pricing";
import { Gamepad2, Sparkles, Users, Award, ArrowRight, Zap, Target, Music } from "lucide-react";
import Link from "next/link";

const homeFaqs = [
  { question: "Do players need to download anything?", answer: "No. Teamtastic runs in a web browser and works alongside Zoom, Microsoft Teams, Google Meet, or Webex." },
  { question: "How many people can participate?", answer: "Live-hosted events support groups from small teams to 300 or more participants." },
  { question: "Can Teamtastic customize an event?", answer: "Yes. Events can include company trivia, inside jokes, branded visuals, team names, music, and custom awards." },
  { question: "How much does a live-hosted event cost?", answer: "Live-hosted events start at $35 per person, with a $350 minimum for groups up to 10." },
];

const games = [
  {
    title: "Lightning Feud",
    desc: "A rapid-fire buzz-in battle of corporate culture, general trivia, and quick logical associations. Led by your master emcee.",
    players: "8 - 200+",
    time: "60 min",
    badge: "High Energy",
    color: "from-purple-500/20 to-purple-600/10 border-purple-500/30 hover:border-purple-500/40 hover:shadow-[0_0_30px_rgba(124,58,237,0.15)]",
    icon: Zap,
    slug: "lightning-feud",
  },
  {
    title: "Survey Showdown",
    desc: "Teams buzz in to guess the most popular answers to hilarious survey questions. Think Family Feud, but custom-styled for corporate cultures.",
    players: "10 - 250+",
    time: "60 min",
    badge: "Competitive",
    color: "from-red-500/20 to-rose-600/10 border-red-500/30 hover:border-red-500/40 hover:shadow-[0_0_30px_rgba(239,68,68,0.15)]",
    icon: Target,
    slug: "survey-showdown",
  },
  {
    title: "Pitch Perfect",
    desc: "A high-energy creative workshop where teammates draft hilarious taglines and pitches for outrageous products, competing for the top spot.",
    players: "6 - 200+",
    time: "60 min",
    badge: "Creative",
    color: "from-pink-500/20 to-fuchsia-600/10 border-pink-500/30 hover:border-pink-500/40 hover:shadow-[0_0_30px_rgba(236,72,153,0.15)]",
    icon: Gamepad2,
    slug: "pitch-perfect",
  },
  {
    title: "The Spotlight",
    desc: "A real-time social interactive wall. Share live photos, custom stories, emoji highlights, and team milestones on a gorgeous dynamic presentation feed.",
    players: "10 - 300+",
    time: "60 min",
    badge: "Collaborative",
    color: "from-amber-600/20 to-orange-700/10 border-orange-500/30 hover:border-orange-500/40 hover:shadow-[0_0_30px_rgba(217,119,6,0.15)]",
    icon: Sparkles,
    slug: "the-spotlight",
  },
  {
    title: "Online Office Games",
    desc: "The ultimate virtual sampler. Challenge your team with rapid icebreakers, interactive scavengers, and quick-fire trivia pacing curated by a live host.",
    players: "12 - 250+",
    time: "75 min",
    badge: "High Energy",
    color: "from-emerald-500/20 to-teal-600/10 border-emerald-500/30 hover:border-emerald-500/40 hover:shadow-[0_0_30px_rgba(16,185,129,0.15)]",
    icon: Users,
    slug: "online-office-games",
  },
  {
    title: "Tiny Campfire",
    desc: "Cozy up with curated acoustic music, guided virtual campfire challenges, storytelling, and custom-shipped gourmet s'mores kits for the ultimate warm vibe.",
    players: "8 - 150+",
    time: "60 min",
    badge: "Chill",
    color: "from-cyan-500/20 to-blue-600/10 border-cyan-500/30 hover:border-cyan-500/40 hover:shadow-[0_0_30px_rgba(6,182,212,0.15)]",
    icon: Music,
    slug: "tiny-campfire",
  },
];

const useCases = [
  {
    title: "HR & People Operations",
    hook: "Host a premium team event in under 5 minutes with zero stress.",
    desc: "Fostering distributed remote culture is hard. Prevent team silo-ing, reduce hybrid burnouts, and raise team engagement scores with premium game shows that feel like actual parties.",
    badge: "Culture & Retention",
    color: "from-purple-500 to-pink-500",
    slug: "hr-and-people-ops",
  },
  {
    title: "Remote Engineering Teams",
    hook: "Low-stress, highly interactive logic games built for tech-savvy squads.",
    desc: "Traditional virtual icebreakers feel forced or awkward for tech teams. Our puzzle-solving, drawing escape chambers are designed to engage logical minds without forced social pressure.",
    badge: "High-Logic Bonding",
    color: "from-orange-500 to-amber-500",
    slug: "remote-engineering-teams",
  },
  {
    title: "Virtual Intern Cohorts",
    hook: "Accelerate trust and create shared virtual memories fast.",
    desc: "Help your remote interns bond instantly. We run fast-paced buzzed check-ins and cooperative drawing canvases that dissolve corporate ice in minutes.",
    badge: "Rapid Trust-Building",
    color: "from-cyan-500 to-blue-500",
    slug: "virtual-intern-cohorts",
  },
  {
    title: "Private VIP Socials",
    hook: "Bring the ultimate live game show host to your social circle.",
    desc: "Beyond B2B, you can secure our founder personally as a live emcee for virtual milestone birthdays, family reunions, and high-end retirement celebrations.",
    badge: "Milestone Parties",
    color: "from-emerald-500 to-teal-500",
    slug: "private-vip-socials",
  },
];

export default function Home() {
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Teamtastic",
      url: "https://teamtastic.events",
      logo: "https://teamtastic.events/logo.png",
    },
    {
      "@context": "https://schema.org",
      "@type": "Service",
      name: "Virtual Team Building Games",
      serviceType: "Live-hosted virtual team building events",
      provider: { "@type": "Organization", name: "Teamtastic", url: "https://teamtastic.events" },
      areaServed: "Worldwide",
      offers: { "@type": "Offer", price: "35", priceCurrency: "USD", description: "$35 per person with a $350 minimum" },
      review: {
        "@type": "Review",
        author: { "@type": "Person", name: "Leah McCord" },
        reviewBody: "The energy was amazing. Everyone was engaged and involved.",
        reviewRating: { "@type": "Rating", ratingValue: "5", bestRating: "5" },
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: homeFaqs.map(({ question, answer }) => ({
        "@type": "Question",
        name: question,
        acceptedAnswer: { "@type": "Answer", text: answer },
      })),
    },
  ];

  return (
    <div className="flex flex-col min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
      />
      <main className="flex-1">
        {/* Dynamic Mock Stage Hero */}
        <Hero />

        {/* B2B Stats Banner */}
        <section className="py-8 bg-zinc-950/60 border-y border-white/5 backdrop-blur-md">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              <div className="space-y-1">
                <span className="text-3xl font-extrabold text-white">40k+</span>
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Active Players</p>
              </div>
              <div className="space-y-1">
                <span className="text-3xl font-extrabold text-purple-400">98%</span>
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Engagement Score</p>
              </div>
              <div className="space-y-1">
                <span className="text-3xl font-extrabold text-pink-400">1,200+</span>
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Lobbies Launched</p>
              </div>
              <div className="space-y-1">
                <span className="text-3xl font-extrabold text-amber-400">0</span>
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Downloads Required</p>
              </div>
            </div>
          </div>
        </section>

        {/* Dynamic Activity catalog grid */}
        <section id="games" className="py-20 md:py-28 relative">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center space-y-4 mb-16">
              <h2 className="text-3xl font-extrabold tracking-tight sm:text-5xl text-white">
                Our Game Catalog
              </h2>
              <p className="text-zinc-400 max-w-lg mx-auto text-base">
                Discover our high-energy virtual social formats. Built for corporate scaling, true team scoring, and massive laughter.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mx-auto">
              {games.map((g) => (
                <div
                  key={g.title}
                  className={`glassmorphism rounded-3xl p-8 flex flex-col justify-between border hover:border-purple-500/30 transition-all duration-300 hover:-translate-y-1 group bg-gradient-to-br ${g.color}`}
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex px-3 py-1 bg-black/40 border border-white/10 text-white text-[10px] font-bold uppercase tracking-wider rounded-full">
                        {g.badge}
                      </span>
                      <g.icon className="h-6 w-6 text-purple-400 group-hover:scale-110 transition-transform" />
                    </div>
                    <h3 className="text-2xl font-bold text-white group-hover:text-purple-300 transition-colors">
                      {g.title}
                    </h3>
                    <p className="text-sm text-zinc-400 leading-relaxed min-h-[64px]">
                      {g.desc}
                    </p>
                  </div>

                  <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between">
                    <div className="flex gap-6">
                      <div className="text-left">
                        <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-500 block">Squad size</span>
                        <span className="text-xs font-semibold text-zinc-300">{g.players} players</span>
                      </div>
                      <div className="text-left">
                        <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-500 block">Duration</span>
                        <span className="text-xs font-semibold text-zinc-300">{g.time}</span>
                      </div>
                    </div>
                    <Link
                      href={`/games/${g.slug}`}
                      className="inline-flex items-center gap-1 text-xs font-bold text-purple-400 hover:text-white transition-colors group/link"
                    >
                      Learn More
                      <ArrowRight className="h-3 w-3 group-hover/link:translate-x-0.5 transition-transform" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>

            {/* Highly Polished Glowing CTA Button */}
            <div className="mt-16 text-center">
              <Link
                href="/games"
                className="relative inline-flex items-center gap-2.5 px-8 py-4 rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-[0_0_20px_rgba(139,92,246,0.3)] hover:shadow-[0_0_30px_rgba(236,72,153,0.6)] hover:scale-[1.03] active:scale-95 transition-all duration-300 group"
              >
                <span>View All 50+ Games</span>
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </section>

        {/* B2B Use cases section */}
        <section id="use-cases" className="py-20 md:py-28 bg-zinc-950/40 border-y border-white/5">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center space-y-4 mb-16">
              <h2 className="text-3xl font-extrabold tracking-tight sm:text-5xl text-white">
                Tailored B2B Experiences
              </h2>
              <p className="text-zinc-400 max-w-lg mx-auto text-base">
                Different teams have different vibes. We align our gameshow mechanics, pacing, and MC style to match your objectives.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mx-auto">
              {useCases.map((uc) => (
                <div
                  key={uc.title}
                  className="glassmorphism rounded-3xl p-8 border border-white/5 hover:border-white/10 transition-all duration-300 flex flex-col justify-between"
                >
                  <div className="space-y-4">
                    <span className={`inline-flex px-3 py-1 bg-gradient-to-r ${uc.color} text-white text-[10px] font-bold uppercase tracking-wider rounded-full`}>
                      {uc.badge}
                    </span>
                    <h3 className="text-2xl font-bold text-white">{uc.title}</h3>
                    <p className="text-sm font-semibold text-purple-300 italic">
                      &ldquo;{uc.hook}&rdquo;
                    </p>
                    <p className="text-sm text-zinc-400 leading-relaxed">
                      {uc.desc}
                    </p>
                  </div>

                  <div className="mt-8 pt-6 border-t border-white/5">
                    <Link
                      href={`/use-cases/${uc.slug}`}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-white hover:text-purple-300 transition-colors"
                    >
                      See Custom Offerings
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Interactive Playable Solo Demo */}
        <section className="py-20 bg-zinc-950/20 border-t border-white/5">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center space-y-4 mb-12">
              <h2 className="text-3xl font-extrabold tracking-tight sm:text-5xl text-white">
                Experience the Gameplay
              </h2>
              <p className="text-zinc-400 max-w-lg mx-auto text-base">
                Try our playable mini-quiz to see how we sync animations, reaction triggers, and scoring to wow remote teams.
              </p>
            </div>
            <SoloDemo />
          </div>
        </section>

        {/* Interactive Event Planner Quiz */}
        <GameQuiz />

        {/* SaaS & VIP Hosted Monetization Pricing */}
        <Pricing />
      </main>
    </div>
  );
}
