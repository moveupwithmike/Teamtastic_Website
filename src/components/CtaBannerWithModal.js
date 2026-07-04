"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import TalkToMichaelModal from "./TalkToMichaelModal";
import { track } from "@/lib/analytics";

export default function CtaBannerWithModal() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* ══ MAGENTA CTA BANNER ══ */}
      <section className="w-full py-10 bg-[#D81B60] text-center shadow-md">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="text-center md:text-left space-y-2">
            <h3 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              Ready to Bring Your Team Together?
            </h3>
            <p className="text-sm md:text-base text-pink-100 font-semibold leading-relaxed">
              Let&apos;s find the right experience for your team.
            </p>
            <p className="text-xs text-pink-200/90 font-medium">
              Teamtastic experiences start at $35 per person, with final pricing based on group size, event format, and customization.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0 w-full sm:w-auto">
            <Link
              href="/#quiz"
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-white text-pink-600 font-bold text-sm hover:bg-zinc-100 transition-all shadow-md flex items-center justify-center gap-1.5"
            >
              Book Your Event
              <ArrowRight className="h-4 w-4 text-pink-600" />
            </Link>
            <button
              onClick={() => { track("concierge_modal_opened", { source: "cta_banner" }); setIsOpen(true); }}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-pink-700 hover:bg-pink-850 text-white font-bold text-sm transition-all border border-pink-500/25 flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
            >
              Talk to Michael
            </button>
          </div>
        </div>
      </section>

      {/* Interactive Agent Modal */}
      <TalkToMichaelModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
