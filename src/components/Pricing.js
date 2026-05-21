import { Sparkles, Check, Calendar, MessageCircle, Zap } from "lucide-react";
import Link from "next/link";

const tiers = [
  {
    name: "Self-Service Arcade",
    price: "Free",
    period: "forever",
    description: "Launch a game lobby instantly and test our standard games with your immediate team. No credit card, no account required for players.",
    features: [
      "Up to 10 players per lobby",
      "Standard trivia & puzzle games",
      "Host Dashboard access",
      "No account required for players",
      "Community support",
    ],
    cta: "Launch Free Lobby",
    href: "https://teamtastic.games",
    external: true,
    popular: false,
    gradient: "from-zinc-900 to-zinc-950 border-white/5",
    buttonStyle: "bg-white/5 hover:bg-white/10 text-white border border-white/10",
    badge: null,
  },
  {
    name: "Professional Package",
    price: "Custom",
    period: "per quote",
    description: "Supercharge your team socials with premium games, custom branding, and recurring hosted sessions. Pricing tailored to your team size and frequency.",
    features: [
      "Up to 200 players per lobby",
      "All premium games (Escape Rooms, Meme Battle, Sound Bite)",
      "Custom logo & brand colors injected",
      "Custom question packs per event",
      "Monthly recurring events support",
      "Priority email & phone support",
    ],
    cta: "Get a Custom Quote",
    href: "/#quiz",
    external: false,
    popular: true,
    gradient: "from-purple-950/20 to-black border-purple-500/30",
    buttonStyle: "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-lg shadow-purple-500/20",
    badge: "Most Popular",
  },
  {
    name: "VIP Hosted Event",
    price: "Custom",
    period: "per event",
    description: "Go first-class with our founder as your dedicated live Master Emcee. Perfect for large corporate events, holiday parties, and milestone celebrations.",
    features: [
      "50–500+ active players",
      "Dedicated live Master Emcee",
      "Fully custom thematic question packs",
      "Pre-event consultation & run-through",
      "Structured corporate invoicing (PO friendly)",
      "Dedicated Slack/Phone event support",
    ],
    cta: "Request MC + Quote",
    href: "/#quiz",
    external: false,
    popular: false,
    gradient: "from-amber-950/10 to-zinc-950 border-amber-500/20",
    buttonStyle: "bg-white/5 hover:bg-white/10 text-white border border-white/10",
    badge: null,
  },
];

export default function Pricing() {
  return (
    <section id="pricing" className="py-20 md:py-28 relative">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-pink-900/10 via-zinc-950 to-zinc-950" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center space-y-4 mb-16">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-pink-500/30 bg-pink-500/10 px-4 py-1.5 text-xs font-semibold text-pink-300">
            <Zap className="h-3 w-3" />
            Flexible Pricing — Built Around Your Team
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-5xl text-white">
            Every Team Size, Every Budget
          </h2>
          <p className="text-zinc-400 max-w-lg mx-auto text-base">
            From a quick free game with your squad to a fully produced corporate game show with a live emcee — we have a package for every occasion.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch max-w-5xl mx-auto">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`relative rounded-3xl p-8 flex flex-col justify-between border backdrop-blur-md shadow-xl transition-all duration-300 hover:-translate-y-1 bg-gradient-to-b ${tier.gradient}`}
            >
              {/* Popular Badge */}
              {tier.badge && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10 px-4 py-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold uppercase tracking-wider rounded-full shadow-md flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-amber-300" />
                  {tier.badge}
                </div>
              )}

              {/* Header */}
              <div className="space-y-4">
                <span className="text-sm font-bold uppercase tracking-wider text-zinc-400">
                  {tier.name}
                </span>
                <div className="flex items-baseline gap-1 pt-2">
                  <span className="text-4xl md:text-5xl font-extrabold text-white">
                    {tier.price}
                  </span>
                  <span className="text-sm font-semibold text-zinc-500">/ {tier.period}</span>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed min-h-[60px]">
                  {tier.description}
                </p>
              </div>

              <hr className="border-white/5 my-6" />

              {/* Features */}
              <div className="flex-1">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 block mb-4">
                  What&apos;s Included
                </span>
                <ul className="space-y-3">
                  {tier.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-3">
                      <div className="mt-1 h-4 w-4 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
                        <Check className="h-2.5 w-2.5" />
                      </div>
                      <span className="text-xs text-zinc-300 font-medium leading-normal">{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* CTA */}
              <div className="pt-8">
                {tier.external ? (
                  <a
                    href={tier.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`w-full flex h-12 items-center justify-center rounded-xl text-sm font-bold transition-all ${tier.buttonStyle}`}
                  >
                    {tier.cta}
                  </a>
                ) : (
                  <Link
                    href={tier.href}
                    className={`w-full flex h-12 items-center justify-center rounded-xl text-sm font-bold transition-all ${tier.buttonStyle}`}
                  >
                    {tier.cta}
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Trust Note */}
        <div className="mt-16 text-center space-y-3">
          <p className="text-xs text-zinc-500 flex items-center justify-center gap-2">
            <Calendar className="h-4 w-4 text-purple-400" />
            All custom packages include a free 15-minute consultation call.{" "}
            <Link href="/#quiz" className="font-semibold text-zinc-300 hover:text-white underline transition-colors">
              Start with our event quiz.
            </Link>
          </p>
          <p className="text-xs text-zinc-600 flex items-center justify-center gap-2">
            <MessageCircle className="h-3.5 w-3.5" />
            Works with Zoom, Microsoft Teams, Google Meet, Webex & any browser — no downloads required.
          </p>
        </div>
      </div>
    </section>
  );
}
