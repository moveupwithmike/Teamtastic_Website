"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronDown, Users } from "lucide-react";
import TalkToMichaelModal from "./TalkToMichaelModal";

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

      {/* ══ FREQUENTLY ASKED QUESTIONS (DARK 2-COLUMN) ══ */}
      <section className="py-12 md:py-16 bg-zinc-955/40 border-t border-white/5">
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
