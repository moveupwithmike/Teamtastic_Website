"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Mail } from "lucide-react";

export default function Footer() {
  const pathname = usePathname();
  const isExperiencesPage = pathname === "/team-experiences" || pathname === "/virtual-family-game-night";

  if (isExperiencesPage) {
    return (
      <footer className="w-full bg-[#030712] border-t border-white/5 py-12 mt-auto">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8 pb-8 border-b border-white/5">
            {/* Left side: Logo & Subtitle */}
            <div className="flex flex-col items-center md:items-start gap-2">
              <Link href="/" className="flex items-center gap-2.5 group">
                <Image 
                  src="/logo-highfive-transparent.png" 
                  width={80}
                  height={80}
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
                { href: "/themes", label: "Seasonal Themes" },
                { href: "/virtual-holiday-party", label: "Holiday Parties" },
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

            </div>

          {/* Lower Copyright Row */}
          <div className="mt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs text-zinc-500">
              &copy; {new Date().getFullYear()} Teamtastic. All rights reserved.
            </p>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <a
                href="mailto:hello@teamtastic.events"
                className="text-xs text-zinc-500 hover:text-white transition-colors flex items-center gap-1"
              >
                <Mail className="h-3.5 w-3.5" />
                Contact Support
              </a>
              <Link href="/privacy" className="text-xs text-zinc-500 hover:text-white transition-colors">
                Privacy Policy
              </Link>
              <Link href="/terms" className="text-xs text-zinc-500 hover:text-white transition-colors">
                Terms of Service
              </Link>
              <Link href="/cancellation-policy" className="text-xs text-zinc-500 hover:text-white transition-colors">
                Cancellations &amp; Refunds
              </Link>
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
              <Image 
                src="/logo-highfive-transparent.png" 
                width={80}
                height={80}
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
                <Link href="/virtual-holiday-party" className="text-sm text-zinc-400 hover:text-white transition-colors">
                  Virtual Holiday Parties
                </Link>
              </li>
              <li>
                <Link href="/themes" className="text-sm text-zinc-400 hover:text-white transition-colors">
                  Seasonal & Themed Events
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
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 md:justify-end">
            <a
              href="mailto:hello@teamtastic.events"
              className="text-xs text-zinc-500 hover:text-white transition-colors flex items-center gap-1"
            >
              <Mail className="h-3.5 w-3.5" />
              Contact Support
            </a>
            <Link href="/privacy" className="text-xs text-zinc-500 hover:text-white transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-xs text-zinc-500 hover:text-white transition-colors">
              Terms of Service
            </Link>
            <Link href="/cancellation-policy" className="text-xs text-zinc-500 hover:text-white transition-colors">
              Cancellations &amp; Refunds
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
