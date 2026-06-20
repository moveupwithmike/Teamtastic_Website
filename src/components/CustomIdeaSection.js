"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import TalkToMichaelModal from "./TalkToMichaelModal";

export default function CustomIdeaSection() {
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

      {/* Talk To Michael Concierge Modal */}
      <TalkToMichaelModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
