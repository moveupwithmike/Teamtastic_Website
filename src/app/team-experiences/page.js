import { 
  Gamepad2, 
  Sparkles, 
  Users, 
  Award, 
  ArrowRight, 
  Zap, 
  Music, 
  Tv, 
  Lock, 
  Palette, 
  Grid, 
  Brain, 
  Wand2, 
  ChevronDown, 
  Trophy, 
  Home as HomeIcon, 
  Layers, 
  PartyPopper, 
  Heart, 
  UserPlus, 
  Compass, 
  TrendingUp, 
  Globe, 
  Check,
  Smile,
  Star
} from "lucide-react";
import Link from "next/link";
import TestimonialsCarousel from "@/components/TestimonialsCarousel";
import CtaBannerWithModal from "@/components/CtaBannerWithModal";
import CustomIdeaFooterSection from "@/components/CustomIdeaFooterSection";

export const metadata = {
  title: "Virtual Team Experiences & Live Hosted Game Shows | Teamtastic",
  description: "Choose the virtual experience format that fits your team vibe. Discover live emcee-hosted game shows, custom trivia, and team-building events designed for remote and hybrid teams of any size.",
  alternates: {
    canonical: "https://teamtastic.events/team-experiences",
  },
  openGraph: {
    title: "Virtual Team Experiences & Live Hosted Game Shows | Teamtastic",
    description: "Choose the virtual experience format that fits your team vibe. Discover live emcee-hosted game shows, custom trivia, and team-building events designed for remote and hybrid teams of any size.",
    url: "https://teamtastic.events/team-experiences",
  },
};

const categories = [
  {
    title: "Trivia & Quizzes",
    desc: "Classic trivia, custom company trivia, and knowledge challenges.",
    icon: Brain,
    color: "from-purple-500/20 to-purple-600/10 border-purple-500/30 text-purple-400"
  },
  {
    title: "Game Shows",
    desc: "High-energy game shows with fun hosts, buzzer rounds, and big wins.",
    icon: Tv,
    color: "from-pink-500/20 to-pink-600/10 border-pink-500/30 text-pink-400"
  },
  {
    title: "Bingo",
    desc: "Virtual bingo with fast-paced twists, music cues, and corporate prizes.",
    icon: Grid,
    color: "from-orange-500/20 to-orange-600/10 border-orange-500/30 text-orange-400"
  },
  {
    title: "Escape Rooms",
    desc: "Collaborative puzzles and missions that get everyone communicating.",
    icon: Lock,
    color: "from-emerald-500/20 to-emerald-600/10 border-emerald-500/30 text-emerald-400"
  },
  {
    title: "Music Games",
    desc: "Name that tune, lip sync battles, and themed audio trivia challenges.",
    icon: Music,
    color: "from-sky-500/20 to-sky-600/10 border-sky-500/30 text-sky-400"
  },
  {
    title: "Creative Challenges",
    desc: "Fun drawing canvas games and hilarious prompt pitches for teammates.",
    icon: Palette,
    color: "from-rose-500/20 to-rose-600/10 border-rose-500/30 text-rose-400"
  },
  {
    title: "Icebreakers",
    desc: "Great for new remote employees, intern cohorts, and onboarding teams.",
    icon: Users,
    color: "from-cyan-500/20 to-cyan-600/10 border-cyan-500/30 text-cyan-400"
  },
  {
    title: "Custom Experiences",
    desc: "We create custom rules, themes, and content for your goals.",
    icon: Wand2,
    color: "from-amber-500/20 to-amber-600/10 border-amber-500/30 text-amber-400"
  }
];

const benefits = [
  {
    title: "Stronger Connections",
    desc: "Break down corporate silos and build real, authentic relationships.",
    icon: Heart,
    color: "from-red-500/20 to-red-600/10 border-red-500/30 text-red-400"
  },
  {
    title: "High Energy",
    desc: "Michael and the Teamtastic hosts keep the energy high from start to finish.",
    icon: Zap,
    color: "from-amber-500/20 to-amber-600/10 border-amber-500/30 text-amber-400"
  },
  {
    title: "Laughs & Fun",
    desc: "Immersive virtual games your team will actually look forward to playing.",
    icon: Smile,
    color: "from-pink-500/20 to-pink-600/10 border-pink-500/30 text-pink-400"
  },
  {
    title: "Easy for Planners",
    desc: "We handle the hosting, logistics, and tech — you get all the credit!",
    icon: Sparkles,
    color: "from-purple-500/20 to-purple-600/10 border-purple-500/30 text-purple-400"
  },
  {
    title: "Memorable Moments",
    desc: "More than just a game; it's an experience that creates lasting team impact.",
    icon: Award,
    color: "from-emerald-500/20 to-emerald-600/10 border-emerald-500/30 text-emerald-400"
  }
];

