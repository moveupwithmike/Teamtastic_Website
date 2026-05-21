"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Mic, MicOff, Video, VideoOff, MonitorUp, Smile, PhoneOff, Settings } from "lucide-react";

const chatMessages = [
  { id: 1, user: "Sarah (HR)", text: "So fun! 🎉" },
  { id: 2, user: "David (Eng)", text: "Love this emcee! 😂" },
  { id: 3, user: "Elena (Design)", text: "More memes! 😻" },
  { id: 4, user: "Marcus (Ops)", text: "Supreme! ⚡" },
  { id: 5, user: "James (Product)", text: "Best event ever! 🙌" },
  { id: 6, user: "Maria (Sales)", text: "I'm crying 😂🔥" },
];

const emojisPool = ["🔥", "👏", "😍", "🎉", "❤️", "👍", "🥳", "⚡"];

// Individual images — no slicing, no squishing
const leftTiles = [
  { src: "/p1.png", label: "Sarah (HR)", muted: false },
  { src: "/p4.png", label: "Elena (Design)", muted: true },
  { src: "/p_white_male.png", label: "David (Eng)", muted: false }, // Bottom left is white male!
];

// Right column uses the clean individual headshots
const rightTiles = [
  { src: "/p5.png", label: "James (Product)", muted: false },
  { src: "/p2.png", label: "Marcus (Ops)", muted: true },
  { src: "/p_latina_female.png", label: "Maria (Sales)", muted: false }, // Bottom right is Latina female!
];

