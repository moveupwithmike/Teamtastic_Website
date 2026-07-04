"use client";

import { useState } from "react";
import gamesData from "@/lib/gamesData.json";
import {
  Gamepad2, Sparkles, Users, Clock, Award,
  Search, Shuffle, ArrowRight, Zap, Target,
  Music, Brain, Puzzle, Flame
} from "lucide-react";
import Link from "next/link";

// Mapping category slugs to display titles & HSL colors
const categories = [
  { id: "all", label: "All Games", icon: Gamepad2, color: "text-purple-400 border-purple-500/30 bg-purple-500/10" },
  { id: "high-energy", label: "High Energy", icon: Flame, color: "text-orange-400 border-orange-500/30 bg-orange-500/10" },
  { id: "competitive", label: "Competitive", icon: Zap, color: "text-red-400 border-red-500/30 bg-red-500/10" },
  { id: "creative", label: "Creative", icon: Sparkles, color: "text-pink-400 border-pink-500/30 bg-pink-500/10" },
  { id: "collaborative", label: "Collaborative", icon: Puzzle, color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" },
  { id: "chill", label: "Chill", icon: Music, color: "text-cyan-400 border-cyan-500/30 bg-cyan-500/10" }
];

const categoryStyles = {
  "high-energy": {
    bg: "from-orange-500/20 to-amber-600/5 border-orange-500/20 hover:border-orange-500/40 hover:shadow-[0_0_30px_rgba(249,115,22,0.15)]",
    text: "text-orange-400",
    icon: Flame
  },
  "competitive": {
    bg: "from-red-500/20 to-rose-600/5 border-red-500/20 hover:border-red-500/40 hover:shadow-[0_0_30px_rgba(239,68,68,0.15)]",
    text: "text-red-400",
    icon: Zap
  },
  "creative": {
    bg: "from-pink-500/20 to-fuchsia-600/5 border-pink-500/20 hover:border-pink-500/40 hover:shadow-[0_0_30px_rgba(236,72,153,0.15)]",
    text: "text-pink-400",
    icon: Sparkles
  },
  "collaborative": {
    bg: "from-emerald-500/20 to-teal-600/5 border-emerald-500/20 hover:border-emerald-500/40 hover:shadow-[0_0_30px_rgba(16,185,129,0.15)]",
    text: "text-emerald-400",
    icon: Puzzle
  },
  "chill": {
    bg: "from-cyan-500/20 to-blue-600/5 border-cyan-500/20 hover:border-cyan-500/40 hover:shadow-[0_0_30px_rgba(6,182,212,0.15)]",
    text: "text-cyan-400",
    icon: Music
  }
};

export default function GamesCatalog() {
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [randomGame, setRandomGame] = useState(null);

  // Filter games based on category and search query
  const filteredGames = gamesData.filter(g => {
    const matchesCategory = activeCategory === "all" || g.category === activeCategory;
    const matchesSearch = g.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          g.tagline.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (g.vibe && g.vibe.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const pickRandomGame = () => {
    if (gamesData.length === 0) return;
    const randomIndex = Math.floor(Math.random() * gamesData.length);
    setRandomGame(gamesData[randomIndex]);
  };

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-white">
      <main className="flex-1 pt-28 pb-20">
        {/* Dynamic header / breadcrumbs */}
        <section className="relative overflow-hidden py-16 border-b border-white/5 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-900/10 via-zinc-950 to-zinc-950">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative text-center space-y-6">
            <span className="inline-flex px-3 py-1 bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-semibold rounded-full uppercase tracking-wider">
              Virtual Arcade Catalog
            </span>
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl text-white">
              Explore Our{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-amber-400">
                50+ Team Games
              </span>
            </h1>
            <p className="text-zinc-400 max-w-xl mx-auto text-base leading-relaxed">
              Find the perfect virtual icebreaker, logic challenge, or high-energy buzz-in event. Zero downloads required. Playable instantly in any web browser.
            </p>

            {/* Quick stats grid */}
            <div className="flex flex-wrap justify-center gap-6 pt-4 text-xs font-semibold text-zinc-500 uppercase tracking-widest">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/5">
                <Gamepad2 className="h-4 w-4 text-purple-400" />
                <span>51 Custom Modules</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/5">
                <Users className="h-4 w-4 text-emerald-400" />
                <span>Unlimited Players</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/5">
                <Clock className="h-4 w-4 text-orange-400" />
                <span>15 - 60 Min Sessions</span>
              </div>
            </div>
          </div>
        </section>

        {/* Catalog Control & Filtering Panel */}
        <section className="py-12 border-b border-white/5 bg-zinc-950/40">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col lg:flex-row gap-6 justify-between items-center">

              {/* Category tabs */}
              <div className="flex flex-wrap gap-2.5 justify-center lg:justify-start">
                {categories.map((c) => {
                  const Icon = c.icon;
                  const isActive = activeCategory === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setActiveCategory(c.id)}
                      className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold uppercase tracking-wider border transition-all ${
                        isActive
                          ? "bg-white/10 text-white border-white/20 shadow-lg"
                          : "bg-white/5 text-zinc-400 border-white/5 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{c.label}</span>
                      <span className="text-[10px] opacity-60">
                        ({c.id === "all" ? gamesData.length : gamesData.filter(g => g.category === c.id).length})
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Search & Shuffle container */}
              <div className="flex w-full lg:w-auto items-center gap-3">
                <div className="relative flex-1 lg:w-72">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by title, vibe, category..."
                    className="w-full pl-11 pr-4 py-3 rounded-2xl text-sm font-semibold bg-white/5 border border-white/5 focus:border-purple-500/40 focus:ring-1 focus:ring-purple-500/40 outline-none text-white transition-all placeholder:text-zinc-500"
                  />
                </div>

                <button
                  onClick={pickRandomGame}
                  title="Pick a random game!"
                  className="p-3.5 rounded-2xl bg-gradient-to-r from-purple-600/20 to-pink-600/20 border border-purple-500/20 text-purple-300 hover:text-white hover:border-purple-500/40 hover:from-purple-600/30 hover:to-pink-600/30 transition-all flex-shrink-0"
                >
                  <Shuffle className="h-4.5 w-4.5" />
                </button>
              </div>

            </div>
          </div>
        </section>

        {/* Random Game Modal / Drawer Spotlight */}
        {randomGame && (
          <section className="py-8 bg-purple-950/10 border-b border-purple-500/10">
            <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
              <div className="glassmorphism rounded-3xl p-8 border border-purple-500/20 bg-gradient-to-r from-purple-900/10 to-pink-900/10 relative flex flex-col md:flex-row gap-8 items-center justify-between">
                <div className="space-y-4 text-center md:text-left flex-1">
                  <div className="flex items-center justify-center md:justify-start gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[10px] font-bold uppercase tracking-widest">
                      🎲 Spotlight Game Suggestion
                    </span>
                  </div>
                  <h3 className="text-2xl font-bold text-white">{randomGame.title}</h3>
                  <p className="text-zinc-400 text-sm max-w-xl">{randomGame.tagline}</p>

                  <div className="flex flex-wrap justify-center md:justify-start gap-4 text-xs text-zinc-300">
                    <span>👥 {randomGame.players} Players</span>
                    <span>⏱️ {randomGame.time}</span>
                    <span>🎯 {randomGame.skill}</span>
                  </div>
                </div>

                <div className="flex gap-4 flex-shrink-0">
                  <button
                    onClick={() => setRandomGame(null)}
                    className="px-5 py-3 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 text-xs font-bold transition-all"
                  >
                    Close
                  </button>
                  <Link
                    href={`/games/${randomGame.slug}`}
                    className="inline-flex items-center gap-1.5 px-6 py-3 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-lg shadow-purple-500/20 hover:scale-[1.02] transition-all"
                  >
                    Explore Game
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Game list catalog grid */}
        <section className="py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            {filteredGames.length === 0 ? (
              <div className="text-center py-20 space-y-4">
                <Gamepad2 className="h-16 w-16 text-zinc-600 mx-auto animate-pulse" />
                <h3 className="text-xl font-bold text-zinc-400">No games found</h3>
                <p className="text-zinc-500 text-sm max-w-xs mx-auto">
                  Try adjusting your search query or selecting a different category tab.
                </p>
                <button
                  onClick={() => { setActiveCategory("all"); setSearchQuery(""); }}
                  className="px-6 py-2.5 rounded-xl border border-purple-500/20 bg-purple-500/10 text-purple-300 hover:text-white transition-all text-xs font-bold"
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {filteredGames.map((g) => {
                  const style = categoryStyles[g.category] || categoryStyles["chill"];
                  const Icon = style.icon;

                  return (
                    <div
                      key={g.slug}
                      className={`glassmorphism rounded-3xl p-7 flex flex-col justify-between border transition-all duration-300 hover:-translate-y-1 group bg-gradient-to-br ${style.bg}`}
                    >
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="inline-flex px-3 py-1 bg-black/40 border border-white/5 text-[9px] font-extrabold uppercase tracking-wider rounded-full text-zinc-300">
                            {g.badge || "Arcade"}
                          </span>
                          <Icon className={`h-5 w-5 ${style.text} group-hover:scale-110 transition-transform`} />
                        </div>

                        <h3 className="text-xl font-bold text-white group-hover:text-purple-300 transition-colors">
                          {g.title}
                        </h3>

                        <p className="text-xs text-zinc-400 leading-relaxed min-h-[50px] line-clamp-3">
                          {g.tagline}
                        </p>
                      </div>

                      <div className="mt-8 pt-5 border-t border-white/5 flex items-center justify-between">
                        <div className="flex gap-4">
                          <div className="text-left">
                            <span className="text-[9px] uppercase font-bold tracking-widest text-zinc-500 block">Players</span>
                            <span className="text-[10px] font-semibold text-zinc-300">{g.players}</span>
                          </div>
                          <div className="text-left">
                            <span className="text-[9px] uppercase font-bold tracking-widest text-zinc-500 block">Duration</span>
                            <span className="text-[10px] font-semibold text-zinc-300">{g.time}</span>
                          </div>
                        </div>

                        <Link
                          href={`/games/${g.slug}`}
                          className={`inline-flex items-center gap-0.5 text-xs font-bold ${style.text} hover:text-white transition-colors group/link`}
                        >
                          Learn More
                          <ArrowRight className="h-3 w-3 group-hover/link:translate-x-0.5 transition-transform" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

      </main>
    </div>
  );
}
