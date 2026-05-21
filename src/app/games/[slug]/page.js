import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Gamepad2, Users, Clock, Award, CheckCircle, ArrowRight, ShieldCheck, Heart } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import gamesPool from "@/lib/gamesData.json";

// Map array to object with slug keys
const gamesData = {};
gamesPool.forEach(g => {
  gamesData[g.slug] = g;
});

// Generates static pages at build time (NextJS dynamic paths)
export function generateStaticParams() {
  return gamesPool.map(g => ({ slug: g.slug }));
}

export default async function GamePage({ params }) {
  const { slug } = await params;
  const game = gamesData[slug];

  if (!game) {
    notFound();
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />

      <main className="flex-1 pt-24 pb-20">
        {/* Game Hero */}
        <section className="relative py-12 md:py-20 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-900/10 via-zinc-950 to-zinc-950 -z-10" />

          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              {/* Left Column: Info */}
              <div className="lg:col-span-7 space-y-6 text-left">
                <span className="inline-flex px-3 py-1 bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-semibold rounded-full uppercase tracking-wider">
                  {game.badge}
                </span>
                <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl text-white">
                  {game.title}
                </h1>
                <p className="text-xl font-bold text-zinc-300">
                  {game.tagline}
                </p>
                <p className="text-zinc-400 text-base leading-relaxed">
                  {game.description}
                </p>

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4">
                  <div className="p-4 bg-zinc-900/50 border border-white/5 rounded-2xl">
                    <Users className="h-5 w-5 text-purple-400 mb-2" />
                    <span className="text-[10px] uppercase font-bold text-zinc-500 block">Squad Size</span>
                    <span className="text-xs font-bold text-zinc-200">{game.players}</span>
                  </div>
                  <div className="p-4 bg-zinc-900/50 border border-white/5 rounded-2xl">
                    <Clock className="h-5 w-5 text-orange-400 mb-2" />
                    <span className="text-[10px] uppercase font-bold text-zinc-500 block">Duration</span>
                    <span className="text-xs font-bold text-zinc-200">{game.time}</span>
                  </div>
                  <div className="p-4 bg-zinc-900/50 border border-white/5 rounded-2xl">
                    <Gamepad2 className="h-5 w-5 text-pink-400 mb-2" />
                    <span className="text-[10px] uppercase font-bold text-zinc-500 block">Lobby Vibe</span>
                    <span className="text-xs font-bold text-zinc-200">{game.vibe}</span>
                  </div>
                  <div className="p-4 bg-zinc-900/50 border border-white/5 rounded-2xl">
                    <Award className="h-5 w-5 text-cyan-400 mb-2" />
                    <span className="text-[10px] uppercase font-bold text-zinc-500 block">Core Skill</span>
                    <span className="text-xs font-bold text-zinc-200">{game.skill}</span>
                  </div>
                </div>

                {/* CTAs */}
                <div className="flex flex-col sm:flex-row gap-4 pt-6">
                  <a
                    href={`https://teamtastic.games?launch=${slug}`}
                    className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30 transition-all hover:-translate-y-0.5"
                  >
                    Launch Free Game Lobby
                    <ArrowRight className="h-4 w-4" />
                  </a>
                  <Link
                    href="/#quiz"
                    className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl text-sm font-bold text-zinc-300 border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 transition-all hover:-translate-y-0.5"
                  >
                    Find Custom Packages
                  </Link>
                </div>
              </div>

              {/* Right Column: Dynamic Visual Mock */}
              <div className="lg:col-span-5 relative">
                <div 
                  className="absolute inset-0 rounded-3xl blur-3xl opacity-30" 
                  style={{ background: `radial-gradient(circle, ${game.heroColor} 0%, transparent 70%)` }}
                />
                <div className="relative glassmorphism rounded-3xl border border-white/10 p-6 shadow-2xl flex flex-col items-center justify-center min-h-[320px] bg-zinc-950/50">
                  <Gamepad2 
                    className="h-16 w-16 mb-4 animate-bounce" 
                    style={{ color: game.heroColor }}
                  />
                  <span className="text-sm font-bold text-white tracking-wide uppercase">Simulated Lobby Stage</span>
                  <p className="text-xs text-zinc-500 text-center max-w-xs mt-2">
                    Lobbies launch instantly in any modern web browser. Connect a shared screen and begin gameplay in under 30 seconds.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How to Play explanation */}
        <section className="py-16 md:py-24 border-t border-white/5 bg-zinc-950/30">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center space-y-4 mb-16">
              <h2 className="text-2xl font-extrabold tracking-tight sm:text-4xl text-white">
                How It Works
              </h2>
              <p className="text-zinc-400 max-w-md mx-auto text-sm">
                Three simple, low-friction steps to launch a fully customized game show on your terms.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {game.howToPlay.map((item) => (
                <div
                  key={item.step}
                  className="relative glassmorphism rounded-3xl p-8 border border-white/5 bg-zinc-900/30 flex flex-col gap-4 text-left"
                >
                  <span className="h-10 w-10 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center font-extrabold text-base">
                    {item.step}
                  </span>
                  <h3 className="text-lg font-bold text-white pt-2">{item.title}</h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
