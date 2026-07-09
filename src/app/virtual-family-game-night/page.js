"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { 
  Trophy, 
  Calendar, 
  Mail, 
  Monitor, 
  Music, 
  Users, 
  Cake, 
  PartyPopper, 
  Check, 
  Star, 
  ArrowRight, 
  ChevronDown, 
  Sparkles,
  Heart,
  Globe,
  Smile,
  Compass
} from "lucide-react";
import TalkToMichaelModal from "@/components/TalkToMichaelModal";
import CorporateLeadForm from "@/components/CorporateLeadForm";

// 6 Experience Cards for Families
const experiences = [
  {
    title: "Family Trivia Showdown",
    desc: "Fun, fast-paced trivia for all ages.",
    icon: Trophy,
    color: "from-purple-500/10 to-purple-600/5 border-purple-200 text-purple-600"
  },
  {
    title: "Virtual Family Bingo",
    desc: "Classic bingo with hilarious twists.",
    icon: PartyPopper,
    color: "from-pink-500/10 to-pink-600/5 border-pink-200 text-pink-600"
  },
  {
    title: "Music & Memories",
    desc: "Name that tune, decades, and more!",
    icon: Music,
    color: "from-orange-500/10 to-orange-600/5 border-orange-200 text-orange-600"
  },
  {
    title: "Generations Battle",
    desc: "Kids vs. adults in friendly competition.",
    icon: Users,
    color: "from-amber-500/10 to-amber-600/5 border-amber-200 text-amber-600"
  },
  {
    title: "Birthday Spotlight",
    desc: "Celebrate your star with custom challenges!",
    icon: Cake,
    color: "from-rose-500/10 to-rose-600/5 border-rose-200 text-rose-600"
  },
  {
    title: "Custom Game Night",
    desc: "We create questions about your favorite movies and family stories.",
    icon: Smile,
    color: "from-sky-500/10 to-sky-600/5 border-sky-200 text-sky-600"
  }
];

// 6 Occasions Cards for Families
const occasions = [
  { label: "Birthdays", img: "/family-occasion-birthday.png", icon: Cake },
  { label: "Reunions", img: "/family-occasion-reunion.png", icon: Users },
  { label: "Holidays", img: "/family-occasion-holiday.png", icon: Sparkles },
  { label: "Anniversaries", img: "/family-occasion-anniversary.png", icon: Heart },
  { label: "Graduations", img: "/family-occasion-graduation.png", icon: Trophy },
  { label: "Long-Distance Family", img: "/family-occasion-distance.png", icon: Globe }
];

// Family Testimonials
const testimonials = [
  {
    quote: "Michael was incredible! He had our entire family laughing the whole time. Best night of the year!",
    family: "The Johnson Family",
    initials: "JF",
    color: "from-purple-500 to-indigo-500"
  },
  {
    quote: "So organized, so fun, so worth it. Our reunion has a new tradition!",
    family: "The Martinez Family",
    initials: "MF",
    color: "from-pink-500 to-rose-500"
  },
  {
    quote: "Everyone, from age 8 to 80, was engaged and smiling. Absolutely perfect!",
    family: "The Anderson Family",
    initials: "AF",
    color: "from-amber-500 to-orange-500"
  }
];

// Family-focused FAQs
const familyFaqs = [
  {
    q: "Is it appropriate for young children and grandparents?",
    a: "Absolutely! We customize our game formats, question difficulty, and pacing so that players from age 8 to 80 (and beyond!) can participate and compete on equal footing."
  },
  {
    q: "How do family members connect to the game?",
    a: "We join a shared Zoom link where everyone can see and hear each other. To play, family members simply open a web browser on their phone, tablet, or computer. No downloads are required!"
  },
  {
    q: "Can we customize the trivia questions?",
    a: "Yes! We specialize in personalizing the experience. We can build custom trivia rounds based on your family history, inside jokes, embarrassing moments, and even include family photos!"
  },
  {
    q: "How many screens/devices can join?",
    a: "We support events from 5 devices up to 100+ screens. Multiple people can play from the same house on their own separate phones, or team up on a single screen."
  },
  {
    q: "How far in advance should we plan?",
    a: "We recommend booking 2 to 4 weeks in advance, especially for holiday weekends and summer reunions, to guarantee Michael or one of our star emcees is available to host."
  },
  {
    q: "Do you provide prizes?",
    a: "We manage the scoreboards and crown the family champion with digital confetti and certificates. If you'd like to hand out real prizes or gift cards, we can coordinate with you to present them during the show!"
  }
];

