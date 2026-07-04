"use client";

import { useState, useMemo } from "react";
import { 
  Sparkles, 
  Check, 
  Calendar, 
  MessageCircle, 
  Zap, 
  ArrowRight, 
  Smile, 
  Users, 
  Clock, 
  Award, 
  Gift, 
  Palette, 
  Volume2, 
  Music, 
  PartyPopper,
  HelpCircle,
  TrendingUp
} from "lucide-react";
import Link from "next/link";
import { track } from "@/lib/analytics";
import { HOSTED_PRICING } from "@/lib/pricing";

const tiers = [
  {
    name: "Self-Service Arcade",
    price: "$0",
    unit: "free",
    blurb: "Small teams (≤ 10), one-off test sessions.",
    features: [
      "Full access to 5+ quick-start games",
      "Up to 10 players per lobby",
      "Browser-based play (no downloads)",
      "Self-hosted (you run the show)",
      "Instant launch from any device",
      "Basic scoring and web game boards"
    ],
    cta: "Launch Free Lobby",
    href: "https://teamtastic.games",
    highlight: false,
    gradient: "from-zinc-900 to-zinc-950 border-white/5",
    buttonStyle: "bg-white/5 hover:bg-white/10 text-white border border-white/10",
  },
  {
    name: "Professional Host",
    price: "Custom",
    unit: "quote",
    blurb: "Companies running regular events (monthly) or team socials.",
    features: [
      "Professional MC host (100% live-hosted)",
      "Full catalog of 50+ games & templates",
      "Live scoreboards, music & virtual confetti",
      "Custom brand themes, colors & company logos",
      "Custom tailored questions & inside jokes",
      "Pre-event coordination & support"
    ],
    cta: "Request a Quote",
    href: "/#quiz",
    highlight: true,
    gradient: "from-purple-950/20 to-black border-purple-500/30 shadow-[0_0_30px_rgba(139,92,246,0.15)]",
    buttonStyle: "bg-gradient-to-r from-brand-purple to-brand-pink hover:from-brand-purple/90 hover:to-brand-pink/90 text-white shadow-lg shadow-brand-purple/20",
    badge: "Most Popular",
  },
  {
    name: "VIP Hosted Event",
    price: "Custom",
    unit: "quote",
    blurb: "Large corporate events 50–500+ players.",
    features: [
      "Senior Master Emcee (Founder level option)",
      "Dedicated white-glove event planner",
      "Custom themed presentation slides",
      "Tailored gamified onboarding & milestones",
      "Priority scheduling & calendar locks",
      "Structured B2B corporate billing (PO friendly)"
    ],
    cta: "Request MC + Quote",
    href: "/#quiz",
    highlight: false,
    gradient: "from-amber-950/10 to-zinc-950 border-amber-500/20",
    buttonStyle: "bg-white/5 hover:bg-white/10 text-white border border-white/10",
  },
];

const addOnsList = [
  {
    icon: Gift,
    iconColor: "text-orange-400",
    title: "Snack or Prop Kits",
    text: "+$25–$40 per person. Ship physical custom packages straight to players' doorsteps to physicalize the vibe.",
  },
  {
    icon: Award,
    iconColor: "text-brand-gold",
    title: "Awards Ceremony",
    text: "+$250. Custom virtual slides, digital trophies, and comedic superlative awards to end the show with a bang.",
  },
  {
    icon: Sparkles,
    iconColor: "text-pink-400",
    title: "Premium Host Upgrade",
    text: "+$300. Upgrade to a senior comedically-trained Master Emcee to guarantee maximum team laughter and pacing.",
  },
  {
    icon: Palette,
    iconColor: "text-cyan-400",
    title: "Custom Content Build",
    text: "Custom quote based on scope. Add branded questions, inside jokes, themed rounds, visuals, and presentation content.",
  },
  {
    icon: Clock,
    iconColor: "text-emerald-400",
    title: "Extra Time (+30 Mins)",
    text: "+$150. Extend your session for additional mini-games, longer social wrap-ups, and more dynamic connection.",
  },
];

