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
    icon: Brain
  },
  {
    title: "Game Shows",
    desc: "High-energy game shows with fun hosts, buzzer rounds, and big wins.",
    icon: Tv
  },
  {
    title: "Bingo",
    desc: "Virtual bingo with fast-paced twists, music cues, and corporate prizes.",
    icon: Grid
  },
  {
    title: "Escape Rooms",
    desc: "Collaborative puzzles and missions that get everyone communicating.",
    icon: Lock
  },
  {
    title: "Music Games",
    desc: "Name that tune, lip sync battles, and themed audio trivia challenges.",
    icon: Music
  },
  {
    title: "Creative Challenges",
    desc: "Fun drawing canvas games and hilarious prompt pitches for teammates.",
    icon: Palette
  },
  {
    title: "Icebreakers",
    desc: "Great for new remote employees, intern cohorts, and onboarding teams.",
    icon: Users
  },
  {
    title: "Custom Experiences",
    desc: "We create custom rules, themes, and content for your goals.",
    icon: Wand2
  }
];

const benefits = [
  {
    title: "Stronger Connections",
    desc: "Break down corporate silos and build real, authentic relationships.",
    icon: Heart
  },
  {
    title: "High Energy",
    desc: "Michael and the Teamtastic hosts keep the energy high from start to finish.",
    icon: Zap
  },
  {
    title: "Laughs & Fun",
    desc: "Immersive virtual games your team will actually look forward to playing.",
    icon: Smile
  },
  {
    title: "Easy for Planners",
    desc: "We handle the hosting, logistics, and tech — you get all the credit!",
    icon: Sparkles
  },
  {
    title: "Memorable Moments",
    desc: "More than just a game; it's an experience that creates lasting team impact.",
    icon: Award
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
  }
];

const getLightColor = (title) => {
  switch(title) {
    case "Trivia & Quizzes": return "bg-purple-50 text-purple-600 border-purple-100";
    case "Game Shows": return "bg-pink-50 text-pink-600 border-pink-100";
    case "Bingo": return "bg-orange-50 text-orange-600 border-orange-100";
    case "Escape Rooms": return "bg-emerald-50 text-emerald-600 border-emerald-100";
    case "Music Games": return "bg-sky-50 text-sky-600 border-sky-100";
    case "Creative Challenges": return "bg-rose-50 text-rose-600 border-rose-100";
    case "Icebreakers": return "bg-cyan-50 text-cyan-600 border-cyan-100";
    default: return "bg-amber-50 text-amber-600 border-amber-100";
  }
};

const getBenefitColor = (title) => {
  switch(title) {
    case "Stronger Connections": return "bg-purple-50 text-purple-600 border-purple-100";
    case "High Energy": return "bg-blue-50 text-blue-600 border-blue-100";
    case "Laughs & Fun": return "bg-green-50 text-green-600 border-green-100";
    case "Easy for Planners": return "bg-orange-50 text-orange-600 border-orange-100";
    default: return "bg-pink-50 text-pink-600 border-pink-100";
  }
};

