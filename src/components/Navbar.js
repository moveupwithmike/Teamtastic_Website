"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Menu, X, Gamepad2, Users, CreditCard, Sparkles, LogIn, Star, BookOpen, PenLine } from "lucide-react";

const navLinks = [
  { href: "/virtual-team-building", label: "Team Building", icon: Users, iconColor: "text-emerald-400" },
  { href: "/games", label: "Games", icon: Gamepad2, iconColor: "text-purple-400" },
  { href: "/why-teamtastic", label: "Why Us", icon: Star, iconColor: "text-amber-400" },
  { href: "/resources", label: "Resources", icon: BookOpen, iconColor: "text-sky-400" },
  { href: "/blog", label: "Blog", icon: PenLine, iconColor: "text-zinc-400" },
  { href: "/pricing", label: "Pricing", icon: CreditCard, iconColor: "text-pink-400" },
];

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-all duration-300 ${
        scrolled ? "glassmorphism shadow-lg py-3" : "bg-transparent border-b border-transparent py-5"
      }`}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo & Wordmark */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center gap-3 group">
              <img 
                src="/logo-highfive-transparent.png" 
                className="h-[60px] w-auto opacity-95 group-hover:opacity-100 transition-all hover:scale-105" 
                alt="Teamtastic Logo" 
              />
              <span className="text-xl font-extrabold tracking-tight text-white group-hover:text-brand-pink transition-colors font-sans">
                Teamtastic
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-6">
            {navLinks.map(({ href, label, icon: Icon, iconColor }) => (
              <Link
                key={href}
                href={href}
                className="text-sm font-medium text-zinc-300 hover:text-white transition-colors flex items-center gap-1.5"
              >
                <Icon className={`h-3.5 w-3.5 ${iconColor}`} />
                {label}
              </Link>
            ))}
          </nav>

          {/* Action CTAs */}
          <div className="hidden lg:flex items-center gap-4">
            <a
              href="https://teamtastic.games"
              className="text-sm font-medium text-zinc-300 hover:text-white transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-white/5"
            >
              <LogIn className="h-4 w-4 text-purple-400" />
              Host Login
            </a>
            <Link
              href="/#quiz"
              className="relative inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-[0_0_15px_rgba(139,92,246,0.3)] hover:shadow-[0_0_20px_rgba(236,72,153,0.5)] transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0"
            >
              <Sparkles className="h-4 w-4 text-amber-300 animate-pulse" />
              Book an Event
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <div className="lg:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="inline-flex items-center justify-center p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 focus:outline-none"
              aria-label="Toggle Menu"
            >
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {isOpen && (
        <div className="lg:hidden glassmorphism border-t border-white/5 px-4 pt-4 pb-6 space-y-4 shadow-2xl">
          <nav className="flex flex-col gap-1">
            {navLinks.map(({ href, label, icon: Icon, iconColor }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setIsOpen(false)}
                className="text-base font-medium text-zinc-300 hover:text-white transition-colors py-2.5 px-2 rounded-lg hover:bg-white/5 flex items-center gap-2"
              >
                <Icon className={`h-5 w-5 ${iconColor}`} />
                {label}
              </Link>
            ))}
          </nav>
          <hr className="border-white/5" />
          <div className="flex flex-col gap-3">
            <a
              href="https://teamtastic.games"
              className="w-full flex h-11 items-center justify-center gap-2 rounded-xl border border-white/10 text-zinc-300 hover:text-white hover:bg-white/5 text-sm font-medium transition-colors"
            >
              <LogIn className="h-4 w-4 text-purple-400" />
              Host Login
            </a>
            <Link
              href="/#quiz"
              onClick={() => setIsOpen(false)}
              className="w-full flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 transition-colors"
            >
              <Sparkles className="h-4 w-4 text-amber-300" />
              Book an Event
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
