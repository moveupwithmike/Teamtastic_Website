import Link from "next/link";
import { Gamepad2, Heart, ShieldCheck, HelpCircle, Mail } from "lucide-react";

export default function Footer() {
  return (
    <footer className="w-full bg-brand-dark border-t border-white/5 py-12 md:py-16 mt-auto">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
          {/* Brand Info block */}
          <div className="col-span-2 space-y-4">
            <Link href="/" className="flex items-center gap-2.5 group">
              <img 
                src="/logo-highfive-transparent.png" 
                className="h-10 w-auto opacity-90 group-hover:opacity-100 transition-all hover:scale-105" 
                alt="Teamtastic Logo" 
              />
              <span className="text-lg font-extrabold tracking-tight text-white group-hover:text-brand-pink transition-colors font-sans">
                Teamtastic
              </span>
            </Link>
            <p className="text-sm text-zinc-400 max-w-xs">
              The high-octane corporate virtual game show your remote teams actually look forward to. Zero installations, infinite laughs.
            </p>
            {/* Compatibility Badge List */}
            <div className="pt-2">
              <span className="text-xs uppercase font-semibold tracking-wider text-zinc-500 block mb-2">
                Supported On All Conferencing Platforms
              </span>
              <div className="flex flex-wrap items-center gap-3">
                <div className="px-2.5 py-1 rounded bg-zinc-900 border border-white/5 text-[11px] font-medium text-zinc-300">
                  Zoom
                </div>
                <div className="px-2.5 py-1 rounded bg-zinc-900 border border-white/5 text-[11px] font-medium text-zinc-300">
                  Microsoft Teams
                </div>
                <div className="px-2.5 py-1 rounded bg-zinc-900 border border-white/5 text-[11px] font-medium text-zinc-300">
                  Google Meet
                </div>
                <div className="px-2.5 py-1 rounded bg-zinc-900 border border-white/5 text-[11px] font-medium text-zinc-300">
                  Web Browser
                </div>
              </div>
            </div>
          </div>

          {/* Directory Column 1: Games */}
          <div>
            <span className="text-sm font-semibold text-white tracking-wide uppercase">Arcade Games</span>
            <ul className="mt-4 space-y-2">
              <li>
                <Link href="/#games" className="text-sm text-zinc-400 hover:text-white transition-colors">
                  Survey Showdown
                </Link>
              </li>
              <li>
                <Link href="/#games" className="text-sm text-zinc-400 hover:text-white transition-colors">
                  Lightning Feud
                </Link>
              </li>
              <li>
                <Link href="/#games" className="text-sm text-zinc-400 hover:text-white transition-colors">
                  Meme Battle
                </Link>
              </li>
              <li>
                <Link href="/#games" className="text-sm text-zinc-400 hover:text-white transition-colors">
                  Sound Bite Trivia
                </Link>
              </li>
            </ul>
          </div>

          {/* Directory Column 2: Use Cases & Info */}
          <div>
            <span className="text-sm font-semibold text-white tracking-wide uppercase">B2B Solutions</span>
            <ul className="mt-4 space-y-2">
              <li>
                <Link href="/#use-cases" className="text-sm text-zinc-400 hover:text-white transition-colors">
                  HR & People Ops
                </Link>
              </li>
              <li>
                <Link href="/#use-cases" className="text-sm text-zinc-400 hover:text-white transition-colors">
                  Remote Engineering Teams
                </Link>
              </li>
              <li>
                <Link href="/#use-cases" className="text-sm text-zinc-400 hover:text-white transition-colors">
                  Virtual Intern Cohorts
                </Link>
              </li>
              <li>
                <Link href="/#use-cases" className="text-sm text-zinc-400 hover:text-white transition-colors">
                  Private milestone Celebrations
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Lower Border & Legal info */}
        <div className="mt-12 pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-zinc-500">
            &copy; {new Date().getFullYear()} Teamtastic. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <a
              href="mailto:hello@teamtastic.events"
              className="text-xs text-zinc-500 hover:text-white transition-colors flex items-center gap-1"
            >
              <Mail className="h-3.5 w-3.5" />
              Contact Support
            </a>
            <span className="text-xs text-zinc-500 hover:text-white cursor-pointer">
              Privacy Policy
            </span>
            <span className="text-xs text-zinc-500 hover:text-white cursor-pointer">
              Terms of Service
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