export default function TeamExperiences() {
  return (
    <div className="flex flex-col min-h-screen bg-white">
      <main className="flex-1 bg-white text-slate-900">
        
        {/* ══ CUSTOM MOCKUP HERO (LIGHT THEME) ══ */}
        <section className="relative overflow-hidden pt-24 pb-20 md:pt-32 md:pb-28 bg-slate-50">
          <div className="absolute inset-0 -z-10" style={{
            background: "radial-gradient(ellipse 90% 70% at 50% 0%, rgba(139,92,245,0.06) 0%, rgba(249,250,251,0.98) 70%, #ffffff 100%)"
          }} />

          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-12 gap-12 items-center">
              
              {/* Left Column: Copy & CTAs */}
              <div className="lg:col-span-7 space-y-8 text-left">
                <div className="inline-flex items-center gap-2 rounded-full border border-purple-200 bg-purple-50 px-4.5 py-2 text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] shadow-sm backdrop-blur-sm">
                  <Sparkles className="h-3.5 w-3.5 text-purple-600 animate-pulse" />
                  <span className="text-purple-600 font-bold">
                    Virtual Teambuilding Reimagined
                  </span>
                </div>

                <div className="space-y-4">
                  <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-900 leading-tight">
                    Endless Ways to <br />Bring Your Team Together.
                  </h1>
                  <h2 className="text-2xl sm:text-3xl font-extrabold flex flex-wrap items-center gap-x-2 gap-y-1.5 leading-snug">
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600">
                      More Than Trivia. More Than Games.
                    </span>
                    <span className="text-slate-900 block w-full">A World of Team Experiences.</span>
                  </h2>
                  <p className="max-w-xl text-base sm:text-lg text-slate-600 font-medium leading-relaxed pt-2">
                    Live-hosted virtual events that spark laughter, connection, competition and celebration—designed for remote and hybrid teams of any size.
                  </p>
                </div>

                {/* Branded Icons Row (Play, Connect, Celebrate) */}
                <div className="flex flex-wrap items-center gap-x-8 gap-y-4 pt-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600 border border-purple-100 shadow-sm">
                      <Gamepad2 className="h-4.5 w-4.5" />
                    </div>
                    <span className="text-sm font-bold text-purple-600 uppercase tracking-widest">Play.</span>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center text-orange-600 border border-orange-100 shadow-sm">
                      <Users className="h-4.5 w-4.5" />
                    </div>
                    <span className="text-sm font-bold text-orange-600 uppercase tracking-widest">Connect.</span>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <span className="font-script text-[#EC4899] text-3xl rotate-[-2deg] inline-block tracking-wider transform origin-center font-bold">
                      Celebrate.
                    </span>
                  </div>
                </div>

                {/* CTA Buttons */}
                <div className="flex flex-col sm:flex-row items-center gap-4 pt-4">
                  <Link href="/#quiz"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4.5 rounded-2xl text-base font-bold text-white bg-[#D81B60] hover:bg-pink-600 shadow-[0_4px_14px_rgba(216,27,96,0.3)] transition-all duration-300 hover:-translate-y-1">
                    Book Your Event
                    <ArrowRight className="h-4.5 w-4.5" />
                  </Link>
                  <Link href="/games"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4.5 rounded-2xl text-base font-bold text-purple-600 border border-purple-600 hover:border-purple-700 bg-transparent hover:bg-purple-50 transition-all duration-300 hover:-translate-y-1">
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
                  <span className="text-xs font-bold tracking-wider text-slate-500">
                    1,000+ 5-Star Reviews
                  </span>
                </div>
              </div>

              {/* Right Column: Emcee Cutout & Participant Webcam Grid */}
              <div className="lg:col-span-5 relative flex items-center justify-center">
                {/* ── Background Webcam Grid ── */}
                <div className="grid grid-cols-3 gap-2 w-full max-w-[420px] aspect-square p-2 bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl opacity-90">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((val) => {
                    const idx = ((val - 1) % 6) + 1; 
                    const src = `/p${idx}.png`;
                    return (
                      <div key={val} className="relative rounded-xl overflow-hidden aspect-video sm:aspect-square bg-slate-950 border border-slate-800">
                        <img src={src} className="w-full h-full object-cover select-none pointer-events-none opacity-45" alt="Participant" />
                      </div>
                    );
                  })}
                </div>

                {/* ── Foreground Emcee Cutout (pointing forward) ── */}
                <div className="absolute inset-0 flex items-end justify-center z-10 pointer-events-none">
                  <img
                    src="/emcee-energetic-transparent.png"
                    alt="Michael - Master Emcee"
                    className="max-h-[110%] w-auto object-contain select-none pointer-events-none translate-y-6 transform hover:scale-[1.02] transition-transform duration-500"
                  />
                </div>

                {/* ── Yellow Handwritten Circle/Speech bubble ── */}
                <div className="absolute -top-6 -right-4 md:-right-8 z-20 rotate-[6deg] bg-amber-400 text-zinc-950 px-4 py-2 rounded-2xl shadow-2xl font-script text-lg md:text-xl font-bold border-2 border-zinc-950 select-none pointer-events-none">
                  Hosted by Michael! <br />
                  <span className="float-right text-xs font-sans tracking-wide font-extrabold">— Your Host & Emcee</span>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ══ TRUSTED LOGOS BANNER (LIGHT BANNER WITH COLORED LOGOS) ══ */}
        <section className="py-10 bg-white border-y border-slate-100">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center space-y-6">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 block">
              TRUSTED BY AMAZING COMPANIES
            </span>
            <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
              {/* Google */}
              <span className="text-2xl font-bold font-sans cursor-default select-none">
                <span className="text-[#4285F4]">G</span>
                <span className="text-[#EA4335]">o</span>
                <span className="text-[#FBBC05]">o</span>
                <span className="text-[#4285F4]">g</span>
                <span className="text-[#34A853]">l</span>
                <span className="text-[#EA4335]">e</span>
              </span>
              
              {/* Microsoft */}
              <div className="flex items-center gap-1.5 text-2xl font-semibold text-slate-700 font-sans cursor-default select-none">
                <div className="grid grid-cols-2 gap-0.5 w-4.5 h-4.5 shrink-0">
                  <div className="bg-[#F25022] w-2 h-2"></div>
                  <div className="bg-[#7FBA00] w-2 h-2"></div>
                  <div className="bg-[#00A4EF] w-2 h-2"></div>
                  <div className="bg-[#FFB900] w-2 h-2"></div>
                </div>
                <span>Microsoft</span>
              </div>

              {/* Amazon */}
              <div className="flex flex-col items-center justify-center leading-none cursor-default select-none">
                <span className="text-2xl font-bold text-slate-900 lowercase font-sans">amazon</span>
                <span className="text-[10px] text-orange-500 font-bold tracking-widest -mt-1 font-sans">◡</span>
              </div>

              {/* Deloitte */}
              <span className="text-2xl font-extrabold text-slate-800 font-sans cursor-default select-none">
                Deloitte<span className="text-green-600 font-black">.</span>
              </span>

              {/* HubSpot */}
              <div className="flex items-center gap-1 text-2xl font-bold text-slate-900 font-sans cursor-default select-none">
                <span>HubSp</span>
                <span className="w-4.5 h-4.5 rounded-full border-4 border-[#FF5C35] flex items-center justify-center bg-transparent shrink-0 relative">
                  <span className="absolute w-1.5 h-1.5 rounded-full bg-[#FF5C35] top-0 left-0"></span>
                </span>
                <span>t</span>
              </div>

              {/* Salesforce */}
              <span className="text-2xl font-bold text-[#00A1E0] font-sans cursor-default select-none">
                salesforce
              </span>

              {/* Adobe */}
              <div className="flex items-center gap-1 text-2xl font-bold text-slate-950 font-sans cursor-default select-none">
                <div className="w-5 h-5 bg-[#FF0000] flex items-center justify-center text-[10px] text-white font-extrabold shrink-0" style={{ clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)" }}>
                  A
                </div>
                <span>Adobe</span>
              </div>
            </div>
          </div>
        </section>

        {/* ══ A WORLD OF TEAM EXPERIENCES ══ */}
        <section id="games" className="py-20 md:py-28 bg-[#F9FAFB] relative">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center space-y-4 mb-16">
              <h2 className="text-3xl font-extrabold tracking-tight sm:text-5xl text-slate-900 flex flex-wrap items-center justify-center gap-2">
                A World of{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-500">
                  Team Experiences
                </span>
              </h2>
              <p className="text-slate-500 max-w-lg mx-auto text-base">
                Choose the experience that fits your team, goals and occasion.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
              {categories.map((cat) => {
                const Icon = cat.icon;
                const colorClasses = getLightColor(cat.title);
                return (
                  <div
                    key={cat.title}
                    className="bg-white border border-slate-200/80 shadow-sm rounded-3xl p-6 flex flex-col justify-between hover:border-purple-300 hover:shadow-md transition-all duration-300 hover:-translate-y-1 group"
                  >
                    <div className="space-y-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${colorClasses}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 group-hover:text-purple-600 transition-colors">
                        {cat.title}
                      </h3>
                      <p className="text-xs text-slate-500 leading-relaxed min-h-[48px]">
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
                className="inline-flex items-center gap-2 text-sm font-bold text-purple-600 hover:text-purple-700 transition-colors group"
              >
                <span>And so much more! If you can imagine it, we can host it.</span>
                <span className="font-extrabold uppercase tracking-wider text-xs border-b border-purple-600 group-hover:border-purple-700 pb-0.5 ml-1">
                  See all experiences
                </span>
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </section>

        {/* ══ HOW IT WORKS TIMELINE (LIGHT) ══ */}
        <section className="py-20 md:py-28 bg-white border-t border-slate-100">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center space-y-4 mb-16">
              <h2 className="text-3xl font-extrabold tracking-tight sm:text-5xl text-slate-900 flex items-center justify-center gap-4">
                <span className="hidden md:inline text-zinc-300">──</span>
                How It Works
                <span className="hidden md:inline text-zinc-300">──</span>
              </h2>
              <p className="text-slate-500 max-w-lg mx-auto text-base">
                Frictionless, live-hosted corporate game shows structured in three simple steps.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 max-w-6xl mx-auto relative">
              {/* Timeline Connector Line */}
              <div className="hidden md:block absolute top-14 left-[12.5%] right-[12.5%] h-[2px] bg-slate-100 -z-10" />

              {/* Step 1 */}
              <div className="text-center space-y-4 relative">
                <div className="w-12 h-12 rounded-full bg-purple-600 border-4 border-white text-white flex items-center justify-center font-extrabold mx-auto text-lg shadow-md">
                  1
                </div>
                <h3 className="text-lg font-bold text-slate-900">Pick Your Experience</h3>
                <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                  Choose a theme, game format, and timing structure that fits your team&apos;s goals.
                </p>
              </div>

              {/* Step 2 */}
              <div className="text-center space-y-4 relative">
                <div className="w-12 h-12 rounded-full bg-blue-500 border-4 border-white text-white flex items-center justify-center font-extrabold mx-auto text-lg shadow-md">
                  2
                </div>
                <h3 className="text-lg font-bold text-slate-900">We Customize It</h3>
                <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                  We inject customized company trivia, inside jokes, and branding directly into the game.
                </p>
              </div>

              {/* Step 3 */}
              <div className="text-center space-y-4 relative">
                <div className="w-12 h-12 rounded-full bg-green-500 border-4 border-white text-white flex items-center justify-center font-extrabold mx-auto text-lg shadow-md">
                  3
                </div>
                <h3 className="text-lg font-bold text-slate-900">Join & Play</h3>
                <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                  Your team joins on Zoom, Teams, or Meet and plays directly in their browser.
                </p>
              </div>

              {/* Step 4 */}
              <div className="text-center space-y-4 relative">
                <div className="w-12 h-12 rounded-full bg-orange-500 border-4 border-white text-white flex items-center justify-center font-extrabold mx-auto text-lg shadow-md">
                  4
                </div>
                <h3 className="text-lg font-bold text-slate-900">Celebrate Together</h3>
                <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                  Crowning champions, tracking live leaderboards, and wrapping up with virtual confetti!
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ══ MAGENTA PROMO BANNER ══ */}
        <section className="w-full py-8 bg-[#D81B60] text-center shadow-md">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-center gap-6">
            <h3 className="text-lg md:text-xl font-bold text-white tracking-wide flex items-center gap-2">
              <span className="text-xl">📅</span>
              Ready to Bring Your Team Together? Let&apos;s create an unforgettable experience for your team.
            </h3>
            <Link
              href="/#quiz"
              className="px-6 py-2.5 rounded-xl bg-white text-pink-600 font-bold text-xs hover:bg-zinc-100 transition-all shadow-md shrink-0 flex items-center gap-1.5"
            >
              Book Your Event
              <ArrowRight className="h-3.5 w-3.5 text-pink-600" />
            </Link>
          </div>
        </section>

        {/* ══ WHY TEAMS LOVE TEAMTASTIC (LIGHT) ══ */}
        <section className="py-20 md:py-28 bg-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center space-y-4 mb-16">
              <h2 className="text-3xl font-extrabold tracking-tight sm:text-5xl text-slate-900">
                Why Teams Love <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-500">Teamtastic</span>
              </h2>
              <p className="text-slate-500 max-w-lg mx-auto text-base">
                We design our experiences to drive authentic connection, leaving players feeling closer and re-energized.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-6 max-w-6xl mx-auto">
              {benefits.map((b) => {
                const Icon = b.icon;
                const benefitColors = getBenefitColor(b.title);
                return (
                  <div
                    key={b.title}
                    className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 hover:border-purple-200 transition-all duration-300 text-left flex flex-col justify-between"
                  >
                    <div className="space-y-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center border ${benefitColors}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <h3 className="text-base font-bold text-slate-900">{b.title}</h3>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        {b.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ══ PERFECT FOR ANY OCCASION (LIGHT) ══ */}
        <section className="py-20 bg-slate-50 border-y border-slate-100">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center space-y-12">
            <div className="space-y-4">
              <h2 className="text-3xl font-extrabold tracking-tight sm:text-5xl text-slate-900">
                Perfect for Any Occasion
              </h2>
              <p className="text-slate-500 max-w-lg mx-auto text-base">
                We align gameshow mechanics, pacing, and music selections to match your specific objective.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-9 gap-4 max-w-6xl mx-auto justify-center">
              {occasions.map((o) => {
                const Icon = o.icon;
                return (
                  <div
                    key={o.label}
                    className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-sm hover:border-purple-200 hover:bg-slate-50/50 transition-all flex flex-col items-center justify-center text-center gap-3"
                  >
                    <div className="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 border border-purple-100">
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="text-[10px] font-bold text-slate-800 uppercase tracking-wide leading-tight">
                      {o.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ══ CUSTOMIZED / LEADERBOARD & TESTIMONIAL SPLIT SECTION (LIGHT) ══ */}
        <section className="py-20 md:py-28 bg-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-12 gap-12 items-start max-w-6xl mx-auto">
              
              {/* Left Column - Customized Checklist & Laptop/Phone Leaderboard Mockup */}
              <div className="lg:col-span-6 space-y-8 text-left">
                <div className="space-y-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-purple-600">
                    CUSTOMIZED FOR YOUR TEAM
                  </span>
                  <h2 className="text-3xl md:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
                    Tailored To Your Brand <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-500">
                      And Culture.
                    </span>
                  </h2>
                  <p className="text-slate-600 text-sm md:text-base leading-relaxed">
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
                      <div className="mt-1 h-5 w-5 rounded-full bg-pink-100 border border-pink-200 flex items-center justify-center text-[#D81B60] shrink-0">
                        <Check className="h-3 w-3" />
                      </div>
                      <span className="text-sm text-slate-700 font-medium leading-normal">{item}</span>
                    </li>
                  ))}
                </ul>

                <div className="pt-2">
                  <Link
                    href="/#quiz"
                    className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-xs font-bold text-white bg-[#D81B60] hover:bg-pink-600 transition-all shadow-md"
                  >
                    Plan My Custom Event
                    <ArrowRight className="h-4 w-4 text-white" />
                  </Link>
                </div>

                {/* ── Tailwind Device Mockups (Laptop + Phone) showing Leaderboard ── */}
                <div className="relative pt-12 pb-6 flex items-center justify-center max-w-[450px]">
                  {/* Laptop Mockup */}
                  <div className="w-[300px] sm:w-[320px] aspect-[16/10] bg-slate-900 rounded-t-2xl border-4 border-slate-700 relative shadow-2xl overflow-hidden z-10">
                    {/* Laptop Screen Content */}
                    <div className="w-full h-full bg-[#0B0B1E] p-3 text-white flex flex-col justify-between font-sans">
                      {/* Laptop Screen Header */}
                      <div className="flex items-center justify-between border-b border-white/5 pb-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          <span className="text-[7px] font-bold text-white uppercase tracking-widest font-mono">Live Tournament Board</span>
                        </div>
                        <span className="text-[7px] font-bold text-pink-500 uppercase tracking-wider bg-pink-500/10 px-1.5 py-0.5 rounded border border-pink-500/20">ACME ALL STARS!</span>
                      </div>

                      {/* Screen Leaderboard List */}
                      <div className="space-y-1.5 flex-grow pt-3">
                        {/* Leader 1 */}
                        <div className="flex items-center justify-between p-1.5 bg-purple-600/20 border border-purple-500/30 rounded-lg">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px]">🥇</span>
                            <span className="text-[9px] font-bold text-white">Dream Team</span>
                          </div>
                          <span className="text-[8px] font-mono font-bold text-purple-400">3,850 pts</span>
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
                  {/* Laptop keyboard base */}
                  <div className="w-[340px] sm:w-[360px] h-[8px] bg-slate-600 rounded-b-xl -mt-[1px] relative shadow-lg z-10" />

                  {/* Phone Mockup (overlapping) */}
                  <div className="w-[75px] h-[145px] bg-[#0B0B1E] border-4 border-slate-700 rounded-xl absolute bottom-2 left-2 sm:-left-2 z-20 shadow-2xl overflow-hidden flex flex-col justify-between p-1.5 font-sans text-white">
                    {/* Screen status bar */}
                    <div className="flex justify-between items-center text-[5px] text-zinc-400">
                      <span>9:41</span>
                      <span className="w-1 h-1 rounded-full bg-zinc-700"></span>
                      <span>📶 🔋</span>
                    </div>

                    {/* Phone Leaderboard mini */}
                    <div className="space-y-1 my-auto">
                      <div className="text-[6px] font-extrabold text-pink-500 border-b border-white/5 pb-1 text-center font-mono">ACME LOBBY</div>
                      
                      <div className="p-1 bg-purple-600/30 rounded border border-purple-500/20 flex justify-between items-center text-[5px] font-bold">
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
              </div>
              
              {/* Right Column - What Teams Are Saying Testimonial block */}
              <div className="lg:col-span-6 space-y-6 text-left w-full lg:sticky lg:top-28">
                <span className="text-xs font-bold uppercase tracking-wider text-purple-600">
                  WHAT TEAMS ARE SAYING
                </span>
                
                <div className="bg-slate-50 border border-slate-200/80 rounded-3xl p-8 relative flex flex-col justify-between shadow-sm min-h-[300px]">
                  {/* Large quote icon in background */}
                  <span className="text-purple-600/10 text-8xl font-serif leading-none absolute top-4 left-4 select-none">“</span>
                  
                  <div className="space-y-6 z-10 flex-grow">
                    <p className="text-slate-700 font-medium italic text-base leading-relaxed">
                      &ldquo;Michael was AMAZING! He had our team laughing, competing, and connecting the entire time. It was the highlight of our quarter!&rdquo;
                    </p>
                    
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star key={star} className="h-4.5 w-4.5 fill-amber-400 text-amber-400" />
                      ))}
                    </div>
                  </div>

                  {/* Testimonial Author Flex Row */}
                  <div className="mt-8 flex items-center justify-between border-t border-slate-200/60 pt-6 z-10 shrink-0">
                    <div className="space-y-0.5">
                      <span className="text-sm font-bold text-slate-800">— HR Director</span>
                      <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Tech Company</p>
                    </div>
                    {/* Crop face avatar */}
                    <img 
                      src="/p6.png" 
                      alt="HR Director Avatar" 
                      className="w-12 h-12 rounded-full object-cover border-2 border-purple-200 shadow-sm"
                    />
                  </div>
                </div>

                {/* Dot Indicators */}
                <div className="flex items-center justify-center gap-2 pt-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-600"></span>
                  <span className="w-2 h-2 rounded-full bg-zinc-300 hover:bg-zinc-400 cursor-pointer"></span>
                  <span className="w-2 h-2 rounded-full bg-zinc-300 hover:bg-zinc-400 cursor-pointer"></span>
                  <span className="w-2 h-2 rounded-full bg-zinc-300 hover:bg-zinc-400 cursor-pointer"></span>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ══ FOOTER CTA BANNER (DARK THEME WITH CONFETTI) ══ */}
        <section className="py-20 relative overflow-hidden bg-zinc-950 border-t border-white/5">
          <div className="absolute inset-0 -z-10" style={{
            background: "radial-gradient(circle at 80% 50%, rgba(139,92,246,0.15) 0%, transparent 60%)"
          }} />
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="glassmorphism rounded-3xl border border-white/10 p-8 md:p-12 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-12 bg-gradient-to-br from-brand-card/90 via-zinc-950/95 to-brand-purple/15">
              {/* Left Column Content */}
              <div className="max-w-xl text-left space-y-6 z-10">
                <h2 className="text-3xl md:text-5xl font-extrabold text-white leading-tight font-sans">
                  Let&apos;s Create an Experience <br />Your Team Will Remember.
                </h2>
                <h3 className="text-2xl md:text-3xl font-extrabold text-white flex flex-wrap items-center gap-x-2 gap-y-1.5 font-sans">
                  <span>Play. Connect.</span>
                  <span className="font-script text-brand-pink neon-glow-pink text-3xl md:text-4xl inline-block font-sans" style={{ transform: "rotate(-2deg)" }}>Celebrate.</span>
                </h3>
                <p className="text-zinc-300 text-sm md:text-base leading-relaxed">
                  Book your event today and leave the rest to us! We manage the games, screen sharing, music, and energy curation so your host can enjoy the show.
                </p>
                <div className="flex flex-col sm:flex-row items-center gap-4 pt-2">
                  <Link href="/#quiz" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-sm font-bold text-white bg-[#D81B60] hover:bg-pink-600 shadow-lg shadow-purple-500/20 hover:scale-[1.02] transition-all">
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

        {/* ══ FREQUENTLY ASKED QUESTIONS (LIGHT 2-COLUMN) ══ */}
        <section className="py-20 md:py-28 bg-[#F9FAFB] border-t border-slate-100">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-16">
            <div className="text-center space-y-4 max-w-xl mx-auto">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-600">RESOLVING FRICTION</span>
              <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
                Frequently Asked Questions
              </h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-5xl mx-auto items-start">
              {/* Accordions double columns */}
              <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                {faqs.map((faq, idx) => (
                  <details 
                    key={idx} 
                    className="group bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all duration-300 [&_summary::-webkit-details-marker]:hidden"
                  >
                    <summary className="flex items-center justify-between p-6 cursor-pointer font-bold text-slate-900 hover:text-pink-600 transition-colors list-none">
                      <span className="text-sm">{faq.q}</span>
                      <ChevronDown className="h-4.5 w-4.5 text-slate-500 transition-transform group-open:rotate-180 group-open:text-[#D81B60] shrink-0" />
                    </summary>
                    <div className="p-6 pt-0 border-t border-slate-100 text-xs text-slate-600 leading-relaxed bg-slate-50/30">
                      {faq.a}
                    </div>
                  </details>
                ))}
              </div>

              {/* Chat Sidebar Box */}
              <div className="lg:col-span-4 bg-white border border-slate-200 shadow-sm rounded-3xl p-6 space-y-4 text-center">
                <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600 border border-purple-100 mx-auto">
                  <Users className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  Let&apos;s talk about your event!
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  We&apos;ll help you plan something your team will love.
                </p>
                <a 
                  href="mailto:hello@teamtastic.events" 
                  className="w-full flex h-11 items-center justify-center gap-2 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 shadow-md transition-all uppercase tracking-wider"
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