const occasions = [
  { 
    label: "Remote Team Building", 
    icon: HomeIcon, 
    color: "from-sky-500/10 to-sky-600/5 border-sky-500/20 text-sky-400 hover:border-sky-500/40 hover:shadow-[0_0_15px_rgba(14,165,233,0.15)]" 
  },
  { 
    label: "Parties", 
    icon: PartyPopper, 
    color: "from-rose-500/10 to-rose-600/5 border-rose-500/20 text-rose-400 hover:border-rose-500/40 hover:shadow-[0_0_15px_rgba(244,63,94,0.15)]" 
  },
  { 
    label: "Employee Appreciation", 
    icon: Heart, 
    color: "from-red-500/10 to-red-600/5 border-red-500/20 text-red-400 hover:border-red-500/40 hover:shadow-[0_0_15px_rgba(239,68,68,0.15)]" 
  },
  { 
    label: "Onboarding & New Hire", 
    icon: UserPlus, 
    color: "from-emerald-500/10 to-emerald-600/5 border-emerald-500/20 text-emerald-400 hover:border-emerald-500/40 hover:shadow-[0_0_15px_rgba(16,185,129,0.15)]" 
  },
  { 
    label: "Leadership Retreats", 
    icon: Compass, 
    color: "from-amber-500/10 to-amber-600/5 border-amber-500/20 text-amber-400 hover:border-amber-500/40 hover:shadow-[0_0_15px_rgba(245,158,11,0.15)]" 
  },
  { 
    label: "Sales Kickoffs & Meetings", 
    icon: TrendingUp, 
    color: "from-orange-500/10 to-orange-600/5 border-orange-500/20 text-orange-400 hover:border-orange-500/40 hover:shadow-[0_0_15px_rgba(249,115,22,0.15)]" 
  },
  { 
    label: "Culture & DEI Initiatives", 
    icon: Globe, 
    color: "from-teal-500/10 to-teal-600/5 border-teal-500/20 text-teal-400 hover:border-teal-500/40 hover:shadow-[0_0_15px_rgba(20,184,166,0.15)]" 
  },
  { 
    label: "Milestone Celebrations", 
    icon: Trophy, 
    color: "from-yellow-500/10 to-yellow-600/5 border-yellow-500/20 text-yellow-400 hover:border-yellow-500/40 hover:shadow-[0_0_15px_rgba(234,179,8,0.15)]" 
  }
];

const faqs = [
  {
    q: "How long are the events?",
    a: "Our virtual team building events standardly run for 60 to 90 minutes. However, we can customize the runtime to fit your agenda, whether you need a quick 30-minute icebreaker or an extended 2-hour tournament."
  },
  {
    q: "Do players need to download anything?",
    a: "No downloads required! Teamtastic is 100% browser-based. Players simply join the Zoom, Teams, or Meet video call and click a link to play on their phone or computer in seconds."
  },
  {
    q: "Can this work for non-competitive teams?",
    a: "Absolutely. While we have competitive formats with live scoreboards, we specialize in collaborative drawing canvases, cooperative escape puzzles, and low-pressure logic challenges designed for bonding without high pressure."
  },
  {
    q: "How many people can participate?",
    a: "We accommodate groups of all sizes. Our self-service lobbies are great for up to 10-15 players, while our live-hosted events scale from 12 to 300+ players simultaneously, split into interactive teams."
  },
  {
    q: "Can we customize the experience?",
    a: "Yes, customization is our superpower! We can inject custom company trivia, inside jokes, team names, custom slides, and your company's logo/colors directly into the game interfaces."
  },
  {
    q: "How far in advance should we book?",
    a: "For self-service arcade play, you can launch immediately! For live-hosted VIP events, we recommend booking 2-4 weeks in advance to secure your preferred date, time, and emcee host."
  },
  {
    q: "What platforms do you support?",
    a: "We support Zoom, Microsoft Teams, Google Meet, Webex, and custom browser streams. If your team can join a video call, they can play Teamtastic."
  },
  {
    q: "Do you host the event?",
    a: "Yes! For our Professional and VIP tiers, a professionally trained, high-energy master emcee hosts the entire event live, facilitating screen sharing, music, and energy curation."
  }
];

