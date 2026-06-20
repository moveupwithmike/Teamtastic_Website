"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Gamepad2, Heart, ShieldCheck, HelpCircle, Mail } from "lucide-react";

export default function Footer() {
  const pathname = usePathname();
  const isExperiencesPage = pathname === "/team-experiences";

  if (isExperiencesPage) {
    return (
      <footer className="w-full bg-[#030712] border-t border-white/5 py-12 mt-auto">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8 pb-8 border-b border-white/5">
            {/* Left side: Logo & Subtitle */}
            <div className="flex flex-col items-center md:items-start gap-2">
              <Link href="/" className="flex items-center gap-2.5 group">
                <img 
                  src="/logo-highfive-transparent.png" 
                  className="h-10 w-auto opacity-95 group-hover:opacity-100 transition-all hover:scale-105" 
                  alt="Teamtastic Logo" 
                />
                <span className="text-lg font-extrabold tracking-tight text-white group-hover:text-brand-pink transition-colors font-sans">
                  Teamtastic
                </span>
              </Link>
              <span className="font-script text-brand-pink neon-glow-pink text-2xl rotate-[-2deg] tracking-wide mt-1">
                Play. Connect. Celebrate.
              </span>
            </div>

            {/* Center: Horizontal Navigation Links */}
            <nav className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
              {[
                { href: "/team-experiences", label: "Experiences" },
                { href: "/resources/how-it-works", label: "How It Works" },
                { href: "/#use-cases", label: "Solutions" },
                { href: "/why-teamtastic", label: "About Michael" },
                { href: "/resources", label: "Resources" },
                { href: "/pricing", label: "Pricing" }
              ].map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="text-sm font-medium text-zinc-400 hover:text-white transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* Right: Social Media Icons using inline SVGs */}
            <div className="flex items-center gap-4.5">
              <a href="#" className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-all" aria-label="Facebook">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd" />
                </svg>
              </a>
              <a href="#" className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-all" aria-label="Instagram">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path fillRule="evenodd" d="M12.315 2c2.43 0 2.784.008 3.885.056 1 .046 1.6.21 1.957.35a3.621 3.621 0 011.31 1.1c.35.35.53.77.67 1.31.14.357.27.95.31 1.95.05 1.09.056 1.444.056 3.885s-.008 2.784-.056 3.885c-.046 1-.21 1.6-.35 1.957a3.621 3.621 0 01-1.1 1.31c-.35.35-.77.53-1.31.67-.357.14-.95.27-1.95.31-1.09.05-1.444.056-3.885.056s-2.784-.008-3.885-.056c-1-.046-1.6-.21-1.957-.35a3.621 3.621 0 01-1.1-1.31c-.35-.35-.53-.77-.67-1.31-.14-.357-.27-.95-.31-1.95C2 14.829 2 14.474 2 12.03s.008-2.784.056-3.885c.046-1 .21-1.6.35-1.957a3.621 3.621 0 011.1-1.31c.35-.35.77-.53 1.31-.67.357-.14.95-.27 1.95-.31C9.248 2.01 9.602 2 12.03 2h.285zm.01 2.003c-2.4 0-2.718.008-3.661.05-1 .046-1.5.21-1.8.32a2.14 2.14 0 00-.77.5c-.2.2-.36.44-.5.77-.11.3-.27.8-.32 1.8-.04 1-.05 1.27-.05 3.66s.01 2.718.05 3.661c.04 1 .2 1.5.3 1.8.14.33.3.57.5.77.2.2.44.36.77.5.3.11.8.27 1.8.32 1 .04 1.27.05 3.66.05s2.718-.01 3.661-.05c1-.04 1.5-.2 1.8-.3.33-.14.57-.3.77-.5.2-.2.36-.44.5-.77.11-.3.27-.8.32-1.8.04-1 .05-1.27.05-3.66s-.01-2.718-.05-3.661c-.04-1-.2-1.5-.3-1.8a2.14 2.14 0 00-.5-.77 2.14 2.14 0 00-.77-.5c-.3-.11-.8-.27-1.8-.32-1-.04-1.27-.05-3.661-.05zm0 3.782a4.22 4.22 0 100 8.44 4.22 4.22 0 000-8.44zm0 6.435a2.215 2.215 0 110-4.43 2.215 2.215 0 010 4.43zm5.848-7.23a1.002 1.002 0 11-2.004 0 1.002 1.002 0 012.004 0z" clipRule="evenodd" />
                </svg>
              </a>
              <a href="#" className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-all" aria-label="LinkedIn">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path fillRule="evenodd" d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.779-1.75-1.75s.784-1.75 1.75-1.75 1.75.779 1.75 1.75-.784 1.75-1.75 1.75zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" clipRule="evenodd" />
                </svg>
              </a>
              <a href="#" className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-all" aria-label="YouTube">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path fillRule="evenodd" d="M23.498 6.163a3.003 3.003 0 00-2.11-2.11C19.53 3.545 12 3.545 12 3.545s-7.53 0-9.388.508a3.003 3.003 0 00-2.11 2.11C0 8.022 0 12 0 12s0 3.978.502 5.837a3.003 3.003 0 002.11 2.11c1.858.507 9.388.507 9.388.507s7.53 0 9.388-.507a3.003 3.003 0 002.11-2.11C24 15.978 24 12 24 12s0-3.978-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" clipRule="evenodd" />
                </svg>
              </a>
            </div>
          </div>

          {/* Lower Copyright Row */}
          <div className="mt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs text-zinc-500">
              &copy; 2024 Teamtastic. All rights reserved.
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

  // Original Footer
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