export default function FamilyGameNightPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentTestimonial, setCurrentTestimonial] = useState(0);
  const [activeFaq, setActiveFaq] = useState(null);

  // Listen for Navbar CTA button custom events
  useEffect(() => {
    const handleOpenModal = () => setIsModalOpen(true);
    window.addEventListener("open-family-concierge", handleOpenModal);
    return () => window.removeEventListener("open-family-concierge", handleOpenModal);
  }, []);

  // Auto-rotate testimonials
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTestimonial((prev) => (prev + 1) % testimonials.length);
    }, 7000);
    return () => clearInterval(interval);
  }, []);

  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "Service",
      name: "Live Virtual Family Game Night",
      serviceType: "Live-hosted virtual family entertainment",
      provider: { "@type": "Organization", name: "Teamtastic", url: "https://teamtastic.events" },
      areaServed: "Worldwide",
      offers: { "@type": "Offer", price: "35", priceCurrency: "USD", description: "$35 per person with a $250 minimum and a $100 reservation deposit" },
      review: testimonials.map((item) => ({
        "@type": "Review",
        author: { "@type": "Organization", name: item.family },
        reviewBody: item.quote,
        reviewRating: { "@type": "Rating", ratingValue: "5", bestRating: "5" },
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: familyFaqs.map((faq) => ({
        "@type": "Question",
        name: faq.q,
        acceptedAnswer: { "@type": "Answer", text: faq.a },
      })),
    },
  ];

  return (
    <div className="bg-[#FFFFFF] text-zinc-800 font-sans min-h-screen">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      <main className="overflow-hidden">
        
        {/* ══ HERO SECTION (LIGHT THEME) ══ */}
        <section id="hero" className="py-20 relative bg-slate-50 overflow-hidden border-b border-zinc-200/50">
          <div className="absolute inset-0 -z-10" style={{
            background: "radial-gradient(circle at 70% 30%, rgba(251,191,36,0.15) 0%, transparent 60%)"
          }} />
          
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-12 gap-12 items-center">
              
              {/* Left Column Copy */}
              <div className="lg:col-span-6 space-y-8 text-left z-10">
                <h1 className="text-4xl sm:text-6xl font-black text-zinc-950 tracking-tight leading-none font-sans">
                  The Family Reunion <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 via-pink-500 to-brand-orange">
                    You Don&apos;t Have to Organize.
                  </span>
                </h1>
                
                <div className="space-y-4">
                  <h3 className="text-xl sm:text-2xl font-extrabold text-zinc-900 tracking-tight">
                    Total Fun. Zero Hassle. Perfect Connection.
                  </h3>
                  <p className="text-zinc-650 max-w-lg leading-relaxed font-medium text-base sm:text-lg">
                    Fully hosted live experiences designed for all ages, from kids to seniors.
                  </p>
                </div>

                <ul className="space-y-3">
                  {[
                    "Fun-packed birthdays, hilarious games.",
                    "Trivia, bingo, games, creative challenges, and custom options.",
                    "Custom family-oriented themes that bring the fun to you."
                  ].map((bullet, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <div className="mt-1 h-5 w-5 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
                        <Check className="h-3.5 w-3.5" />
                      </div>
                      <span className="text-sm sm:text-base text-zinc-700 font-semibold leading-tight">{bullet}</span>
                    </li>
                  ))}
                </ul>

                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <span className="font-script text-purple-600 text-3xl rotate-[-2deg] tracking-wide inline-block mr-1">Play.</span>
                  <span className="font-script text-brand-orange text-3xl rotate-[1deg] tracking-wide inline-block mr-1">Connect.</span>
                  <span className="font-script text-brand-pink text-3xl rotate-[-3deg] tracking-wide inline-block">Celebrate.</span>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4 pt-4">
                  <button
                    onClick={() => setIsModalOpen(true)}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-base font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-xl shadow-emerald-600/10 hover:scale-[1.02] transition-all cursor-pointer"
                  >
                    Find Your Perfect Style
                    <ArrowRight className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => setIsModalOpen(true)}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-base font-bold text-zinc-700 border-2 border-zinc-200 bg-white hover:bg-zinc-50 transition-all cursor-pointer"
                  >
                    Plan Your Game Night
                  </button>
                </div>
                <p className="text-sm font-bold text-zinc-700">
                  Live-hosted events start at $35/person · $250 minimum · $100 reserves your date
                </p>
                <Link href="#availability" className="inline-flex items-center gap-1.5 text-sm font-bold text-purple-600 hover:text-purple-700 underline underline-offset-4 transition-colors">
                  Or check a date now, no call needed
                </Link>
              </div>
              
              {/* Right Column Visual Cutout & Zoom grid */}
              <div className="lg:col-span-6 relative flex items-center justify-center min-h-[500px]">
                
                {/* Yellow circle behind Michael */}
                <div className="absolute w-[360px] h-[360px] sm:w-[420px] sm:h-[420px] rounded-full bg-amber-400 -z-10 shadow-inner translate-x-4" />
                
                {/* 2x2 Zoom Mockup grid (placed behind Michael overlay) */}
                <div className="absolute -left-6 sm:-left-12 top-6 grid grid-cols-2 gap-4 w-[260px] sm:w-[320px] z-0">
                  {[
                    "/family-zoom-1.png",
                    "/family-zoom-2.png",
                    "/family-zoom-3.png",
                    "/family-zoom-4.png"
                  ].map((src, i) => (
                    <div 
                      key={i} 
                      className="aspect-[4/3] rounded-2xl border-2 border-white bg-slate-900 overflow-hidden shadow-xl hover:scale-105 transition-all duration-300 relative"
                    >
                      <Image src={src} fill sizes="(min-width: 768px) 160px, 130px" className="object-cover" alt="Family Zoom Feed" />
                      {/* Zoom style overlay badge */}
                      <span className="absolute bottom-1.5 left-2 px-1.5 py-0.5 rounded bg-black/60 text-[8px] font-bold text-white font-mono uppercase tracking-wider">
                        {["Home Base", "Sarah & Kids", "Grandma", "Uncle Leo"][i]}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Michael emcee cutout overlay */}
                <div className="relative w-[340px] sm:w-[400px] h-auto pointer-events-none select-none z-10 mt-12 self-end">
                  <Image
                    src="/emcee-engaged-transparent.png"
                    alt="Michael - Master Emcee"
                    width={819}
                    height={1024}
                    className="w-full h-auto object-contain"
                  />
                  
                  {/* Zoom badge indicator */}
                  <div className="absolute bottom-32 -right-4 bg-blue-600 text-white px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-xl text-xs font-bold font-mono tracking-wider animate-bounce">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                    Live & Interactive Over Zoom!
                  </div>
                </div>

                {/* Bottom reviews trust badge */}
                <div className="absolute bottom-4 left-6 bg-white border border-zinc-150 px-4 py-2.5 rounded-2xl shadow-xl z-20 flex items-center gap-2">
                  <div className="flex gap-0.5 text-amber-500">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-current" />
                    ))}
                  </div>
                  <span className="text-xs font-bold text-zinc-800 tracking-tight">
                    Loved by families across generations
                  </span>
                </div>

              </div>

            </div>
          </div>
        </section>

        {/* ══ STEP BANNER (DARK INDIGO/BLUE) ══ */}
        <section className="bg-indigo-950 py-5 text-white border-y border-indigo-900">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-12 text-sm font-bold tracking-wider uppercase font-mono">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center text-xs font-black">1</span>
                <span>Pick a Date & Style</span>
              </div>
              <span className="hidden md:inline text-indigo-800">|</span>
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-pink-500 flex items-center justify-center text-xs font-black">2</span>
                <span>We Setup, You Invite</span>
              </div>
              <span className="hidden md:inline text-indigo-800">|</span>
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center text-xs font-black">3</span>
                <span>Join & Play</span>
              </div>
              <span className="hidden md:inline text-indigo-800">|</span>
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-xs font-black">4</span>
                <span>Celebrate</span>
              </div>
            </div>
          </div>
        </section>

        {/* ══ QUICK AVAILABILITY CHECK ══ */}
        <section id="availability" className="scroll-mt-24 py-16 bg-slate-50 border-b border-zinc-200/50">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
            <div className="space-y-4 text-left">
              <span className="text-xs font-black uppercase tracking-widest text-purple-600 font-mono">Skip the back-and-forth</span>
              <h2 className="text-3xl sm:text-5xl font-black text-zinc-950 tracking-tight leading-tight">
                Check a date in <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-500">30 seconds.</span>
              </h2>
              <p className="text-zinc-650 max-w-lg leading-relaxed font-medium">
                Tell us the basics and Michael will confirm availability and the best-fit game night format. No obligation.
              </p>
            </div>
            <CorporateLeadForm isFamily />
          </div>
        </section>

        {/* ══ CHOOSE YOUR EXPERIENCE ══ */}
        <section id="games" className="py-20 bg-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center space-y-4 mb-16">
              <h2 className="text-3xl sm:text-5xl font-black text-zinc-950 tracking-tight leading-tight">
                Choose Your{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-500">
                  Family Game Night
                </span>{" "}
                Experience
              </h2>
              <div className="w-16 h-1 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full mx-auto" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {experiences.map((exp) => {
                const Icon = exp.icon;
                return (
                  <div
                    key={exp.title}
                    className={`rounded-3xl p-8 flex flex-col justify-between border border-zinc-150 shadow-sm hover:shadow-xl hover:scale-[1.01] transition-all duration-300 bg-gradient-to-br from-white to-slate-50/50 group`}
                  >
                    <div className="space-y-4 text-left">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border bg-gradient-to-br ${exp.color} shadow-inner`}>
                        <Icon className="h-6 w-6" />
                      </div>
                      <h3 className="text-xl font-bold text-zinc-900 group-hover:text-purple-600 transition-colors">
                        {exp.title}
                      </h3>
                      <p className="text-sm text-zinc-550 leading-relaxed font-semibold">
                        {exp.desc}
                      </p>
                    </div>
                    
                    <div className="pt-6 text-left">
                      <button
                        onClick={() => setIsModalOpen(true)}
                        className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-purple-600 hover:text-purple-800 transition-all cursor-pointer"
                      >
                        Learn More <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ══ HOW IT WORKS ══ */}
        <section id="how-it-works" className="py-20 bg-slate-50 border-y border-zinc-200/50">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center space-y-4 mb-16">
              <h2 className="text-3xl sm:text-5xl font-black text-zinc-950 tracking-tight leading-tight flex items-center justify-center gap-2">
                <Sparkles className="h-8 w-8 text-amber-500 animate-pulse" />
                How It Works
                <Sparkles className="h-8 w-8 text-amber-500 animate-pulse" />
              </h2>
              <p className="text-zinc-550 max-w-md mx-auto font-semibold text-sm sm:text-base">
                An easy, live-hosted event in four simple steps.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 max-w-6xl mx-auto relative z-10">
              
              {/* Connector line (desktop only) */}
              <div className="hidden md:block absolute top-[28px] left-[12%] right-[12%] h-[2px] bg-slate-200 -z-10 border-dashed border" />

              {/* Step 1 */}
              <div className="text-center space-y-4">
                <div className="w-14 h-14 rounded-full bg-purple-100 border border-purple-200 text-purple-600 flex items-center justify-center font-black mx-auto text-lg shadow-sm">
                  <Calendar className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold text-zinc-900">1. Pick a Date</h3>
                <p className="text-xs text-zinc-550 font-semibold max-w-[200px] mx-auto leading-relaxed">
                  Choose your game night theme, time, and custom style.
                </p>
              </div>

              {/* Step 2 */}
              <div className="text-center space-y-4">
                <div className="w-14 h-14 rounded-full bg-pink-100 border border-pink-200 text-pink-600 flex items-center justify-center font-black mx-auto text-lg shadow-sm">
                  <Mail className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold text-zinc-900">2. We Setup</h3>
                <p className="text-xs text-zinc-550 font-semibold max-w-[200px] mx-auto leading-relaxed">
                  We customize the details and provide invitations for you to send.
                </p>
              </div>

              {/* Step 3 */}
              <div className="text-center space-y-4">
                <div className="w-14 h-14 rounded-full bg-emerald-100 border border-emerald-200 text-emerald-600 flex items-center justify-center font-black mx-auto text-lg shadow-sm">
                  <Monitor className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold text-zinc-900">3. Hop on Zoom</h3>
                <p className="text-xs text-zinc-550 font-semibold max-w-[200px] mx-auto leading-relaxed">
                  Our host leads a live, interactive, highly engaging game show.
                </p>
              </div>

              {/* Step 4 */}
              <div className="text-center space-y-4">
                <div className="w-14 h-14 rounded-full bg-orange-100 border border-orange-200 text-orange-600 flex items-center justify-center font-black mx-auto text-lg shadow-sm">
                  <Trophy className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold text-zinc-900">4. Play & Laugh!</h3>
                <p className="text-xs text-zinc-550 font-semibold max-w-[200px] mx-auto leading-relaxed">
                  Make amazing family memories that last long after the call.
                </p>
              </div>

            </div>
          </div>
        </section>

        {/* ══ MIDDLE CTA BANNER ══ */}
        <section className="py-12 bg-indigo-950 text-white relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-purple-400 via-zinc-900 to-zinc-950" />
          
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="glassmorphism rounded-3xl border border-white/10 p-8 sm:p-12 flex flex-col lg:flex-row items-center justify-between gap-8 bg-gradient-to-br from-indigo-950 via-zinc-950 to-purple-950/20">
              
              <div className="flex items-center gap-6 text-left max-w-xl">
                <div className="hidden sm:grid grid-cols-2 gap-2 w-32 shrink-0">
                  {["/family-zoom-1.png", "/family-zoom-4.png"].map((src, idx) => (
                    <div key={src} className="relative aspect-[4/3] overflow-hidden rounded-xl border border-white/10">
                      <Image src={src} fill sizes="64px" className="object-cover" alt="Family Zoom" />
                    </div>
                  ))}
                </div>
                <div className="space-y-3">
                  <h3 className="text-xl sm:text-2xl font-bold uppercase tracking-wider text-amber-400 font-mono">
                    Ready to Make Your Next Get-Together Unforgettable?
                  </h3>
                  <p className="text-zinc-300 text-base font-medium">
                    Let&apos;s Make it Happen! Setup is fast, friction-free, and 100% hosted.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsModalOpen(true)}
                className="w-full lg:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-base font-bold text-indigo-950 bg-white hover:bg-zinc-100 transition-all shrink-0 hover:scale-[1.02] cursor-pointer"
              >
                <Calendar className="h-5 w-5 text-indigo-950" />
                Plan Your Game Night
              </button>

            </div>
          </div>
        </section>

        {/* ══ PERFECT FOR ANY OCCASION ══ */}
        <section id="occasions" className="py-20 bg-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center space-y-4 mb-16">
              <h2 className="text-3xl sm:text-5xl font-black text-zinc-950 tracking-tight leading-tight">
                Perfect for <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-brand-orange">Any Occasion</span>
              </h2>
              <div className="w-16 h-1 bg-gradient-to-r from-pink-500 to-brand-orange rounded-full mx-auto" />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 max-w-6xl mx-auto">
              {occasions.map((occ) => {
                const Icon = occ.icon;
                return (
                  <div
                    key={occ.label}
                    className="group flex flex-col rounded-2xl overflow-hidden border border-zinc-150 shadow-sm hover:shadow-md hover:scale-[1.02] transition-all duration-300 bg-white"
                  >
                    <div className="aspect-[4/3] w-full overflow-hidden bg-slate-100 relative">
                      <Image
                        src={occ.img}
                        alt={occ.label}
                        fill
                        sizes="(min-width: 1024px) 160px, (min-width: 768px) 33vw, 50vw"
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 flex items-center justify-center text-purple-600 shadow border border-purple-100/50">
                        <Icon className="w-4.5 h-4.5" />
                      </div>
                    </div>
                    <div className="p-4 text-center">
                      <span className="text-xs font-black uppercase tracking-wider text-zinc-700 leading-tight block">
                        {occ.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ══ PERSONALIZATION & TESTIMONIAL SPLIT ══ */}
        <section id="reviews" className="py-20 bg-slate-50 border-t border-zinc-200/50">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-12 gap-12 items-start max-w-6xl mx-auto">
              
              {/* Left Column: Make It Personal & Tablet Mockup */}
              <div className="lg:col-span-6 space-y-8 text-left">
                <div className="space-y-4">
                  <span className="text-xs font-black uppercase tracking-widest text-purple-600 font-mono">100% Personalized</span>
                  <h2 className="text-3xl sm:text-5xl font-black text-zinc-950 tracking-tight leading-tight">
                    Make It <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-500">Personal</span>
                  </h2>
                  <p className="text-zinc-650 font-semibold leading-relaxed">
                    We don&apos;t run dry, standard quiz templates. We custom-write questions about your family history, inside jokes, and special memories.
                  </p>
                </div>

                <ul className="space-y-3.5">
                  {[
                    "Custom family trivia about your history & hometowns",
                    "Photos, inside jokes & special moments in-game",
                    "Shoutouts for birthdays, anniversaries & accomplishments",
                    "Your favorite music, themes, and decade options"
                  ].map((item, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <div className="mt-1 h-5 w-5 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
                        <Check className="h-3 w-3" />
                      </div>
                      <span className="text-sm sm:text-base text-zinc-700 font-semibold leading-normal">{item}</span>
                    </li>
                  ))}
                </ul>

                {/* Custom CSS Trivia Tablet Mockup */}
                <div className="pt-4 max-w-[420px] mx-auto lg:mx-0">
                  <div className="relative p-3 bg-zinc-800 rounded-3xl shadow-2xl border-4 border-zinc-700 max-w-full aspect-[16/10] overflow-hidden flex flex-col justify-between text-white select-none">
                    
                    {/* Screen Top Bar */}
                    <div className="flex items-center justify-between border-b border-white/10 pb-2 text-[9px] font-mono tracking-wider text-purple-300">
                      <span>ROUND 2: FAMILY SECRETS</span>
                      <span className="bg-purple-600 text-white px-2 py-0.5 rounded-full font-bold">10s LEFT</span>
                    </div>

                    {/* Question body */}
                    <div className="my-auto py-2 text-center">
                      <h4 className="text-sm sm:text-base font-bold leading-snug text-zinc-100">
                        &ldquo;Which family vacation destination did Uncle Bob get lost in the airport?&rdquo;
                      </h4>
                    </div>

                    {/* Multiple choices */}
                    <div className="grid grid-cols-2 gap-2 text-[10px] font-bold">
                      <div className="p-2 rounded-lg bg-red-500/20 border border-red-500/40 text-red-300 flex items-center gap-1">
                        <span className="w-4 h-4 rounded bg-red-500 text-white flex items-center justify-center text-[8px]">A</span>
                        <span>Las Vegas (2018)</span>
                      </div>
                      <div className="p-2 rounded-lg bg-blue-500/20 border border-blue-500/40 text-blue-300 flex items-center gap-1">
                        <span className="w-4 h-4 rounded bg-blue-500 text-white flex items-center justify-center text-[8px]">B</span>
                        <span>Orlando Disney (2015)</span>
                      </div>
                      <div className="p-2 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center gap-1">
                        <span className="w-4 h-4 rounded bg-amber-500 text-white flex items-center justify-center text-[8px]">C</span>
                        <span>Cancun Mexico (2021)</span>
                      </div>
                      <div className="p-2 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center gap-1">
                        <span className="w-4 h-4 rounded bg-emerald-500 text-white flex items-center justify-center text-[8px]">D</span>
                        <span>Hawaii Cruise (2019)</span>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* Right Column: Family Testimonials Carousel */}
              <div className="lg:col-span-6 w-full lg:sticky lg:top-28 space-y-8 bg-white border border-zinc-150 p-8 sm:p-12 rounded-3xl shadow-sm text-left">
                
                <div className="space-y-4">
                  <span className="text-xs font-black uppercase tracking-widest text-pink-500 font-mono">HEARD FROM FAMILIES</span>
                  <h2 className="text-3xl sm:text-5xl font-black text-zinc-950 tracking-tight leading-tight">
                    What <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-brand-orange">Families</span> Are Saying
                  </h2>
                </div>

                <div className="relative min-h-[160px] flex items-center">
                  {testimonials.map((test, idx) => (
                    <div
                      key={idx}
                      className={`transition-all duration-500 absolute inset-0 flex flex-col justify-between gap-6 ${
                        idx === currentTestimonial ? "opacity-100 translate-x-0 pointer-events-auto" : "opacity-0 translate-x-8 pointer-events-none"
                      }`}
                    >
                      <blockquote className="text-base sm:text-lg lg:text-xl font-semibold text-zinc-700 italic leading-relaxed">
                        &ldquo;{test.quote}&rdquo;
                      </blockquote>
                      
                      <div className="flex items-center gap-4.5">
                        <div className={`w-12 h-12 rounded-full bg-gradient-to-tr ${test.color} flex items-center justify-center text-white font-black text-sm shadow-md`}>
                          {test.initials}
                        </div>
                        <div>
                          <h4 className="font-bold text-zinc-900 leading-tight">{test.family}</h4>
                          <div className="flex gap-0.5 text-amber-500 mt-1">
                            {[...Array(5)].map((_, i) => (
                              <Star key={i} className="h-3.5 w-3.5 fill-current" />
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Dot selectors */}
                <div className="flex items-center gap-2 pt-4">
                  {testimonials.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentTestimonial(idx)}
                      className={`h-2.5 rounded-full transition-all duration-300 ${
                        idx === currentTestimonial ? "w-8 bg-purple-600" : "w-2.5 bg-zinc-200"
                      }`}
                      aria-label={`Testimonial ${idx + 1}`}
                    />
                  ))}
                </div>

              </div>

            </div>
          </div>
        </section>

        {/* ══ FAQ SECTION (LIGHT THEME) ══ */}
        <section id="faq" className="py-20 bg-white border-t border-zinc-200/50">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 space-y-12">
            
            <div className="text-center space-y-4 max-w-xl mx-auto">
              <span className="text-xs font-black uppercase tracking-widest text-purple-600 font-mono">HAVE QUESTIONS?</span>
              <h2 className="text-3xl sm:text-5xl font-black text-zinc-950 tracking-tight leading-tight">
                Frequently Asked Questions
              </h2>
            </div>

            <div className="space-y-4 max-w-3xl mx-auto text-left">
              {familyFaqs.map((faq, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl border border-zinc-150 bg-slate-50/50 overflow-hidden transition-all duration-300"
                >
                  <button
                    onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
                    className="w-full p-5 flex items-center justify-between text-left font-bold text-zinc-900 text-sm sm:text-base hover:bg-slate-100/50 transition-colors cursor-pointer"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown
                      className={`h-5 w-5 text-zinc-400 transition-transform duration-300 shrink-0 ml-4 ${
                        activeFaq === idx ? "rotate-180 text-purple-600" : ""
                      }`}
                    />
                  </button>
                  
                  <div
                    className={`transition-all duration-300 ease-in-out ${
                      activeFaq === idx ? "max-h-[300px] border-t border-zinc-150/60" : "max-h-0"
                    } overflow-hidden`}
                  >
                    <p className="p-5 text-sm text-zinc-600 leading-relaxed font-semibold bg-white">
                      {faq.a}
                    </p>
                  </div>
                </div>
              ))}
            </div>

          </div>
        </section>

        {/* ══ FOOTER CTA BANNER ══ */}
        <section className="py-20 bg-indigo-950 text-white relative overflow-hidden">
          <div className="absolute inset-0 opacity-15" style={{
            background: "radial-gradient(circle at center, rgba(139,92,246,0.2) 0%, transparent 60%)"
          }} />
          
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center space-y-8 relative z-10">
            <h2 className="text-3xl sm:text-6xl font-black tracking-tight leading-tight">
              Let&apos;s Create a Night Your Family <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-brand-orange">
                Will Never Forget!
              </span>
            </h2>
            <p className="max-w-xl mx-auto text-base sm:text-lg text-zinc-300 font-semibold">
              Live. Interactive. Unforgettable. Zero technical hassle for you — we manage the screens, hosting, and music.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 max-w-md mx-auto">
              <button
                onClick={() => setIsModalOpen(true)}
                className="w-full inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-base font-bold text-indigo-950 bg-amber-400 hover:bg-amber-300 shadow-xl shadow-amber-400/10 hover:scale-[1.02] transition-all cursor-pointer"
              >
                <Calendar className="h-5 w-5" />
                Plan Your Game Night
              </button>
              <button
                onClick={() => setIsModalOpen(true)}
                className="w-full inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-base font-bold text-white border-2 border-white/20 bg-white/5 hover:bg-white/10 hover:text-white transition-all cursor-pointer"
              >
                <Users className="h-5 w-5" />
                Talk to Michael
              </button>
            </div>
          </div>
        </section>

      </main>

      {/* Talk To Michael Concierge Modal (Family Variant) */}
      <TalkToMichaelModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        isFamily={true}
      />
    </div>
  );
}