export default function Hero() {
  const [activeChats, setActiveChats] = useState([]);
  const [floatingEmojis, setFloatingEmojis] = useState([]);
  const [chatIndex, setChatIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveChats((prev) => {
        const next = chatMessages[chatIndex % chatMessages.length];
        const updated = [...prev, next];
        return updated.length > 3 ? updated.slice(1) : updated;
      });
      setChatIndex((i) => i + 1);
    }, 2200);
    return () => clearInterval(interval);
  }, [chatIndex]);

  useEffect(() => {
    const interval = setInterval(() => {
      const id = Date.now() + Math.random();
      const emoji = emojisPool[Math.floor(Math.random() * emojisPool.length)];
      const xOffset = (Math.random() - 0.5) * 100;
      const size = 0.9 + Math.random() * 1.0;
      setFloatingEmojis((prev) => [...prev, { id, emoji, xOffset, size }]);
      setTimeout(() => setFloatingEmojis((prev) => prev.filter((e) => e.id !== id)), 3500);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative overflow-hidden pt-24 pb-20 md:pt-30 md:pb-28">
      <div className="absolute inset-0 -z-10" style={{
        background: "radial-gradient(ellipse 90% 70% at 50% 0%, rgba(88,28,235,0.4) 0%, rgba(10,10,46,0.98) 60%, #030712 100%)"
      }} />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -z-10 h-[200px] w-[600px] rounded-full blur-[80px]"
        style={{ background: "rgba(236,72,153,0.06)" }} />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center text-center space-y-8">

          <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-4 py-1.5 text-xs font-semibold text-purple-300 backdrop-blur-md">
            <Sparkles className="h-3 w-3 text-amber-400 animate-pulse" />
            Virtual Teambuilding Reimagined
          </div>

          {/* ══ MOCK APP WINDOW ══ */}
          <div className="w-full max-w-4xl relative">

            {/* Outside floating emojis — LEFT */}
            <motion.div className="absolute -left-10 top-20 text-4xl z-20 hidden md:block select-none"
              animate={{ y: [0, -10, 0] }} transition={{ duration: 3.5, repeat: Infinity }}>🔥</motion.div>
            <motion.div className="absolute -left-8 top-4 text-2xl z-20 hidden md:block select-none"
              animate={{ y: [0, -7, 0] }} transition={{ duration: 2.8, repeat: Infinity, delay: 0.5 }}>🎉</motion.div>
            <motion.div className="absolute -left-16 bottom-24 z-20 hidden md:block"
              animate={{ y: [0, -5, 0] }} transition={{ duration: 2.5, repeat: Infinity }}>
              <div className="bg-blue-500 rounded-2xl px-3 py-2 text-white text-xs font-bold shadow-xl">···</div>
            </motion.div>

            {/* Outside floating emojis — RIGHT */}
            <motion.div className="absolute -right-10 top-14 text-3xl z-20 hidden md:block select-none"
              animate={{ y: [0, -8, 0] }} transition={{ duration: 3, repeat: Infinity, delay: 0.3 }}>👏</motion.div>
            <motion.div className="absolute -right-8 bottom-28 text-4xl z-20 hidden md:block select-none"
              animate={{ y: [0, -12, 0] }} transition={{ duration: 4, repeat: Infinity, delay: 1 }}>😍</motion.div>
            <motion.div className="absolute -right-16 top-1/2 -translate-y-1/2 z-20 hidden md:block"
              animate={{ y: [0, -5, 0] }} transition={{ duration: 3, repeat: Infinity, delay: 0.7 }}>
              <div className="bg-purple-600 rounded-2xl px-3 py-2 text-white text-xs font-bold shadow-xl">···</div>
            </motion.div>

            {/* Glow behind window */}
            <div className="absolute -inset-4 -z-10 rounded-3xl blur-3xl"
              style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.18), rgba(236,72,153,0.1))" }} />

            {/* ── Window chrome ── */}
            <div className="rounded-2xl overflow-hidden flex flex-col" style={{
              border: "2px solid transparent",
              background: "linear-gradient(#0a0a1e, #0a0a1e) padding-box, linear-gradient(135deg, #a855f7, #ec4899, #8b5cf6) border-box",
              boxShadow: "0 0 60px rgba(139,92,246,0.25), 0 0 120px rgba(236,72,153,0.1), 0 30px 80px rgba(0,0,0,0.7)"
            }}>

              {/* Title bar */}
              <div className="flex items-center justify-between px-5 py-3 bg-zinc-950 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-rose-500" />
                    <div className="w-3 h-3 rounded-full bg-amber-400" />
                    <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  </div>
                  {/* Mock App Logo & Wordmark in Title Bar */}
                  <div className="flex items-center gap-2 border-l border-white/10 pl-3">
                    <img src="/logo-highfive-transparent.png" className="h-12 w-auto" alt="Teamtastic" />
                  </div>
                </div>
                <span className="text-[10px] font-bold text-white uppercase tracking-[0.2em] bg-zinc-900/80 px-4 py-1.5 rounded-full border border-white/15 flex items-center gap-1.5 shadow-[0_0_12px_rgba(0,0,0,0.4)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse shadow-[0_0_8px_#f43f5e]" />
                  Virtual Event — Live Now
                </span>
                <div className="w-20" />
              </div>

              {/* ── Stage grid: 1fr | 2fr | 1fr ── */}
              <div className="grid bg-zinc-950" style={{ gridTemplateColumns: "1fr 2fr 1fr", minHeight: 480 }}>

                {/* LEFT — Individual images, object-cover, NO squishing */}
                <div className="flex flex-col border-r border-white/5">
                  {leftTiles.map(({ src, label, muted }) => (
                    <div key={label} className="flex-1 relative overflow-hidden border-b border-white/5 last:border-b-0">
                      <img src={src} alt={label} className="absolute inset-0 w-full h-full object-cover object-center" />
                      <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-black/60 to-transparent" />
                      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between z-10">
                        <span className="text-[9px] font-bold text-white bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded border border-white/10 shadow-sm">{label}</span>
                        <div className={`p-1 rounded-full ${muted ? "bg-rose-500/90" : "bg-emerald-500/90"} border border-white/10 shadow-md`}>
                          {muted ? <MicOff className="h-2.5 w-2.5 text-white" /> : <Mic className="h-2.5 w-2.5 text-white" />}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* CENTER — Game stage with transparent emcee on top */}
                <div className="relative overflow-hidden" style={{ 
                  backgroundImage: "url('/gameshow-stage-feud.png')",
                  backgroundSize: "cover",
                  backgroundPosition: "center bottom"
                }}>

                  {/* Black gradient overlay to fade out top audience seats */}
                  <div className="absolute top-0 inset-x-0 h-[64%] bg-gradient-to-b from-zinc-950 via-zinc-950/95 via-zinc-950/70 to-transparent pointer-events-none z-10" />

                  {/* Note: The 'Triumph Game Show' text was programmatically healed/removed from /public/gameshow-stage-feud.png directly. No cover div needed. */}

                  {/* Stage spotlights & Game Show stage elements */}
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-full opacity-15"
                      style={{ background: "radial-gradient(ellipse 50px 180px at center top, rgba(168,85,247,0.8), transparent)" }} />
                    <div className="absolute top-0 left-1/4 w-16 h-2/3 opacity-10"
                      style={{ background: "radial-gradient(ellipse 25px 130px at center top, rgba(236,72,153,0.9), transparent)" }} />
                    <div className="absolute top-0 right-1/4 w-16 h-2/3 opacity-10"
                      style={{ background: "radial-gradient(ellipse 25px 130px at center top, rgba(236,72,153,0.9), transparent)" }} />
                    
                    {/* Branded Game Show Stage Grid Background */}
                    <div className="absolute inset-0 bg-[linear-gradient(rgba(139,92,246,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(139,92,246,0.04)_1px,transparent_1px)] bg-[size:24px_24px] opacity-35" />
                    
                    {/* Branded Game Show Stage Neon Floor Spotlights */}
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[85%] h-20 rounded-full bg-purple-500/10 blur-xl" />
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[70%] h-10 rounded-full bg-pink-500/5 blur-lg" />
                    
                    {/* Laser Horizon and Stage Perspective Line */}
                    <div className="absolute bottom-0 inset-x-0 h-32 bg-gradient-to-t from-purple-900/5 to-transparent border-t border-purple-500/10" />
                    
                    {/* Glowing Hot Pink Neon Stage Border */}
                    <div className="absolute inset-0 border border-pink-500/20 rounded-none z-10"
                      style={{ boxShadow: "inset 0 0 15px rgba(236,72,153,0.15)" }} />
                  </div>

                  {/* ── UNIFIED ZOOM SPOTLIGHTS & GAME LOBBY INTERFACE ── */}
                  <div className="absolute inset-0 z-30 flex flex-col justify-between p-3.5 pointer-events-none">
                    
                    {/* Top Row: Zoom Spotlights */}
                    <div className="w-full grid grid-cols-2 gap-3.5 pointer-events-auto">
                      
                      {/* Top-Left: Host Emcee Spotlight */}
                      <div className="relative aspect-[16/10] sm:aspect-[16/9] rounded-xl overflow-hidden border border-purple-500/40 bg-zinc-950/90 shadow-[0_0_15px_rgba(139,92,246,0.25)]">
                        {/* Spotlight Tag - Positioned at top-right to avoid overlap with Michael/Host name in image */}
                        <div className="absolute top-1.5 right-2 z-20 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded-md text-[8px] font-bold text-white border border-white/5 shadow-sm">
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse shadow-[0_0_6px_#a855f7]" />
                          🎙️ Spotlight: Host Emcee
                        </div>
                        
                        {/* Host Real Zoom meeting image */}
                        <img
                          src="/michael-host-zoom.png"
                          alt="Michael - Teamtastic Host"
                          className="w-full h-full object-cover object-center select-none"
                        />
                      </div>

                      {/* Top-Right: Active Speaker Spotlight (Elena responding live) */}
                      <div className="relative aspect-[16/10] sm:aspect-[16/9] rounded-xl overflow-hidden border border-pink-500/40 bg-zinc-950/90 shadow-[0_0_15px_rgba(236,72,153,0.25)]">
                        {/* Spotlight Tag */}
                        <div className="absolute top-1.5 left-2 z-20 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded-md text-[8px] font-bold text-white border border-white/5 shadow-sm">
                          <span className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-ping shadow-[0_0_6px_#ec4899]" />
                          ⚡ Spotlight: Active Player
                        </div>
                        
                        {/* Spotlight player feed */}
                        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-pink-950/15 to-transparent">
                          <img
                            src="/p4.png"
                            alt="Elena (Design) Spotlight"
                            className="w-full h-full object-cover object-center select-none"
                          />
                          {/* Live speaking badge */}
                          <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-sm px-2 py-0.5 rounded-md text-[8px] font-bold text-emerald-400 border border-emerald-500/20 shadow-md flex items-center gap-1.5">
                            <span className="flex gap-0.5 items-end h-2">
                              <span className="w-[1.5px] h-1.5 bg-emerald-400 rounded-full animate-[bounce_0.8s_infinite]" />
                              <span className="w-[1.5px] h-2 bg-emerald-400 rounded-full animate-[bounce_0.6s_infinite_0.1s]" />
                              <span className="w-[1.5px] h-1 bg-emerald-400 rounded-full animate-[bounce_0.7s_infinite_0.2s]" />
                            </span>
                            Elena (Design) — Buzzing in! ⚡
                          </div>
                        </div>
                      </div>

                    </div>

                    {/* Middle: Game Title & Prompt */}
                    <div className="flex flex-col items-center text-center my-1.5 pointer-events-none">
                      <div className="px-2.5 py-0.5 rounded-full border border-purple-500/35 bg-purple-950/85 mb-1 shadow-[0_0_10px_rgba(139,92,246,0.15)]">
                        <span className="text-[7.5px] text-purple-300 uppercase font-black tracking-widest">Active Game: What the Meme</span>
                      </div>
                      {/* Meme Prompt Card */}
                      <div className="px-3.5 py-1.5 rounded-xl bg-purple-950/95 border border-purple-500/40 text-center shadow-[0_0_15px_rgba(139,92,246,0.2)] backdrop-blur-sm max-w-[280px]">
                        <p className="text-[9.5px] font-extrabold text-white tracking-wide leading-tight">
                          "When a quick 5-Minute meeting hits the 50-Minute Mark ⏰"
                        </p>
                      </div>
                    </div>

                    {/* Bottom: Meme Options 2x2 Grid using generated funny meme images */}
                    <div className="grid grid-cols-2 gap-2 max-w-[380px] w-full mx-auto z-30 pointer-events-auto">
                      {/* Option A */}
                      <div className="group relative flex flex-col bg-zinc-950/90 border border-emerald-500/30 rounded-xl overflow-hidden p-1 shadow-lg backdrop-blur-md transition-all duration-300 hover:scale-[1.02] hover:border-emerald-400 hover:shadow-[0_0_15px_rgba(16,185,129,0.3)] cursor-pointer">
                        <div className="relative aspect-[16/10] rounded-lg overflow-hidden mb-1">
                          <img src="/meme_a_skeleton.png" alt="Option A Meme" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                          <div className="absolute top-1 left-1 flex items-center justify-center w-5.5 h-5.5 rounded-full bg-emerald-500 text-white text-[10px] font-black shadow-[0_0_8px_rgba(16,185,129,0.5)]">A</div>
                          <div className="absolute bottom-0 inset-x-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent" />
                          <span className="absolute bottom-1 right-1 text-[7.5px] font-black text-emerald-400 bg-black/60 px-1 py-0.5 rounded">42% votes</span>
                        </div>
                        <div className="px-1 py-0.5">
                          <p className="text-[7.5px] font-bold text-zinc-100 leading-tight">
                            "This meeting could have been a Slack message..."
                          </p>
                          <div className="w-full h-1 bg-zinc-800 rounded-full mt-1.5 overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: "42%" }} />
                          </div>
                        </div>
                      </div>

                      {/* Option B */}
                      <div className="group relative flex flex-col bg-zinc-950/90 border border-purple-500/30 rounded-xl overflow-hidden p-1 shadow-lg backdrop-blur-md transition-all duration-300 hover:scale-[1.02] hover:border-purple-400 hover:shadow-[0_0_15px_rgba(168,85,247,0.3)] cursor-pointer">
                        <div className="relative aspect-[16/10] rounded-lg overflow-hidden mb-1">
                          <img src="/meme_b_dramatic_cat.png" alt="Option B Meme" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                          <div className="absolute top-1 left-1 flex items-center justify-center w-5.5 h-5.5 rounded-full bg-purple-500 text-white text-[10px] font-black shadow-[0_0_8px_rgba(168,85,247,0.5)]">B</div>
                          <div className="absolute bottom-0 inset-x-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent" />
                          <span className="absolute bottom-1 right-1 text-[7.5px] font-black text-purple-400 bg-black/60 px-1 py-0.5 rounded">28% votes</span>
                        </div>
                        <div className="px-1 py-0.5">
                          <p className="text-[7.5px] font-bold text-zinc-100 leading-tight">
                            "Still waiting for 'any other business' to wrap up..."
                          </p>
                          <div className="w-full h-1 bg-zinc-800 rounded-full mt-1.5 overflow-hidden">
                            <div className="h-full bg-purple-500 rounded-full" style={{ width: "28%" }} />
                          </div>
                        </div>
                      </div>

                      {/* Option C */}
                      <div className="group relative flex flex-col bg-zinc-950/90 border border-blue-500/30 rounded-xl overflow-hidden p-1 shadow-lg backdrop-blur-md transition-all duration-300 hover:scale-[1.02] hover:border-blue-400 hover:shadow-[0_0_15px_rgba(59,130,246,0.3)] cursor-pointer">
                        <div className="relative aspect-[16/10] rounded-lg overflow-hidden mb-1">
                          <img src="/meme_c_facepalm.png" alt="Option C Meme" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                          <div className="absolute top-1 left-1 flex items-center justify-center w-5.5 h-5.5 rounded-full bg-blue-500 text-white text-[10px] font-black shadow-[0_0_8px_rgba(59,130,246,0.5)]">C</div>
                          <div className="absolute bottom-0 inset-x-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent" />
                          <span className="absolute bottom-1 right-1 text-[7.5px] font-black text-blue-400 bg-black/60 px-1 py-0.5 rounded">18% votes</span>
                        </div>
                        <div className="px-1 py-0.5">
                          <p className="text-[7.5px] font-bold text-zinc-100 leading-tight">
                            "I had a family, a life, dreams... before slide 42."
                          </p>
                          <div className="w-full h-1 bg-zinc-800 rounded-full mt-1.5 overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full" style={{ width: "18%" }} />
                          </div>
                        </div>
                      </div>

                      {/* Option D */}
                      <div className="group relative flex flex-col bg-zinc-950/90 border border-pink-500/30 rounded-xl overflow-hidden p-1 shadow-lg backdrop-blur-md transition-all duration-300 hover:scale-[1.02] hover:border-pink-400 hover:shadow-[0_0_15px_rgba(236,72,153,0.3)] cursor-pointer">
                        <div className="relative aspect-[16/10] rounded-lg overflow-hidden mb-1">
                          <img src="/meme_d_melting_clock.png" alt="Option D Meme" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                          <div className="absolute top-1 left-1 flex items-center justify-center w-5.5 h-5.5 rounded-full bg-pink-500 text-white text-[10px] font-black shadow-[0_0_8px_rgba(236,72,153,0.5)]">D</div>
                          <div className="absolute bottom-0 inset-x-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent" />
                          <span className="absolute bottom-1 right-1 text-[7.5px] font-black text-pink-400 bg-black/60 px-1 py-0.5 rounded">12% votes</span>
                        </div>
                        <div className="px-1 py-0.5">
                          <p className="text-[7.5px] font-bold text-zinc-100 leading-tight">
                            "'Just one last slide...' *starts a new 10-slide deck*"
                          </p>
                          <div className="w-full h-1 bg-zinc-800 rounded-full mt-1.5 overflow-hidden">
                            <div className="h-full bg-pink-500 rounded-full" style={{ width: "12%" }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Floating emojis */}
                  <div className="absolute inset-0 pointer-events-none overflow-hidden z-30">
                    <AnimatePresence>
                      {floatingEmojis.map((item) => (
                        <motion.div key={item.id}
                          initial={{ y: 420, x: item.xOffset + 90, opacity: 0, scale: 0.5 }}
                          animate={{ y: 20, x: item.xOffset + 90 + Math.sin(item.id) * 18, opacity: [0, 1, 1, 0], scale: item.size }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 3, ease: "easeOut" }}
                          className="absolute bottom-0 text-lg">
                          {item.emoji}
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>

                  {/* Live chat feed */}
                  <div className="absolute bottom-10 left-2 right-2 flex flex-col gap-1.5 pointer-events-none z-40">
                    <AnimatePresence>
                      {activeChats.map((chat, idx) => (
                        <motion.div key={`${chat.id}-${idx}`}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          transition={{ duration: 0.3 }}
                          className="self-start flex items-center gap-2 px-2.5 py-1.5 rounded-2xl"
                          style={{ background: "rgba(15,23,42,0.88)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.08)" }}>
                          <span className="text-[9px] font-extrabold text-purple-300">{chat.user}</span>
                          <span className="text-[9px] text-zinc-100">{chat.text}</span>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>

                  {/* Host badge */}
                  <div className="absolute bottom-2 right-2 z-40">
                    <span className="text-[9px] font-bold text-white bg-purple-600/90 px-2 py-1 rounded-lg border border-purple-400/30 shadow-lg">
                      Host: Founder (MC) 👑
                    </span>
                  </div>
                </div>

                {/* RIGHT — Individual images, object-cover, NO squishing */}
                <div className="flex flex-col border-l border-white/5">
                  {rightTiles.map(({ src, label, muted }) => (
                    <div key={label} className="flex-1 relative overflow-hidden border-b border-white/5 last:border-b-0">
                      <img src={src} alt={label} className="absolute inset-0 w-full h-full object-cover object-center" />
                      <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-black/60 to-transparent" />
                      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between z-10">
                        <span className="text-[9px] font-bold text-white bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded border border-white/10 shadow-sm">{label}</span>
                        <div className={`p-1 rounded-full ${muted ? "bg-rose-500/90" : "bg-emerald-500/90"} border border-white/10 shadow-md`}>
                          {muted ? <MicOff className="h-2.5 w-2.5 text-white" /> : <Mic className="h-2.5 w-2.5 text-white" />}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom control bar — mimics a premium video conference (Zoom / Google Meet) */}
              <div className="px-6 py-4 bg-zinc-950 border-t border-white/5 flex items-center justify-between">
                
                {/* Left side: Connection status & Room Code */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </div>
                    <span className="text-[10px] font-bold text-zinc-400 tracking-widest uppercase hidden sm:inline">Live Connected</span>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-500 bg-zinc-900 px-2 py-1 rounded border border-white/5 uppercase">
                    tmt-show-live
                  </span>
                </div>

                {/* Center: Video Conferencing Buttons */}
                <div className="flex items-center gap-3">
                  <button className="p-3 rounded-full bg-zinc-900 border border-white/10 text-zinc-300 hover:bg-zinc-800 hover:text-white transition-all shadow-md active:scale-95" title="Mute/Unmute Microphone">
                    <Mic className="h-4 w-4" />
                  </button>
                  <button className="p-3 rounded-full bg-zinc-900 border border-white/10 text-zinc-300 hover:bg-zinc-800 hover:text-white transition-all shadow-md active:scale-95" title="Start/Stop Video">
                    <Video className="h-4 w-4" />
                  </button>
                  <button className="p-3 rounded-full bg-zinc-900 border border-white/10 text-zinc-300 hover:bg-zinc-800 hover:text-white transition-all shadow-md active:scale-95" title="Share Screen">
                    <MonitorUp className="h-4 w-4" />
                  </button>
                  <button className="p-3 rounded-full bg-zinc-900 border border-white/10 text-zinc-300 hover:bg-zinc-800 hover:text-white transition-all shadow-md active:scale-95" title="Reactions">
                    <Smile className="h-4 w-4" />
                  </button>
                  <button className="p-3 rounded-full bg-rose-600 border border-rose-500/30 text-white hover:bg-rose-500 transition-all shadow-md active:scale-95 flex items-center justify-center" title="End Call / Leave Lobby">
                    <PhoneOff className="h-4 w-4" />
                  </button>
                </div>

                {/* Right side: Settings & Video Quality */}
                <div className="flex items-center gap-3">
                  <button className="p-2 rounded-xl text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 transition-colors">
                    <Settings className="h-4 w-4" />
                  </button>
                  <span className="text-[10px] font-bold text-zinc-500 tracking-wider hidden md:inline uppercase">
                    1080p 60fps
                  </span>
                </div>

              </div>
            </div>
          </div>

          {/* Tagline */}
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl text-white pt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5">
            <span>Play. Connect.</span>
            <span className="font-script text-brand-pink neon-glow-pink text-5xl sm:text-7xl inline-block"
              style={{ transform: "rotate(-2deg)" }}>
              Celebrate.
            </span>
          </h1>

          <p className="max-w-xl text-base text-zinc-400 font-medium leading-relaxed">
            Transform dry Zoom calls into electric team game shows. Live emcee-hosted events, custom trivia, meme battles, and real-time tournaments — zero downloads required.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            <Link href="/#quiz"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-base font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-[0_0_25px_rgba(139,92,246,0.4)] hover:shadow-[0_0_40px_rgba(236,72,153,0.6)] transition-all duration-300 hover:-translate-y-1">
              <Sparkles className="h-5 w-5 text-amber-300 animate-pulse" />
              Book an Event
            </Link>
            <a href="https://teamtastic.games"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-base font-bold text-zinc-200 border border-white/10 hover:border-white/25 bg-white/5 hover:bg-white/10 hover:text-white transition-all duration-300 hover:-translate-y-1">
              Try a Free Game
            </a>
          </div>

        </div>
      </div>
    </section>
  );
}
