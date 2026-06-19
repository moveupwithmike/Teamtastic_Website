import Hero from "@/components/Hero";
import GameQuiz from "@/components/GameQuiz";
import SoloDemo from "@/components/SoloDemo";
import Pricing from "@/components/Pricing";
import { 
  Gamepad2, 
  Sparkles, 
  Users, 
  Award, 
  ArrowRight, 
  Zap, 
  Target, 
  Music, 
  Tv, 
  Lock, 
  Palette, 
  Grid, 
  Brain, 
  Wand2, 
  CheckCircle2, 
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
  Smile
} from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "Virtual Team Experiences & Live Hosted Game Shows | Teamtastic",
  description: "Choose the virtual experience format that fits your team vibe. Discover live emcee-hosted game shows, custom trivia, and team-building events designed for remote and hybrid teams.",
  alternates: {
    canonical: "https://teamtastic.events/team-experiences",
  },
  openGraph: {
    title: "Virtual Team Experiences & Live Hosted Game Shows | Teamtastic",
    description: "Choose the virtual experience format that fits your team vibe. Discover live emcee-hosted game shows, custom trivia, and team-building events designed for remote and hybrid teams.",
    url: "https://teamtastic.events/team-experiences",
  },
};

const categories = [
  {
    title: "Trivia & Quizzes",
    desc: "Classic trivia, custom company trivia, and quick logical challenges.",
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
  { label: "Remote Team Building", icon: HomeIcon },
  { label: "Hybrid Team Events", icon: Layers },
  { label: "Holiday Parties", icon: PartyPopper },
  { label: "Employee Appreciation", icon: Heart },
  { label: "Onboarding & New Hire", icon: UserPlus },
  { label: "Leadership Retreats", icon: Compass },
  { label: "Sales Kickoffs & Meetings", icon: TrendingUp },
  { label: "Culture & DEI Initiatives", icon: Globe },
  { label: "Milestone Celebrations", icon: Trophy }
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
  },
  {
    q: "Still have questions?",
    a: "We are here to help! You can contact us directly at hello@teamtastic.events or start our Event Quiz to describe your team, and we will get back to you with custom details."
  }
];

