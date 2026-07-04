"use client";

import { useState } from "react";
import { ChevronDown, Users } from "lucide-react";
import TalkToMichaelModal from "./TalkToMichaelModal";
import { corporateFaqs } from "@/lib/corporate-faqs";

export default function FaqSection() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* ══ FREQUENTLY ASKED QUESTIONS (DARK 2-COLUMN) ══ */}
      <section className="py-12 md:py-16 bg-zinc-950/40 border-t border-white/5 relative z-10">
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
              {corporateFaqs.map((faq, idx) => (
                <details 
                  key={idx} 
                  className="group glassmorphism rounded-2xl border border-white/5 overflow-hidden transition-all duration-350 [&_summary::-webkit-details-marker]:hidden"
                >
                  <summary className="flex items-center justify-between p-6 cursor-pointer font-bold text-white hover:text-brand-pink transition-colors list-none">
                    <span className="text-sm font-sans">{faq.q}</span>
                    <ChevronDown className="h-4.5 w-4.5 text-zinc-400 transition-transform group-open:rotate-180 group-open:text-brand-pink shrink-0" />
                  </summary>
                  <div className="p-6 pt-0 border-t border-white/5 text-xs text-zinc-400 leading-relaxed bg-zinc-900/10 font-sans">
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
              <button 
                onClick={() => setIsOpen(true)} 
                className="w-full flex h-11 items-center justify-center gap-2 rounded-xl text-xs font-bold text-white bg-brand-purple hover:bg-brand-purple/90 shadow-md transition-all uppercase tracking-wider cursor-pointer"
              >
                Chat with us
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Talk To Michael Concierge Modal */}
      <TalkToMichaelModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
