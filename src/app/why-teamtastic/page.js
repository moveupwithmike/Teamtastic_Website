import Link from "next/link";
import { ArrowRight, Check, X, Star, Users, Zap, Shield, Heart } from "lucide-react";

export const metadata = {
  title: "Why Choose Teamtastic for Virtual Team Building | Teamtastic",
  description:
    "See why HR leaders, engineering teams, and event planners choose Teamtastic over Jackbox, Kahoot, and generic team building platforms. Real results, real energy.",
  openGraph: {
    title: "Why Teamtastic | The #1 Virtual Team Building Platform",
    description:
      "Teamtastic beats generic trivia platforms and expensive event agencies. See our competitive advantage and meet the Master Emcee behind the magic.",
    url: "https://teamtastic.events/why-teamtastic",
  },
};

const competitors = [
  {
    feature: "Professional live emcee option",
    teamtastic: true,
    jackbox: false,
    kahoot: false,
    hooray: true,
    weve: true,
  },
  {
    feature: "Zero-download browser play",
    teamtastic: true,
    jackbox: false,
    kahoot: true,
    hooray: false,
    weve: false,
  },
  {
    feature: "Custom corporate question packs",
    teamtastic: true,
    jackbox: false,
    kahoot: true,
    hooray: true,
    weve: true,
  },
  {
    feature: "Custom brand colors & logo",
    teamtastic: true,
    jackbox: false,
    kahoot: true,
    hooray: true,
    weve: true,
  },
  {
    feature: "Self-service free tier",
    teamtastic: true,
    jackbox: false,
    kahoot: true,
    hooray: false,
    weve: false,
  },
  {
    feature: "Scales to 500+ players",
    teamtastic: true,
    jackbox: false,
    kahoot: true,
    hooray: true,
    weve: true,
  },
  {
    feature: "Real-time team scoring",
    teamtastic: true,
    jackbox: true,
    kahoot: true,
    hooray: true,
    weve: false,
  },
  {
    feature: "B2B invoicing / PO support",
    teamtastic: true,
    jackbox: false,
    kahoot: false,
    hooray: true,
    weve: true,
  },
  {
    feature: "Instant lobby (< 60 seconds)",
    teamtastic: true,
    jackbox: false,
    kahoot: true,
    hooray: false,
    weve: false,
  },
];

const reasons = [
  {
    icon: Zap,
    title: "Zero Friction. Instant Play.",
    desc: "No app stores. No IT tickets. No player sign-ups. Your team joins with a single link in under 60 seconds — from any device, any browser, any conferencing platform.",
    color: "text-purple-400",
  },
  {
    icon: Star,
    title: "The Emcee Makes the Difference.",
    desc: "Unlike platforms that hand you a deck of slides and wish you luck, our Master Emcee transforms your event into a live gameshow. Professional timing, corporate-appropriate humor, and expert crowd management.",
    color: "text-amber-400",
  },
  {
    icon: Users,
    title: "Built for Teams, Not Just Players.",
    desc: "True team-mode scoring, cross-functional tournament brackets, and collaborative games that reward communication — not just trivia speed.",
    color: "text-emerald-400",
  },
  {
    icon: Shield,
    title: "Enterprise-Ready.",
    desc: "PO-friendly invoicing, custom brand theming, NDAs on request, and a dedicated support line. We speak corporate — so your EA doesn't have to fight the platform.",
    color: "text-sky-400",
  },
  {
    icon: Heart,
    title: "People Actually Look Forward to It.",
    desc: "The highest compliment we receive: \u0022Can we do another one?\u0022 Our events don\u0027t feel like mandatory fun \u2014 they feel like actual parties.",
    color: "text-pink-400",
  },
];

const testimonials = [
  {
    quote: "We've tried Jackbox, Kahoot, and random event agencies. Nothing came close to what Teamtastic delivered. Our team is still talking about it three weeks later.",
    name: "Priya M.",
    title: "Head of People Ops",
    company: "Series B SaaS company, 180 employees",
    avatar: "P",
    color: "from-purple-500 to-pink-500",
  },
  {
    quote: "As an EA, I've organized a lot of company events. The Teamtastic quiz + booking flow was genuinely the easiest vendor experience I've ever had. Done in 10 minutes.",
    name: "Rachel T.",
    title: "Executive Assistant",
    company: "Fortune 500 consulting firm",
    avatar: "R",
    color: "from-emerald-500 to-teal-500",
  },
  {
    quote: "Our engineering team hates forced fun. They loved this. The logic puzzles and competitive trivia hit differently when there's a real emcee driving the energy.",
    name: "James K.",
    title: "VP of Engineering",
    company: "Remote-first fintech startup",
    avatar: "J",
    color: "from-amber-500 to-orange-500",
  },
];

