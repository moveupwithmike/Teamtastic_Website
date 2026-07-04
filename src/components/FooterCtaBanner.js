"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import TalkToMichaelModal from "./TalkToMichaelModal";
import { track } from "@/lib/analytics";

export default function FooterCtaBanner() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
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
                  onClick={() => { track("concierge_modal_opened", { source: "footer_cta_banner" }); setIsOpen(true); }}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-sm font-bold text-zinc-355 border border-white/15 bg-white/5 hover:bg-white/10 hover:text-white transition-all hover:scale-[1.02] cursor-pointer"
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