const reviews = [
  {
    quote: "Michael kept 80 people laughing and engaged the entire time. It wasn't just a game — it was an experience.",
    name: "HR Manager",
    role: "Tech Startup",
  },
  {
    quote: "The leaderboard + music + confetti combo? Instant energy boost for our remote team.",
    name: "People Ops Director",
    role: "FinTech",
  },
  {
    quote: "Our CEO asked for a replay — that's all you need to know.",
    name: "Executive Assistant",
    role: "Marketing Agency",
  },
];

export default function Pricing() {
  const [players, setPlayers] = useState(25);
  const [packageType, setPackageType] = useState("core");
  const [addOns, setAddOns] = useState({
    kits: false,
    awards: false,
    premiumHost: false,
    customTheme: false,
    extraTime: false,
  });

  const estimatedTotal = useMemo(() => {
    const perPerson = packageType === "core"
      ? HOSTED_PRICING.corePerPerson
      : HOSTED_PRICING.premiumPerPerson;
    let base = Math.max(players * perPerson, HOSTED_PRICING.minimum);

    if (addOns.kits) base += players * 30; // kits: +$30/pp
    if (addOns.awards) base += 250;       // awards: +$250
    if (addOns.premiumHost) base += 300;  // premiumHost: +$300
    if (addOns.extraTime) base += 150;    // extraTime: +$150

    return base;
  }, [players, packageType, addOns]);

  const toggleAddOn = (key) => {
    setAddOns((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const saveEstimatorContext = () => {
    try {
      sessionStorage.setItem("teamtastic_estimator", JSON.stringify({
        players,
        packageType,
        addOns,
        estimatedTotal,
      }));
    } catch {
      // sessionStorage unavailable — proceed without saving
    }
  };

  return (
    <div className="space-y-20 md:space-y-28">
      
      {/* Dynamic Host Emphasis Hero Card */}
      <section className="relative max-w-5xl mx-auto px-4 sm:px-6">
        <div className="glassmorphism rounded-3xl p-8 md:p-12 relative overflow-hidden shadow-2xl border border-white/10 bg-gradient-to-br from-brand-card/85 via-zinc-950/90 to-brand-purple/10">
          <div className="absolute top-0 right-0 p-6 select-none opacity-10 pointer-events-none text-9xl">
            ⚡
          </div>
          
          <div className="grid lg:grid-cols-12 gap-8 items-center relative z-10">
            <div className="lg:col-span-7 space-y-6 text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-purple/10 border border-brand-purple/30 text-xs font-semibold text-brand-purple">
                <Sparkles className="h-3.5 w-3.5 animate-pulse text-brand-pink" />
                The Teamtastic Emcee Difference
              </div>
              <h2 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight leading-tight">
                Not Just a Game. <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-purple to-brand-pink">
                  An Experience.
                </span>
              </h2>
              <p className="text-zinc-300 text-base md:text-lg leading-relaxed">
                Led by Michael and his team of professionally trained, comedic hosts with years of experience sparking laughter, connection, and celebration. We blend trivia, mini-games, custom soundtracks, and natural conversation to turn virtual events into unforgettable team moments.
              </p>
              
              <div className="flex flex-wrap gap-4 pt-2">
                <div className="flex items-center gap-2 text-sm text-zinc-400">
                  <Check className="h-4 w-4 text-emerald-400" />
                  Live Hosted Facilitation
                </div>
                <div className="flex items-center gap-2 text-sm text-zinc-400">
                  <Check className="h-4 w-4 text-emerald-400" />
                  Zoom & Teams Ready
                </div>
                <div className="flex items-center gap-2 text-sm text-zinc-400">
                  <Check className="h-4 w-4 text-emerald-400" />
                  12 to 300+ Players
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 w-full">
              <div className="glassmorphism-card rounded-2xl p-6 border border-white/5 space-y-6 bg-zinc-950/40">
                <span className="text-xs font-bold uppercase tracking-wider text-brand-purple block">
                  The Teamtastic Experience
                </span>
                <ul className="space-y-3.5 text-sm text-zinc-200">
                  <li className="flex items-center gap-3">
                    <span className="text-xl">🎤</span>
                    <span>Pro MC Host, comedic & inclusive</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="text-xl">⚡</span>
                    <span>Fast-paced Trivia + Mini-Games</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="text-xl">🎶</span>
                    <span>Soundtracks, timing & confetti built-in</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="text-xl">✨</span>
                    <span>Customized prompts & brand injection</span>
                  </li>
                </ul>

                <hr className="border-white/5" />

                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-2 bg-white/5 rounded-xl border border-white/5">
                    <div className="text-xl font-bold text-white">4.9/5</div>
                    <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Avg CSAT</div>
                  </div>
                  <div className="p-2 bg-white/5 rounded-xl border border-white/5">
                    <div className="text-xl font-bold text-white">12-300</div>
                    <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Players</div>
                  </div>
                  <div className="p-2 bg-white/5 rounded-xl border border-white/5">
                    <div className="text-xl font-bold text-white">60-90m</div>
                    <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Runtime</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Teamtastic Core Emcee Attributes */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid md:grid-cols-4 gap-6">
          <div className="glassmorphism-card rounded-2xl p-6 border border-white/5 hover:border-brand-purple/20 transition-all duration-300 group">
            <div className="w-12 h-12 rounded-xl bg-brand-purple/10 flex items-center justify-center text-brand-purple mb-4 group-hover:scale-110 transition-transform">
              <Smile className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Pro MC Host</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Every single show is facilitated live by an experienced, vetted entertainer who keeps energy inclusive, warm, and highly engaging.
            </p>
          </div>

          <div className="glassmorphism-card rounded-2xl p-6 border border-white/5 hover:border-brand-pink/20 transition-all duration-300 group">
            <div className="w-12 h-12 rounded-xl bg-brand-pink/10 flex items-center justify-center text-brand-pink mb-4 group-hover:scale-110 transition-transform">
              <Volume2 className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">High-Energy Vibes</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Curated audio cues, soundboards, and custom timers turn standard online rooms into premium corporate game show broadcasts.
            </p>
          </div>

          <div className="glassmorphism-card rounded-2xl p-6 border border-white/5 hover:border-brand-orange/20 transition-all duration-300 group">
            <div className="w-12 h-12 rounded-xl bg-brand-orange/10 flex items-center justify-center text-brand-orange mb-4 group-hover:scale-110 transition-transform">
              <Palette className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Tailored For You</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              We interlace your brand aesthetics, logo marks, specific topics, inside jokes, and player shoutouts right into the game dashboards.
            </p>
          </div>

          <div className="glassmorphism-card rounded-2xl p-6 border border-white/5 hover:border-brand-gold/20 transition-all duration-300 group">
            <div className="w-12 h-12 rounded-xl bg-brand-gold/10 flex items-center justify-center text-brand-gold mb-4 group-hover:scale-110 transition-transform">
              <Users className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Designed to Connect</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Carefully structured team splits, buzzer dynamics, and cooperative rounds ensure teams leave feeling closer and highly refreshed.
            </p>
          </div>
        </div>
      </section>

      {/* Overhauled Card Packages */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center space-y-3 mb-12">
          <h3 className="text-2xl md:text-3xl font-extrabold text-white">Simple, Transparent Pricing</h3>
          <p className="text-sm text-zinc-400 max-w-md mx-auto">
            Choose a package structured for your organization, then customize it modularly below.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch max-w-5xl mx-auto">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`relative rounded-3xl p-8 flex flex-col justify-between border backdrop-blur-md shadow-xl transition-all duration-300 hover:-translate-y-1 bg-gradient-to-b ${tier.gradient}`}
            >
              {tier.badge && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10 px-4 py-1 bg-gradient-to-r from-brand-purple to-brand-pink text-white text-xs font-bold uppercase tracking-wider rounded-full shadow-md flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-brand-gold" />
                  {tier.badge}
                </div>
              )}

              <div className="space-y-4">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  {tier.name}
                </span>
                <div className="flex items-baseline gap-1 pt-2">
                  <span className="text-4xl md:text-5xl font-extrabold text-white">
                    {tier.price}
                  </span>
                  <span className="text-sm font-semibold text-zinc-500">/ {tier.unit}</span>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed min-h-[40px]">
                  {tier.blurb}
                </p>
              </div>

              <hr className="border-white/5 my-6" />

              <div className="flex-1">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 block mb-4">
                  What&apos;s Included
                </span>
                <ul className="space-y-3">
                  {tier.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-3">
                      <div className="mt-1 h-4 w-4 rounded-full bg-brand-purple/10 border border-brand-purple/20 flex items-center justify-center text-brand-purple shrink-0">
                        <Check className="h-2.5 w-2.5" />
                      </div>
                      <span className="text-xs text-zinc-300 font-medium leading-normal">{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-8">
                {tier.href.startsWith("mailto:") ? (
                  <a
                    href={tier.href}
                    onClick={() => track("pricing_cta_clicked", { tier_name: tier.name, tier_cta: tier.cta })}
                    className={`w-full flex h-12 items-center justify-center rounded-xl text-sm font-bold transition-all ${tier.buttonStyle}`}
                  >
                    {tier.cta}
                  </a>
                ) : (
                  <Link
                    href={tier.href}
                    onClick={() => {
                      track("pricing_cta_clicked", { tier_name: tier.name, tier_cta: tier.cta });
                      if (tier.href === "/#quiz") saveEstimatorContext();
                    }}
                    className={`w-full flex h-12 items-center justify-center rounded-xl text-sm font-bold transition-all ${tier.buttonStyle}`}
                  >
                    {tier.cta}
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Event Quiz CTA Promobox */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="glassmorphism rounded-3xl p-6 md:p-8 border border-white/5 bg-zinc-950/30 flex flex-col md:flex-row items-center justify-between gap-6 hover:border-white/10 transition-all duration-300">
          <div className="text-left space-y-2">
            <h3 className="text-xl md:text-2xl font-bold text-white">Not sure which format fits your team?</h3>
            <p className="text-sm text-zinc-400 max-w-xl">
              Take our interactive 60-second virtual social planner quiz to receive a customized recommendation matching your specific budget, vibe, and team size.
            </p>
          </div>
          <Link
            href="/#quiz"
            onClick={saveEstimatorContext}
            className="flex h-12 px-6 items-center justify-center rounded-xl text-sm font-bold bg-white text-zinc-950 hover:bg-zinc-200 transition-all shrink-0 gap-2 hover:scale-[1.02]"
          >
            Start the Quiz <ArrowRight className="h-4 w-4 text-zinc-950" />
          </Link>
        </div>
      </section>

      {/* Dynamic Price Calculator Panel */}
      <section id="calc" className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className="glassmorphism rounded-3xl p-8 border border-white/10 bg-gradient-to-b from-zinc-950/80 to-brand-card/25 shadow-2xl relative">
          
          {/* Header */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-8 border-b border-white/5">
            <div className="text-left space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold uppercase tracking-widest text-emerald-400 mb-1">
                <TrendingUp className="h-3 w-3" />
                Live Quote Estimator
              </div>
              <h3 className="text-2xl md:text-3xl font-extrabold text-white">Quick Price Calculator</h3>
              <p className="text-xs text-zinc-400">Estimate your custom virtual team event in seconds. Exact quotes available on request.</p>
            </div>
            
            <Link
              href="/#quiz"
              onClick={saveEstimatorContext}
              className="px-4 py-2.5 rounded-xl bg-brand-purple hover:bg-brand-purple/90 text-white font-bold text-xs shadow-lg shadow-brand-purple/20 transition-all hover:scale-[1.02] shrink-0"
            >
              Get My Exact Quote →
            </Link>
          </div>

          {/* Calculator Inputs Grid */}
          <div className="grid md:grid-cols-12 gap-8 py-8 items-center">
            
            {/* Left Col: Player Count Slider */}
            <div className="md:col-span-5 space-y-4 text-left">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-zinc-300">Number of Players</label>
                <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1">
                  <input
                    type="number"
                    min={5}
                    max={300}
                    value={players}
                    onChange={(e) => setPlayers(Math.min(300, Math.max(5, Number(e.target.value))))}
                    className="w-12 bg-transparent text-white font-bold text-sm text-center focus:outline-none"
                  />
                  <span className="text-[10px] text-zinc-500 font-bold uppercase">ppl</span>
                </div>
              </div>
              
              <div className="space-y-2">
                <input
                  type="range"
                  min={5}
                  max={300}
                  value={players}
                  onChange={(e) => setPlayers(Number(e.target.value))}
                  className="w-full h-1.5 rounded-lg bg-zinc-800 appearance-none cursor-pointer accent-brand-purple"
                />
                <div className="flex justify-between text-[10px] text-zinc-600 font-medium">
                  <span>5 Players</span>
                  <span>150 Players</span>
                  <span>300+ Players</span>
                </div>
              </div>
            </div>

            {/* Middle Col: Package Selection Toggle */}
            <div className="md:col-span-3 space-y-4 text-left">
              <label className="text-sm font-bold text-zinc-300 block">Select Event Tier</label>
              <div className="grid grid-cols-2 gap-2 bg-zinc-900/50 p-1 border border-white/5 rounded-xl">
                <button
                  type="button"
                  onClick={() => setPackageType("core")}
                  className={`py-2 rounded-lg text-xs font-bold transition-all ${
                    packageType === "core"
                      ? "bg-brand-purple text-white shadow-md"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  Core
                </button>
                <button
                  type="button"
                  onClick={() => setPackageType("premium")}
                  className={`py-2 rounded-lg text-xs font-bold transition-all ${
                    packageType === "premium"
                      ? "bg-brand-purple text-white shadow-md"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  Premium
                </button>
              </div>
            </div>

            {/* Right Col: Price Output */}
            <div className="md:col-span-4 bg-zinc-950/60 rounded-2xl p-5 border border-white/5 space-y-1 relative text-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">
                Estimated Total
              </span>
              <div className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-brand-purple to-brand-pink tracking-tight py-1">
                ${estimatedTotal.toLocaleString()}
              </div>
              <span className="text-[9px] text-zinc-500 font-medium leading-none block">
                {`Includes minimum base host fee of $${HOSTED_PRICING.minimum}`}
              </span>
            </div>

          </div>

          {/* Bottom Col: Add-On Toggles */}
          <div className="pt-8 border-t border-white/5">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-4 text-left">
              Supercharge Your Social Vibe (Optional Add-ons)
            </span>
            
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => toggleAddOn("kits")}
                className={`flex items-center justify-between gap-4 rounded-xl border px-4 py-2.5 text-xs font-bold transition-all ${
                  addOns.kits 
                    ? "bg-brand-purple/20 text-white border-brand-purple/60" 
                    : "bg-white/5 border-white/10 text-zinc-400 hover:text-white"
                }`}
              >
                <span>📦 Snack Kits (+$30/pp)</span>
                <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${addOns.kits ? "border-brand-purple bg-brand-purple" : "border-zinc-700"}`}>
                  {addOns.kits && <Check className="h-2 w-2 text-white stroke-[3px]" />}
                </span>
              </button>

              <button
                type="button"
                onClick={() => toggleAddOn("awards")}
                className={`flex items-center justify-between gap-4 rounded-xl border px-4 py-2.5 text-xs font-bold transition-all ${
                  addOns.awards 
                    ? "bg-brand-purple/20 text-white border-brand-purple/60" 
                    : "bg-white/5 border-white/10 text-zinc-400 hover:text-white"
                }`}
              >
                <span>🏆 Awards Ceremony (+$250)</span>
                <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${addOns.awards ? "border-brand-purple bg-brand-purple" : "border-zinc-700"}`}>
                  {addOns.awards && <Check className="h-2 w-2 text-white stroke-[3px]" />}
                </span>
              </button>

              <button
                type="button"
                onClick={() => toggleAddOn("premiumHost")}
                className={`flex items-center justify-between gap-4 rounded-xl border px-4 py-2.5 text-xs font-bold transition-all ${
                  addOns.premiumHost 
                    ? "bg-brand-purple/20 text-white border-brand-purple/60" 
                    : "bg-white/5 border-white/10 text-zinc-400 hover:text-white"
                }`}
              >
                <span>🎭 Premium Host Upgrade (+$300)</span>
                <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${addOns.premiumHost ? "border-brand-purple bg-brand-purple" : "border-zinc-700"}`}>
                  {addOns.premiumHost && <Check className="h-2 w-2 text-white stroke-[3px]" />}
                </span>
              </button>

              <button
                type="button"
                onClick={() => toggleAddOn("customTheme")}
                className={`flex items-center justify-between gap-4 rounded-xl border px-4 py-2.5 text-xs font-bold transition-all ${
                  addOns.customTheme 
                    ? "bg-brand-purple/20 text-white border-brand-purple/60" 
                    : "bg-white/5 border-white/10 text-zinc-400 hover:text-white"
                }`}
              >
                <span>🎨 Custom Content Build (Custom Quote)</span>
                <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${addOns.customTheme ? "border-brand-purple bg-brand-purple" : "border-zinc-700"}`}>
                  {addOns.customTheme && <Check className="h-2 w-2 text-white stroke-[3px]" />}
                </span>
              </button>

              <button
                type="button"
                onClick={() => toggleAddOn("extraTime")}
                className={`flex items-center justify-between gap-4 rounded-xl border px-4 py-2.5 text-xs font-bold transition-all ${
                  addOns.extraTime 
                    ? "bg-brand-purple/20 text-white border-brand-purple/60" 
                    : "bg-white/5 border-white/10 text-zinc-400 hover:text-white"
                }`}
              >
                <span>⏱ Extra Time (+30 min) (+$150)</span>
                <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${addOns.extraTime ? "border-brand-purple bg-brand-purple" : "border-zinc-700"}`}>
                  {addOns.extraTime && <Check className="h-2 w-2 text-white stroke-[3px]" />}
                </span>
              </button>
            </div>
            {addOns.customTheme && (
              <p className="mt-4 text-left text-xs text-cyan-300">
                Custom content is quoted separately based on the amount of writing, design, and production work required.
              </p>
            )}
          </div>

        </div>
      </section>

      {/* "Make it Unforgettable" Add-On Visual Grid */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-left space-y-3 mb-10">
          <h3 className="text-2xl md:text-3xl font-extrabold text-white">Make it Unforgettable</h3>
          <p className="text-sm text-zinc-400 max-w-xl">
            Want to physicalize the event or add custom parameters? Select dynamic upgrades to tailor your game experience.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {addOnsList.map((addon) => {
            const Icon = addon.icon;
            return (
              <div 
                key={addon.title} 
                className="glassmorphism-card rounded-2xl p-5 border border-white/5 hover:bg-white/[0.03] transition-all flex flex-col justify-between group"
              >
                <div className="space-y-4">
                  <div className={`w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center ${addon.iconColor} group-hover:scale-105 transition-transform`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <h4 className="text-base font-bold text-white">{addon.title}</h4>
                  <p className="text-xs text-zinc-400 leading-relaxed">{addon.text}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Testimonials - Loved by teams big and small */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid md:grid-cols-12 gap-8 items-center bg-zinc-950/40 rounded-3xl p-8 md:p-12 border border-white/5">
          <div className="md:col-span-4 text-left space-y-4">
            <h3 className="text-2xl md:text-3xl font-extrabold text-white leading-tight">
              Loved by teams big and small
            </h3>
            <p className="text-sm text-zinc-400">
              Real connection, genuine laughter, and shared moments built directly through Teamtastic experiences.
            </p>
          </div>
          
          <div className="md:col-span-8 grid sm:grid-cols-3 gap-4">
            {reviews.map((rev, idx) => (
              <div key={idx} className="glassmorphism-card rounded-2xl p-6 border border-white/5 flex flex-col justify-between text-left h-full">
                <div className="space-y-4">
                  <span className="text-4xl text-zinc-600 block leading-none font-serif">&ldquo;</span>
                  <p className="text-xs text-zinc-200 leading-relaxed font-medium italic">
                    {rev.quote}
                  </p>
                </div>
                <div className="pt-4 border-t border-white/5 mt-4">
                  <div className="text-xs font-bold text-white">{rev.name}</div>
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5">{rev.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
}