export default function TeamExperiences() {
  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-1">
        {/* Dynamic Mock Stage Hero */}
        <Hero />

        {/* Social Proof / Trusted logos banner */}
        <section className="py-10 bg-zinc-950/60 border-y border-white/5 backdrop-blur-md">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center space-y-6">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 block">
              TRUSTED BY AMAZING COMPANIES
            </span>
            <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6 opacity-60">
              <span className="text-xl font-bold tracking-tight text-zinc-400 font-sans hover:text-white transition-colors cursor-default">Google</span>
              <span className="text-xl font-semibold tracking-tight text-zinc-400 font-sans hover:text-white transition-colors cursor-default">Microsoft</span>
              <span className="text-xl font-bold tracking-tight text-zinc-400 font-sans hover:text-white transition-colors cursor-default">amazon</span>
              <span className="text-xl font-extrabold tracking-tight text-zinc-400 font-sans hover:text-white transition-colors cursor-default">Deloitte.</span>
              <span className="text-xl font-semibold tracking-tight text-zinc-400 font-sans hover:text-white transition-colors cursor-default">HubSpot</span>
              <span className="text-xl font-bold tracking-tight text-zinc-400 font-sans hover:text-white transition-colors cursor-default">salesforce</span>
              <span className="text-xl font-bold tracking-tight text-zinc-400 font-sans hover:text-white transition-colors cursor-default">Adobe</span>
            </div>
          </div>
        </section>

        {/* B2B Stats Banner */}
        <section className="py-12 bg-zinc-950/40 border-b border-white/5">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              <div className="space-y-1">
                <span className="text-4xl font-extrabold text-white">40k+</span>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Active Players</p>
              </div>
              <div className="space-y-1">
                <span className="text-4xl font-extrabold text-purple-400">98%</span>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Engagement Score</p>
              </div>
              <div className="space-y-1">
                <span className="text-4xl font-extrabold text-pink-400">1,200+</span>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Lobbies Launched</p>
              </div>
              <div className="space-y-1">
                <span className="text-4xl font-extrabold text-amber-400">0</span>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Downloads Required</p>
              </div>
            </div>
          </div>
        </section>

        {/* A World of Team Experiences */}
        <section id="games" className="py-20 md:py-28 relative">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center space-y-4 mb-16">
              <h2 className="text-3xl font-extrabold tracking-tight sm:text-5xl text-white flex flex-wrap items-center justify-center gap-2">
                A World of{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-purple to-brand-pink">
                  Team Experiences
                </span>
              </h2>
              <p className="text-zinc-400 max-w-lg mx-auto text-base">
                Choose the virtual experience format that fits your team vibe, event duration, and occasion.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
              {categories.map((cat) => {
                const Icon = cat.icon;
                return (
                  <div
                    key={cat.title}
                    className={`glassmorphism rounded-3xl p-6 flex flex-col justify-between border hover:border-brand-purple/30 transition-all duration-300 hover:-translate-y-1 group bg-gradient-to-br ${cat.color}`}
                  >
                    <div className="space-y-4">
                      <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
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

            <div className="mt-16 text-center">
              <Link
                href="/games"
                className="relative inline-flex items-center gap-2 px-8 py-4 rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-lg shadow-purple-500/20 hover:scale-[1.03] active:scale-95 transition-all duration-300 group"
              >
                <span>And so much more! If you can imagine it, we can host it. See all experiences</span>
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-20 md:py-28 bg-zinc-950/40 border-y border-white/5">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center space-y-4 mb-16">
              <h2 className="text-3xl font-extrabold tracking-tight sm:text-5xl text-white">
                How It Works
              </h2>
              <p className="text-zinc-400 max-w-lg mx-auto text-base">
                Frictionless, live-hosted corporate game shows structured in three simple steps.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 max-w-6xl mx-auto relative">
              {/* Timeline Connector Line */}
              <div className="hidden md:block absolute top-14 left-[12.5%] right-[12.5%] h-[2px] bg-white/5 -z-10" />

              {/* Step 1 */}
              <div className="text-center space-y-4 relative">
                <div className="w-12 h-12 rounded-full bg-brand-purple/10 border border-brand-purple/20 text-brand-purple flex items-center justify-center font-extrabold mx-auto text-lg shadow-[0_0_15px_rgba(139,92,246,0.15)] bg-zinc-950">
                  1
                </div>
                <h3 className="text-lg font-bold text-white">Pick Your Experience</h3>
                <p className="text-xs text-zinc-400 max-w-xs mx-auto leading-relaxed">
                  Choose a theme, game format, and timing structure that fits your team&apos;s goals.
                </p>
              </div>

              {/* Step 2 */}
              <div className="text-center space-y-4 relative">
                <div className="w-12 h-12 rounded-full bg-brand-pink/10 border border-brand-pink/20 text-brand-pink flex items-center justify-center font-extrabold mx-auto text-lg shadow-[0_0_15px_rgba(236,72,153,0.15)] bg-zinc-950">
                  2
                </div>
                <h3 className="text-lg font-bold text-white">We Customize It</h3>
                <p className="text-xs text-zinc-400 max-w-xs mx-auto leading-relaxed">
                  We inject customized company trivia, inside jokes, and branding directly into the game.
                </p>
              </div>

              {/* Step 3 */}
              <div className="text-center space-y-4 relative">
                <div className="w-12 h-12 rounded-full bg-brand-orange/10 border border-brand-orange/20 text-brand-orange flex items-center justify-center font-extrabold mx-auto text-lg shadow-[0_0_15px_rgba(249,115,22,0.15)] bg-zinc-950">
                  3
                </div>
                <h3 className="text-lg font-bold text-white">Join & Play</h3>
                <p className="text-xs text-zinc-400 max-w-xs mx-auto leading-relaxed">
                  Your team joins on Zoom, Teams, or Meet and plays directly in their browser.
                </p>
              </div>

              {/* Step 4 */}
              <div className="text-center space-y-4 relative">
                <div className="w-12 h-12 rounded-full bg-brand-gold/10 border border-brand-gold/20 text-brand-gold flex items-center justify-center font-extrabold mx-auto text-lg shadow-[0_0_15px_rgba(251,191,36,0.15)] bg-zinc-950">
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

        {/* Ribbon Promo Banner */}
        <section className="w-full py-8 bg-gradient-to-r from-brand-purple via-purple-600 to-brand-pink text-center shadow-[0_0_30px_rgba(139,92,246,0.2)]">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-center gap-6">
            <h3 className="text-lg md:text-xl font-bold text-white tracking-wide">
              🎉 Ready to Bring Your Team Together? Let&apos;s create an unforgettable experience.
            </h3>
            <Link
              href="/#quiz"
              className="px-6 py-2.5 rounded-xl bg-white text-zinc-950 font-bold text-xs hover:bg-zinc-100 transition-all shadow-md shrink-0 flex items-center gap-1.5"
            >
              Book Your Event
              <ArrowRight className="h-3.5 w-3.5 text-zinc-950" />
            </Link>
          </div>
        </section>

        {/* Why Teams Love Teamtastic */}
        <section className="py-20 md:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center space-y-4 mb-16">
              <h2 className="text-3xl font-extrabold tracking-tight sm:text-5xl text-white">
                Why Teams Love Teamtastic
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
                      <div className={`w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center ${b.color}`}>
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

        {/* Perfect for Any Occasion */}
        <section className="py-20 bg-zinc-950/40 border-y border-white/5">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center space-y-12">
            <div className="space-y-4">
              <h2 className="text-3xl font-extrabold tracking-tight sm:text-5xl text-white">
                Perfect for Any Occasion
              </h2>
              <p className="text-zinc-400 max-w-lg mx-auto text-base">
                We align gameshow mechanics, pacing, and music selections to match your specific objective.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-9 gap-4 max-w-6xl mx-auto justify-center">
              {occasions.map((o) => {
                const Icon = o.icon;
                return (
                  <div
                    key={o.label}
                    className="glassmorphism-card rounded-xl p-4 border border-white/5 hover:border-white/10 hover:bg-white/[0.03] transition-all flex flex-col items-center justify-center text-center gap-3"
                  >
                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-brand-purple">
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

        {/* Customized for Your Team split section */}
        <section className="py-20 md:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-12 gap-12 items-center max-w-6xl mx-auto">
              {/* Left Column - Checklist */}
              <div className="lg:col-span-6 space-y-6 text-left">
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

                <ul className="space-y-3.5 pt-2">
                  {[
                    "Company trivia & branded question content",
                    "Team names, inside jokes & player shoutouts",
                    "Custom themes, slides, music & awards",
                    "Holiday themes & special milestones",
                    "DEI-friendly & globally inclusive challenges"
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <div className="mt-1 h-4.5 w-4.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                        <Check className="h-2.5 w-2.5" />
                      </div>
                      <span className="text-xs text-zinc-200 font-medium leading-normal">{item}</span>
                    </li>
                  ))}
                </ul>

                <div className="pt-4">
                  <Link
                    href="/#quiz"
                    className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-xs font-bold text-zinc-950 bg-white hover:bg-zinc-200 transition-all shadow-md"
                  >
                    Plan My Custom Event
                    <ArrowRight className="h-4 w-4 text-zinc-950" />
                  </Link>
                </div>
              </div>

              {/* Right Column - Mockup Preview Card */}
              <div className="lg:col-span-6 w-full">
                <div className="glassmorphism rounded-3xl p-6 border border-white/10 relative overflow-hidden bg-zinc-950/40">
                  <div className="absolute top-0 right-0 p-4 opacity-5 text-8xl pointer-events-none">🏆</div>
                  
                  {/* Mock App Leaderboard */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-white/5 pb-4">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] font-bold text-white uppercase tracking-widest font-mono">Live Tournament Board</span>
                      </div>
                      <span className="text-[10px] font-bold text-brand-pink uppercase tracking-wider bg-brand-pink/10 px-2 py-0.5 rounded border border-brand-pink/20">ACME ALL STARS!</span>
                    </div>

                    <div className="space-y-3 pt-2">
                      {/* Leader 1 */}
                      <div className="flex items-center justify-between p-3.5 bg-brand-purple/20 border border-brand-purple/40 rounded-xl">
                        <div className="flex items-center gap-3">
                          <span className="text-base">🥇</span>
                          <span className="text-xs font-bold text-white">Dream Team</span>
                        </div>
                        <span className="text-xs font-mono font-bold text-brand-purple">3,850 pts</span>
                      </div>

                      {/* Leader 2 */}
                      <div className="flex items-center justify-between p-3.5 bg-white/5 border border-white/5 rounded-xl">
                        <div className="flex items-center gap-3">
                          <span className="text-base">🥈</span>
                          <span className="text-xs font-bold text-zinc-300">Quiz Masters</span>
                        </div>
                        <span className="text-xs font-mono font-semibold text-zinc-400">3,620 pts</span>
                      </div>

                      {/* Leader 3 */}
                      <div className="flex items-center justify-between p-3.5 bg-white/5 border border-white/5 rounded-xl">
                        <div className="flex items-center gap-3">
                          <span className="text-base">🥉</span>
                          <span className="text-xs font-bold text-zinc-300">Game Changers</span>
                        </div>
                        <span className="text-xs font-mono font-semibold text-zinc-400">3,450 pts</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
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
                Try our playable mini-quiz to see how we sync question slides, reaction triggers, and scoring to wow remote teams.
              </p>
            </div>
            <SoloDemo />
          </div>
        </section>

        {/* Interactive Event Planner Quiz */}
        <GameQuiz />

        {/* Standalone Pricing Component */}
        <Pricing />

        {/* Frequently Asked Questions accordion */}
        <section className="py-20 md:py-28 bg-zinc-950/40 border-t border-white/5">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-16">
            <div className="text-center space-y-4 max-w-xl mx-auto">
              <span className="text-xs font-bold uppercase tracking-wider text-brand-purple">RESOLVING FRICTION</span>
              <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
                Frequently Asked Questions
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-4 max-w-3xl mx-auto">
              {faqs.map((faq, idx) => (
                <details 
                  key={idx} 
                  className="group glassmorphism rounded-2xl border border-white/5 overflow-hidden transition-all duration-300 [&_summary::-webkit-details-marker]:hidden"
                >
                  <summary className="flex items-center justify-between p-6 cursor-pointer font-bold text-white hover:text-brand-pink transition-colors list-none">
                    <span>{faq.q}</span>
                    <ChevronDown className="h-5 w-5 text-zinc-400 transition-transform group-open:rotate-180 group-open:text-brand-pink shrink-0" />
                  </summary>
                  <div className="p-6 pt-0 border-t border-white/5 text-xs text-zinc-400 leading-relaxed">
                    {faq.a}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Footer CTA Banner with Michael Cutout */}
        <section className="py-20 relative overflow-hidden bg-zinc-950 border-t border-white/5">
          <div className="absolute inset-0 -z-10" style={{
            background: "radial-gradient(circle at 80% 50%, rgba(139,92,246,0.15) 0%, transparent 60%)"
          }} />
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="glassmorphism rounded-3xl border border-white/10 p-8 md:p-12 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-12 bg-gradient-to-br from-brand-card/90 via-zinc-950/95 to-brand-purple/15">
              {/* Left Column Content */}
              <div className="max-w-xl text-left space-y-6 z-10">
                <h2 className="text-3xl md:text-5xl font-extrabold text-white leading-tight">
                  Let&apos;s Create an Experience <br />Your Team Will Remember.
                </h2>
                <h3 className="text-2xl md:text-3xl font-extrabold text-white flex flex-wrap items-center gap-x-2 gap-y-1.5">
                  <span>Play. Connect.</span>
                  <span className="font-script text-brand-pink neon-glow-pink text-3xl md:text-4xl inline-block" style={{ transform: "rotate(-2deg)" }}>Celebrate.</span>
                </h3>
                <p className="text-zinc-300 text-sm md:text-base leading-relaxed">
                  Book your event today and leave the rest to us! We manage the games, screen sharing, music, and energy curation so your host can enjoy the show.
                </p>
                <div className="flex flex-col sm:flex-row items-center gap-4 pt-2">
                  <Link href="/#quiz" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-lg shadow-purple-500/20 hover:scale-[1.02] transition-all">
                    Book Your Event
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <a href="mailto:hello@teamtastic.events" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-sm font-bold text-zinc-300 border border-white/10 bg-white/5 hover:bg-white/10 hover:text-white transition-all hover:scale-[1.02]">
                    Talk to Michael
                  </a>
                </div>
              </div>

              {/* Right Column Emcee Image */}
              <div className="relative w-[280px] h-[340px] md:w-[320px] md:h-[400px] shrink-0 self-end -mb-12 md:-mb-16 z-10 flex items-end justify-center">
                <img
                  src="/emcee-engaged-transparent.png"
                  alt="Michael - Master Emcee"
                  className="max-h-full w-auto object-contain select-none pointer-events-none"
                />
                {/* Handwritten Speech bubble / yellow arrow */}
                <div className="absolute -top-4 -left-6 md:-left-12 rotate-[-6deg] bg-amber-400 text-zinc-950 px-4 py-2 rounded-2xl shadow-xl font-script text-lg md:text-xl font-bold border-2 border-zinc-950">
                  I can&apos;t wait to host your event! <br />
                  <span className="float-right text-sm font-sans tracking-wide font-extrabold">— Michael</span>
                </div>
              </div>
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}