export default function WhyTeamtastic() {
  return (
    <main className="flex flex-col min-h-screen bg-brand-dark">
      {/* Hero */}
      <section className="relative pt-24 pb-20 overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-900/20 via-zinc-950 to-zinc-950" />
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs font-semibold text-amber-300">
            <Star className="h-3 w-3" />
            Trusted by HR leaders at growing companies
          </div>
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight">
            Why Teams Choose{" "}
            <span className="text-brand-purple">Teamtastic</span>
          </h1>
          <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
            There are dozens of virtual team building options. Here&apos;s why HR directors, engineering managers, and executive assistants at remote-first companies consistently come back to Teamtastic.
          </p>
          <Link
            href="/#quiz"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-base font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-[0_0_25px_rgba(139,92,246,0.4)] transition-all duration-300 hover:-translate-y-1"
          >
            Book Your First Event
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>

      {/* 5 Reasons */}
      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white">5 Reasons Teamtastic Wins</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {reasons.map(({ icon: Icon, title, desc, color }) => (
              <div key={title} className="glassmorphism rounded-2xl p-6 border border-white/5 hover:border-white/10 hover:-translate-y-1 transition-all duration-300">
                <Icon className={`h-8 w-8 ${color} mb-4`} />
                <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{desc}</p>
              </div>
            ))}
            {/* Spanning CTA card */}
            <div className="glassmorphism rounded-2xl p-6 border border-purple-500/20 bg-purple-500/5 flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-bold text-white mb-2">See it yourself in 60 seconds</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">Launch a free lobby instantly. No credit card, no commitment — just the game.</p>
              </div>
              <a
                href="https://teamtastic.games"
                className="mt-6 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 transition-all"
              >
                Try Free Now <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="py-20 bg-zinc-950/40 border-y border-white/5">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-4 mb-12">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white">How We Compare</h2>
            <p className="text-zinc-400 max-w-lg mx-auto">Teamtastic vs. the most common alternatives</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-4 px-4 text-zinc-400 font-semibold w-1/3">Feature</th>
                  <th className="py-4 px-3 text-white font-bold text-center">
                    <span className="inline-block px-3 py-1 bg-purple-600 rounded-lg text-xs">Teamtastic</span>
                  </th>
                  <th className="py-4 px-3 text-zinc-500 font-medium text-center text-xs">Jackbox</th>
                  <th className="py-4 px-3 text-zinc-500 font-medium text-center text-xs">Kahoot!</th>
                  <th className="py-4 px-3 text-zinc-500 font-medium text-center text-xs">Hooray</th>
                  <th className="py-4 px-3 text-zinc-500 font-medium text-center text-xs">Weve</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {competitors.map((row) => (
                  <tr key={row.feature} className="hover:bg-white/2 transition-colors">
                    <td className="py-3.5 px-4 text-zinc-300">{row.feature}</td>
                    {[row.teamtastic, row.jackbox, row.kahoot, row.hooray, row.weve].map((val, i) => (
                      <td key={i} className="py-3.5 px-3 text-center">
                        {val ? (
                          <Check className={`h-4 w-4 mx-auto ${i === 0 ? "text-purple-400" : "text-zinc-500"}`} />
                        ) : (
                          <X className="h-4 w-4 mx-auto text-zinc-700" />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white">What Our Clients Say</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div key={t.name} className="glassmorphism rounded-2xl p-6 border border-white/5 flex flex-col justify-between">
                <p className="text-sm text-zinc-300 leading-relaxed italic mb-6">&ldquo;{t.quote}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-full bg-gradient-to-br ${t.color} flex items-center justify-center text-white font-bold text-sm shrink-0`}>
                    {t.avatar}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{t.name}</p>
                    <p className="text-xs text-zinc-500">{t.title}</p>
                    <p className="text-xs text-zinc-600">{t.company}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-zinc-950/40 border-y border-white/5">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <h2 className="text-3xl font-extrabold text-white">Ready to Experience the Difference?</h2>
          <p className="text-zinc-400">Get a custom event recommendation in 2 minutes with our free Event Quiz.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/#quiz"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-base font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-[0_0_25px_rgba(139,92,246,0.4)] transition-all duration-300 hover:-translate-y-1"
            >
              Get a Custom Quote <ArrowRight className="h-5 w-5" />
            </Link>
            <a
              href="https://teamtastic.games"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-base font-bold text-zinc-200 border border-white/10 bg-white/5 hover:bg-white/10 transition-all duration-300 hover:-translate-y-1"
            >
              Try Free First
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