export default function TeamExperiences() {
  return (
    <div className="flex flex-col min-h-screen bg-brand-dark">
      <main className="flex-1 bg-brand-dark text-white">
        
        {/* ══ CUSTOM HERO (DARK THEME) ══ */}
        <section className="relative overflow-hidden pt-24 pb-12 md:pt-32 md:pb-16">
          <div className="absolute inset-0 -z-10" style={{
            background: "radial-gradient(ellipse 90% 70% at 50% 0%, rgba(88,28,235,0.25) 0%, rgba(10,10,46,0.98) 60%, #030712 100%)"
          }} />
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -z-10 h-[250px] w-[700px] rounded-full blur-[90px]"
            style={{ background: "rgba(236,72,153,0.05)" }} />

          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-12 gap-12 items-center">
              
              {/* Left Column: Copy & CTAs */}
              <div className="lg:col-span-7 space-y-8 text-left">
                <div className="inline-flex items-center gap-2 rounded-full border border-purple-400/30 bg-purple-950/70 px-4.5 py-2 text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] shadow-[0_0_15px_rgba(168,85,247,0.2)] backdrop-blur-md">
                  <Sparkles className="h-3.5 w-3.5 text-amber-300 animate-pulse" />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-200 via-pink-200 to-amber-200">
                    Virtual Teambuilding Reimagined
                  </span>
                </div>

                <div className="space-y-4">
                  <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight">
                    Endless Ways to <br />Bring Your Team Together.
                  </h1>
                  <h2 className="text-2xl sm:text-3xl font-extrabold leading-snug">
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-purple to-brand-pink">
                      More Than Trivia. More Than Games.
                    </span>{" "}
                    <span className="text-white">A World of Team Experiences.</span>
                  </h2>
                  <p className="max-w-xl text-base sm:text-lg text-zinc-300 font-medium leading-relaxed pt-2">
                    Live-hosted virtual experiences that spark laughter, connection, competition, and celebration — designed for remote and hybrid teams of any size.
                  </p>
                </div>

                {/* Branded Icons Row (Play, Connect, Celebrate) */}
                <div className="flex flex-wrap items-center gap-x-8 gap-y-4 pt-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-brand-purple/20 flex items-center justify-center text-brand-purple border border-brand-purple/35 shadow-[0_0_10px_rgba(139,92,246,0.2)]">
                      <Gamepad2 className="h-4.5 w-4.5" />
                    </div>
                    <span className="text-sm font-bold text-zinc-200 uppercase tracking-widest">Play.</span>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-brand-pink/20 flex items-center justify-center text-brand-pink border border-brand-pink/35 shadow-[0_0_10px_rgba(236,72,153,0.2)]">
                      <Users className="h-4.5 w-4.5" />
                    </div>
                    <span className="text-sm font-bold text-zinc-200 uppercase tracking-widest">Connect.</span>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-brand-pink/20 flex items-center justify-center text-brand-pink border border-brand-pink/35 shadow-[0_0_10px_rgba(236,72,153,0.2)]">
                      <PartyPopper className="h-4.5 w-4.5" />
                    </div>
                    <span className="font-script text-brand-pink neon-glow-pink text-3xl rotate-[-2deg] inline-block tracking-wider transform origin-center">
                      Celebrate.
                    </span>
                  </div>
                </div>

                {/* CTA Buttons */}
                <div className="flex flex-col sm:flex-row items-center gap-4 pt-4">
                  <Link href="/#quiz"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4.5 rounded-2xl text-base font-bold text-white bg-[#D81B60] hover:bg-pink-600 shadow-[0_4px_14px_rgba(216,27,96,0.3)] transition-all duration-300 hover:-translate-y-1">
                    BOOK YOUR EVENT
                    <ArrowRight className="h-4.5 w-4.5" />
                  </Link>
                  <Link href="/games"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4.5 rounded-2xl text-base font-bold text-zinc-200 border border-white/10 hover:border-white/25 bg-white/5 hover:bg-white/10 hover:text-white transition-all duration-300 hover:-translate-y-1">
                    Explore Experiences
                  </Link>
                </div>

                {/* Stars Social Proof */}
                <div className="flex items-center gap-3 pt-4">
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star key={star} className="h-4.5 w-4.5 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <span className="text-xs font-bold tracking-wider text-zinc-400">
                    5-Star Reviews
                  </span>
                </div>
              </div>

              {/* Right Column: Hero Zoom Monitor Mockup */}
              <div className="lg:col-span-5 relative flex items-center justify-center">
                {/* Waving monitor image with background removed */}
                <img
                  src="/hero-zoom-monitor.png"
                  alt="Teamtastic Live Zoom Event"
                  className="w-full max-w-[500px] h-auto object-contain select-none pointer-events-none drop-shadow-[0_15px_40px_rgba(139,92,246,0.25)]"
                />

                {/* Floating yellow handwritten speech badge */}
                <div className="absolute -top-6 -right-4 md:-right-8 z-20 rotate-[6deg] bg-amber-400 text-zinc-950 px-4 py-2 rounded-2xl shadow-2xl font-script text-lg md:text-xl font-bold border-2 border-zinc-950 select-none pointer-events-none">
                  Hosted by Michael! <br />
                  <span className="float-right text-xs font-sans tracking-wide font-extrabold">— Your Host & Emcee</span>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ══ TRUSTED LOGOS BANNER (DARK THEME) ══ */}
        <section className="py-8 bg-zinc-950/60 border-y border-white/5 backdrop-blur-md">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center space-y-4">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 block">
              TRUSTED BY AMAZING COMPANIES
            </span>
            <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
              {/* Google */}
              <span className="text-xl font-bold tracking-tight font-sans cursor-default select-none hover:brightness-110 transition-all duration-200">
                <span className="text-[#4285F4]">G</span>
                <span className="text-[#EA4335]">o</span>
                <span className="text-[#FBBC05]">o</span>
                <span className="text-[#4285F4]">g</span>
                <span className="text-[#34A853]">l</span>
                <span className="text-[#EA4335]">e</span>
              </span>

              {/* Microsoft */}
              <span className="flex items-center gap-1.5 text-xl font-semibold tracking-tight text-white font-sans cursor-default select-none hover:text-zinc-100 transition-colors">
                <svg className="h-4.5 w-4.5 shrink-0" viewBox="0 0 23 23" fill="currentColor">
                  <rect x="0" y="0" width="10.5" height="10.5" fill="#F25022" />
                  <rect x="11.5" y="0" width="10.5" height="10.5" fill="#7FBA00" />
                  <rect x="0" y="11.5" width="10.5" height="10.5" fill="#00A4EF" />
                  <rect x="11.5" y="11.5" width="10.5" height="10.5" fill="#FFB900" />
                </svg>
                Microsoft
              </span>

              {/* Amazon */}
              <span className="flex flex-col items-center justify-center cursor-default select-none hover:brightness-110 transition-all duration-200">
                <span className="text-xl font-bold tracking-tight text-white font-sans leading-none">amazon</span>
                <svg className="h-1.5 w-12 text-[#FF9900]" viewBox="0 0 48 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M2 2C10 5 38 5 46 2" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                  <path d="M41 4L46 2L43 0.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>

              {/* Deloitte */}
              <span className="text-xl font-extrabold tracking-tight text-white font-sans cursor-default select-none hover:text-zinc-100 transition-colors">
                Deloitte<span className="text-[#86BC25]">.</span>
              </span>

              {/* HubSpot */}
              <span className="text-xl font-semibold tracking-tight text-[#FF7A59] font-sans cursor-default select-none hover:brightness-110 transition-all duration-200">
                HubSpot
              </span>

              {/* Salesforce */}
              <span className="text-xl font-bold tracking-tight text-[#00A1E0] font-sans cursor-default select-none hover:brightness-110 transition-all duration-200">
                salesforce
              </span>

              {/* Adobe */}
              <span className="flex items-center gap-1.5 text-xl font-bold tracking-tight text-white font-sans cursor-default select-none hover:text-zinc-100 transition-colors">
                <svg className="h-4.5 w-4.5 shrink-0 text-[#FF0000]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2L2 22h4.5l3.5-8h4l3.5 8H22L12 2zm0 6l3 7H9l3-7z"/>
                </svg>
                Adobe
              </span>
            </div>
          </div>
        </section>

        {/* ══ CORE VALUE PROP STATEMENT (DARK THEME WITH GRADIENTS) ══ */}
        <section className="py-16 sm:py-20 relative overflow-hidden bg-brand-dark">
          <div className="absolute inset-0 -z-10" style={{
            background: "radial-gradient(circle at 50% 50%, rgba(139,92,246,0.08) 0%, transparent 70%)"
          }} />
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center space-y-6 relative z-10">
            <h2 className="text-2xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight font-sans">
              <span className="block">The Virtual Team Building Event</span>
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-brand-purple via-pink-400 to-brand-pink drop-shadow-[0_2px_15px_rgba(168,85,247,0.2)] mt-1 sm:mt-2">
                People Actually Want to Attend.
              </span>
            </h2>
            <div className="w-16 h-1 bg-gradient-to-r from-brand-purple to-brand-pink rounded-full mx-auto my-3" />
            <p className="max-w-2xl mx-auto text-lg sm:text-xl text-zinc-300 font-medium leading-relaxed">
              Zero technical hassle for you. Unforgettable energy, custom trivia, and deep connection for your remote team.
            </p>
          </div>
        </section>

        {/* ══ A WORLD OF TEAM EXPERIENCES (DARK THEME) ══ */}
        <section id="games" className="py-12 md:py-16 relative">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center space-y-4 mb-12">
              <h2 className="text-3xl font-extrabold tracking-tight sm:text-5xl text-white flex flex-wrap items-center justify-center gap-2">
                A World of{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-purple to-brand-pink">
                  Team Experiences
                </span>
              </h2>
              <p className="text-zinc-400 max-w-lg mx-auto text-base">
                Choose the experience that fits your team, goals and occasion.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
              {categories.map((cat) => {
                const Icon = cat.icon;
                return (
                  <div
                    key={cat.title}
                    className={`glassmorphism rounded-3xl p-6 flex flex-col justify-between border border-white/5 hover:border-brand-purple/30 hover:shadow-[0_0_30px_rgba(139,92,246,0.15)] transition-all duration-300 hover:-translate-y-1 group bg-gradient-to-br ${cat.color}`}
                  >
                    <div className="space-y-4">
                      <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/5">
                        <Icon className="h-5 w-5" />
                      </div>
                      <h3 className="text-xl font-bold text-white group-hover:text-purple-300 transition-colors">
                        {cat.title}
                      </h3>
                      <p className="text-xs text-zinc-400 leading-relaxed min-h-[48px]">
                        {cat.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-12 text-center">
              <Link
                href="/games"
                className="inline-flex items-center gap-2 text-sm font-bold text-brand-purple hover:text-purple-400 transition-colors group"
              >
                <span>And so much more! If you can imagine it, we can host it.</span>
                <span className="font-extrabold uppercase tracking-wider text-xs border-b border-brand-purple group-hover:border-purple-400 pb-0.5 ml-1">
                  See all experiences
                </span>
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </section>

        {/* ══ HOW IT WORKS TIMELINE (DARK THEME) ══ */}
        <section className="py-12 md:py-16 bg-zinc-950/40 border-y border-white/5">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center space-y-4 mb-12">
              <h2 className="text-3xl font-extrabold tracking-tight sm:text-5xl text-white flex items-center justify-center gap-4">
                <span className="hidden md:inline text-white/10">──</span>
                How It Works
                <span className="hidden md:inline text-white/10">──</span>
              </h2>
              <p className="text-zinc-400 max-w-lg mx-auto text-base">
                Frictionless, live-hosted corporate game shows structured in four simple steps.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 max-w-6xl mx-auto relative">
              {/* Timeline Connector Line */}
              <div className="hidden md:block absolute top-14 left-[12.5%] right-[12.5%] h-[2px] bg-white/5 -z-10" />

              {/* Step 1 */}
              <div className="text-center space-y-4 relative">
                <div className="w-12 h-12 rounded-full bg-brand-purple/15 border border-brand-purple/30 text-brand-purple flex items-center justify-center font-extrabold mx-auto text-lg shadow-[0_0_15px_rgba(139,92,246,0.15)] bg-zinc-950">
                  1
                </div>
                <h3 className="text-lg font-bold text-white">Pick Your Experience</h3>
                <p className="text-xs text-zinc-400 max-w-xs mx-auto leading-relaxed">
                  Choose a theme, game format, and timing structure that fits your team&apos;s goals.
                </p>
              </div>

              {/* Step 2 */}
              <div className="text-center space-y-4 relative">
                <div className="w-12 h-12 rounded-full bg-brand-pink/15 border border-brand-pink/30 text-brand-pink flex items-center justify-center font-extrabold mx-auto text-lg shadow-[0_0_15px_rgba(236,72,153,0.15)] bg-zinc-950">
                  2
                </div>
                <h3 className="text-lg font-bold text-white">We Customize It</h3>
                <p className="text-xs text-zinc-400 max-w-xs mx-auto leading-relaxed">
                  We inject customized company trivia, inside jokes, and branding directly into the game.
                </p>
              </div>

              {/* Step 3 */}
              <div className="text-center space-y-4 relative">
                <div className="w-12 h-12 rounded-full bg-brand-orange/15 border border-brand-orange/30 text-brand-orange flex items-center justify-center font-extrabold mx-auto text-lg shadow-[0_0_15px_rgba(249,115,22,0.15)] bg-zinc-950">
                  3
                </div>
                <h3 className="text-lg font-bold text-white">Join & Play</h3>
                <p className="text-xs text-zinc-400 max-w-xs mx-auto leading-relaxed">
                  Your team joins on Zoom, Teams, or Meet and plays directly in their browser.
                </p>
              </div>

              {/* Step 4 */}
              <div className="text-center space-y-4 relative">
                <div className="w-12 h-12 rounded-full bg-brand-gold/15 border border-brand-gold/30 text-brand-gold flex items-center justify-center font-extrabold mx-auto text-lg shadow-[0_0_15px_rgba(251,191,36,0.15)] bg-zinc-950">
                  4
                </div>
                <h3 className="text-lg font-bold text-white">Celebrate Together</h3>
                <p className="text-xs text-zinc-400 max-w-xs mx-auto leading-relaxed">
                  Crowning champions, tracking live leaderboards, and wrapping up with virtual confetti!
                </p>
              </div>
            </div>
          </div>
        </section>

        <CtaBannerWithModal />

        {/* ══ WHY TEAMS LOVE TEAMTASTIC (DARK) ══ */}
        <section className="py-12 md:py-16 bg-brand-dark">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center space-y-4 mb-12">
              <h2 className="text-3xl font-extrabold tracking-tight sm:text-5xl text-white">
                Why Teams Love <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-purple to-brand-pink">Teamtastic</span>
              </h2>
              <p className="text-zinc-400 max-w-lg mx-auto text-base">
                We design our experiences to drive authentic connection, leaving players feeling closer and re-energized.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-6 max-w-6xl mx-auto">
              {benefits.map((b) => {
                const Icon = b.icon;
                return (
                  <div
                    key={b.title}
                    className="glassmorphism-card rounded-2xl p-6 border border-white/5 hover:border-brand-purple/20 transition-all duration-300 text-left flex flex-col justify-between"
                  >
                    <div className="space-y-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center border ${b.color}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <h3 className="text-base font-bold text-white">{b.title}</h3>
                      <p className="text-xs text-zinc-400 leading-relaxed">
                        {b.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ══ PERFECT FOR ANY OCCASION (DARK) ══ */}
        <section className="py-12 bg-zinc-950/40 border-y border-white/5">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center space-y-12">
            <div className="space-y-4">
              <h2 className="text-3xl font-extrabold tracking-tight sm:text-5xl text-white">
                Perfect for Any Occasion
              </h2>
              <p className="text-zinc-400 max-w-lg mx-auto text-base">
                We align gameshow mechanics, pacing, and music selections to match your specific objective.
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto justify-center">
              {occasions.map((o) => {
                const Icon = o.icon;
                return (
                  <div
                    key={o.label}
                    className={`glassmorphism-card rounded-xl p-4 border transition-all flex flex-col items-center justify-center text-center gap-3 bg-gradient-to-br ${o.color}`}
                  >
                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/5 shadow-inner">
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-wide leading-tight">
                      {o.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ══ CUSTOMIZED / LEADERBOARD & TESTIMONIAL SPLIT SECTION (DARK) ══ */}
        <section className="py-12 md:py-16 bg-brand-dark">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-12 gap-12 items-start max-w-6xl mx-auto">
              
              {/* Left Column - Customized Checklist & Laptop/Phone Leaderboard Mockup */}
              <div className="lg:col-span-6 space-y-8 text-left">
                <div className="space-y-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-brand-purple">
                    CUSTOMIZED FOR YOUR TEAM
                  </span>
                  <h2 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight leading-tight">
                    Tailored To Your Brand <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-purple to-brand-pink">
                      And Culture.
                    </span>
                  </h2>
                  <p className="text-zinc-300 text-sm md:text-base leading-relaxed">
                    We don&apos;t run dry template quizzes. Our creative team helps customize the content, visuals, and prompts to make the event feel unique.
                  </p>
                </div>

                <ul className="space-y-3.5 pt-2">
                  {[
                    "Company trivia & branded question content",
                    "Team names, inside jokes & player shoutouts",
                    "Custom themes, slides, music & awards",
                    "Holiday themes & special milestones",
                    "DEI-friendly & globally inclusive challenges"
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <div className="mt-1 h-5 w-5 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                        <Check className="h-3 w-3" />
                      </div>
                      <span className="text-sm text-zinc-200 font-medium leading-normal">{item}</span>
                    </li>
                  ))}
                </ul>

                <div className="pt-2">
                  <Link
                    href="/#quiz"
                    className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-xs font-bold text-white bg-[#D81B60] hover:bg-pink-600 shadow-md shadow-pink-500/20 hover:scale-[1.02] transition-all"
                  >
                    PLAN MY CUSTOM EVENT
                    <ArrowRight className="h-4 w-4 text-white" />
                  </Link>
                </div>

                {/* ── Tailwind Device Mockups (Monitor + Phone) showing Leaderboard ── */}
                <div className="relative pt-12 pb-16 flex flex-col items-center justify-center max-w-[450px] mx-auto w-full">
                  {/* Relative wrapper for Screen + Phone to ensure perfect overlap alignment without clipping */}
                  <div className="relative z-10">
                    {/* Monitor Screen Frame */}
                    <div className="w-[300px] sm:w-[320px] aspect-[16/10] bg-slate-900 rounded-2xl border-4 border-slate-700 relative shadow-2xl overflow-hidden">
                      {/* Screen Content */}
                      <div className="w-full h-full bg-[#0B0B1E] p-3 text-white flex flex-col justify-between font-sans">
                        {/* Monitor Screen Header */}
                        <div className="flex items-center justify-between border-b border-white/5 pb-1.5 animate-pulse">
                          <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span className="text-[7px] font-bold text-white uppercase tracking-widest font-mono">Live Tournament Board</span>
                          </div>
                          <span className="text-[7px] font-bold text-brand-pink uppercase tracking-wider bg-brand-pink/10 px-1.5 py-0.5 rounded border border-brand-pink/20">ACME ALL STARS!</span>
                        </div>

                        {/* Screen Leaderboard List */}
                        <div className="space-y-1.5 flex-grow pt-3">
                          {/* Leader 1 */}
                          <div className="flex items-center justify-between p-1.5 bg-brand-purple/20 border border-brand-purple/30 rounded-lg">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[9px]">🥇</span>
                              <span className="text-[9px] font-bold text-white">Dream Team</span>
                            </div>
                            <span className="text-[8px] font-mono font-bold text-brand-purple">3,850 pts</span>
                          </div>

                          {/* Leader 2 */}
                          <div className="flex items-center justify-between p-1.5 bg-white/5 border border-white/5 rounded-lg">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[9px]">🥈</span>
                              <span className="text-[9px] font-bold text-zinc-300">Quiz Masters</span>
                            </div>
                            <span className="text-[8px] font-mono font-semibold text-zinc-400">3,620 pts</span>
                          </div>

                          {/* Leader 3 */}
                          <div className="flex items-center justify-between p-1.5 bg-white/5 border border-white/5 rounded-lg">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[9px]">🥉</span>
                              <span className="text-[9px] font-bold text-zinc-300">Game Changers</span>
                            </div>
                            <span className="text-[8px] font-mono font-semibold text-zinc-400">3,450 pts</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Phone Mockup (overlapping bottom-left of the monitor) */}
                    <div className="w-[75px] h-[145px] bg-[#0B0B1E] border-4 border-slate-700 rounded-xl absolute -bottom-6 -left-6 z-20 shadow-2xl overflow-hidden flex flex-col justify-between p-1.5 font-sans text-white">
                      {/* Screen status bar */}
                      <div className="flex justify-between items-center text-[5px] text-zinc-400">
                        <span>9:41</span>
                        <span className="w-1 h-1 rounded-full bg-zinc-700"></span>
                        <span>📶 🔋</span>
                      </div>

                      {/* Phone Leaderboard mini */}
                      <div className="space-y-1 my-auto">
                        <div className="text-[6px] font-extrabold text-brand-pink border-b border-white/5 pb-1 text-center font-mono">ACME LOBBY</div>
                        
                        <div className="p-1 bg-brand-purple/30 rounded border border-brand-purple/20 flex justify-between items-center text-[5px] font-bold">
                          <span>🥇 Dream</span>
                          <span>3.8k</span>
                        </div>
                        <div className="p-1 bg-white/5 rounded flex justify-between items-center text-[5px]">
                          <span>🥈 Quiz</span>
                          <span>3.6k</span>
                        </div>
                        <div className="p-1 bg-white/5 rounded flex justify-between items-center text-[5px]">
                          <span>🥉 Game</span>
                          <span>3.4k</span>
                        </div>
                      </div>

                      {/* Home Indicator */}
                      <div className="w-8 h-0.5 bg-zinc-700 rounded-full mx-auto mt-0.5"></div>
                    </div>
                  </div>

                  {/* Monitor Stand Neck and Base */}
                  <div className="flex flex-col items-center -mt-[1px] relative z-0">
                    {/* Stand neck */}
                    <div className="w-10 h-10 bg-gradient-to-b from-slate-600 to-slate-700 border-x border-slate-800/30 shadow-inner" />
                    {/* Stand base */}
                    <div className="w-28 h-3 bg-gradient-to-r from-slate-500 via-slate-450 to-slate-500 rounded-t-lg shadow-md border-t border-slate-400" />
                  </div>
                </div>
              </div>
              
              {/* Right Column - What Teams Are Saying Testimonial block */}
              <div className="lg:col-span-6 w-full lg:sticky lg:top-28">
                <TestimonialsCarousel />
              </div>

            </div>
          </div>
        </section>

        <CustomIdeaFooterSection />

        {/* ══ FREQUENTLY ASKED QUESTIONS (DARK 2-COLUMN) ══ */}
        <section className="py-12 md:py-16 bg-zinc-950/40 border-t border-white/5">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-16">
            <div className="text-center space-y-4 max-w-xl mx-auto">
              <span className="text-xs font-bold uppercase tracking-wider text-brand-purple">RESOLVING FRICTION</span>
              <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
                Frequently Asked Questions
              </h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-5xl mx-auto items-start">
              {/* Accordions double columns */}
              <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                {faqs.map((faq, idx) => (
                  <details 
                    key={idx} 
                    className="group glassmorphism rounded-2xl border border-white/5 overflow-hidden transition-all duration-300 [&_summary::-webkit-details-marker]:hidden"
                  >
                    <summary className="flex items-center justify-between p-6 cursor-pointer font-bold text-white hover:text-brand-pink transition-colors list-none">
                      <span className="text-sm">{faq.q}</span>
                      <ChevronDown className="h-4.5 w-4.5 text-zinc-400 transition-transform group-open:rotate-180 group-open:text-brand-pink shrink-0" />
                    </summary>
                    <div className="p-6 pt-0 border-t border-white/5 text-xs text-zinc-400 leading-relaxed bg-zinc-900/10">
                      {faq.a}
                    </div>
                  </details>
                ))}
              </div>

              {/* Chat Sidebar Box */}
              <div className="lg:col-span-4 glassmorphism rounded-3xl p-6 border border-white/10 space-y-4 text-center bg-zinc-950/40">
                <div className="w-12 h-12 rounded-2xl bg-brand-purple/10 flex items-center justify-center text-brand-purple border border-brand-purple/20 mx-auto">
                  <Users className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-white">
                  Let&apos;s talk about your event!
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  We&apos;ll help you plan something your team will love.
                </p>
                <a 
                  href="mailto:hello@teamtastic.events" 
                  className="w-full flex h-11 items-center justify-center gap-2 rounded-xl text-xs font-bold text-white bg-brand-purple hover:bg-brand-purple/90 shadow-md transition-all uppercase tracking-wider"
                >
                  Chat with us
                </a>
              </div>
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}
