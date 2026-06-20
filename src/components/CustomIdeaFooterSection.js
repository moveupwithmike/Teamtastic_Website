"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import TalkToMichaelModal from "./TalkToMichaelModal";

export default function CustomIdeaFooterSection() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* ══ CUSTOM IDEA / TALK TO MICHAEL SECTION ══ */}
      <section className="py-16 bg-zinc-950 border-t border-white/5 relative overflow-hidden">
        <div className="absolute inset-0 -z-10" style={{
          background: "radial-gradient(circle at 20% 50%, rgba(236,72,153,0.06) 0%, transparent 60%)"
        }} />
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center space-y-6 relative z-10">
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
            Have a custom idea? <br className="sm:hidden" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-purple to-brand-pink">
              Talk to Michael.
            </span>
          </h2>
          <p className="max-w-2xl mx-auto text-sm sm:text-base text-zinc-300 leading-relaxed font-medium">
            From company trivia and inside jokes to holiday themes and leadership shoutouts, we&apos;ll help shape the right experience.
          </p>
          <div className="pt-2">
            <button
              onClick={() => setIsOpen(true)}
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-sm font-bold text-white bg-[#D81B60] hover:bg-pink-600 shadow-lg shadow-pink-500/20 hover:scale-[1.02] transition-all cursor-pointer"
            >
              Talk to Michael
              <ArrowRight className="h-4.5 w-4.5 text-white" />
            </button>
          </div>
        </div>
      </section>

      {/* ══ FOOTER CTA BANNER (DARK THEME WITH CONFETTI) ══ */}
      <section className="py-12 relative overflow-hidden bg-zinc-955 border-t border-white/5">
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
                <span>Play. Connect.</span>{" "}
                <span className="font-script text-brand-pink neon-glow-pink text-3xl md:text-4xl inline-block ml-2" style={{ transform: "rotate(-2deg)" }}>Celebrate.</span>
              </h3>
              <p className="text-zinc-300 text-sm md:text-base leading-relaxed">
                Book your event today and leave the rest to us! We manage the games, screen sharing, music, and energy curation so your host can enjoy the show.
              </p>
              <div className="flex flex-col sm:flex-row items-center gap-4 pt-2">
                <Link href="/#quiz" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-sm font-bold text-white bg-[#D81B60] hover:bg-pink-600 shadow-lg shadow-purple-500/20 hover:scale-[1.02] transition-all">
                  BOOK YOUR EVENT
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <button
                  onClick={() => setIsOpen(true)}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-sm font-bold text-zinc-350 border border-white/15 bg-white/5 hover:bg-white/10 hover:text-white transition-all hover:scale-[1.02] cursor-pointer"
                >
                  Talk to Michael
                </button>
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
              <div className="absolute -top-16 -left-12 md:-left-24 rotate-[-6deg] bg-amber-400 text-zinc-950 px-4 py-2 rounded-2xl shadow-xl font-script text-lg md:text-xl font-bold border-2 border-zinc-950">
                I can&apos;t wait to host your event! <br />
                <span className="float-right text-sm font-sans tracking-wide font-extrabold">— Michael</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Talk To Michael Concierge Modal */}
      <TalkToMichaelModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
