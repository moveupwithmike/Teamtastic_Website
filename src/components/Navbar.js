"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Gamepad2, Users, CreditCard, Sparkles, LogIn, Star, BookOpen, PenLine, ChevronDown } from "lucide-react";

const navLinks = [
  { href: "/virtual-team-building", label: "Virtual Team Building", icon: Users, iconColor: "text-emerald-400" },
  { href: "/#games", label: "Games", icon: Gamepad2, iconColor: "text-purple-400" },
  { href: "/why-teamtastic", label: "Why Teamtastic", icon: Star, iconColor: "text-amber-400" },
  { href: "/resources", label: "Resources", icon: BookOpen, iconColor: "text-sky-400" },
  { href: "/blog", label: "Blog", icon: PenLine, iconColor: "text-zinc-400" },
  { href: "/pricing", label: "Pricing", icon: CreditCard, iconColor: "text-pink-400" },
];

const experiencesLinks = [
  { href: "/team-experiences", label: "Experiences", hasDropdown: true },
  { href: "/resources/how-it-works", label: "How It Works" },
  { href: "/#use-cases", label: "Solutions", hasDropdown: true },
  { href: "/why-teamtastic", label: "About Michael" },
  { href: "/resources", label: "Resources", hasDropdown: true },
  { href: "/pricing", label: "Pricing" },
];

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  const isExperiencesPage = pathname === "/team-experiences";

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const currentLinks = isExperiencesPage ? experiencesLinks : navLinks;

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-all duration-300 ${
        isExperiencesPage
          ? scrolled ? "bg-white/95 border-b border-zinc-200/80 shadow-sm py-3" : "bg-transparent border-b border-transparent py-5"
          : scrolled ? "glassmorphism shadow-lg py-3" : "bg-transparent border-b border-transparent py-5"
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
              <span className={`text-xl font-extrabold tracking-tight font-sans transition-colors ${
                isExperiencesPage 
                  ? "text-zinc-900 group-hover:text-pink-600" 
                  : "text-white group-hover:text-brand-pink"
              }`}>
                Teamtastic
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-6">
            {currentLinks.map((link) => {
              if (isExperiencesPage) {
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="text-sm font-semibold text-zinc-700 hover:text-zinc-950 transition-colors flex items-center gap-1"
                  >
                    {link.label}
                    {link.hasDropdown && <ChevronDown className="h-3 w-3 text-zinc-400" />}
                  </Link>
                );
              } else {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="text-sm font-medium text-zinc-300 hover:text-white transition-colors flex items-center gap-1.5"
                  >
                    <Icon className={`h-3.5 w-3.5 ${link.iconColor}`} />
                    {link.label}
                  </Link>
                );
              }
            })}
          </nav>

          {/* Action CTAs */}
          <div className="hidden lg:flex items-center gap-4">
            <a
              href="https://teamtastic.games"
              className={`text-sm font-semibold transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${
                isExperiencesPage
                  ? "text-zinc-700 hover:text-zinc-950 hover:bg-zinc-100"
                  : "text-zinc-300 hover:text-white hover:bg-white/5"
              }`}
            >
              <LogIn className={`h-4 w-4 ${isExperiencesPage ? "text-purple-600" : "text-purple-400"}`} />
              Host Login
            </a>
            {isExperiencesPage ? (
              <Link
                href="/#quiz"
                className="inline-flex items-center justify-center px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-[#D81B60] hover:bg-pink-600 shadow-[0_4px_14px_rgba(216,27,96,0.3)] transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0"
              >
                BOOK YOUR EVENT
              </Link>
            ) : (
              <Link
                href="/#quiz"
                className="relative inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-[0_0_15px_rgba(139,92,246,0.3)] hover:shadow-[0_0_20px_rgba(236,72,153,0.5)] transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0"
              >
                <Sparkles className="h-4 w-4 text-amber-300 animate-pulse" />
                Book an Event
              </Link>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="lg:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className={`inline-flex items-center justify-center p-2 rounded-lg focus:outline-none ${
                isExperiencesPage
                  ? "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-900"
              }`}
              aria-label="Toggle Menu"
            >
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {isOpen && (
        <div className={`lg:hidden px-4 pt-4 pb-6 space-y-4 shadow-2xl ${
          isExperiencesPage
            ? "bg-white border-t border-zinc-200 text-zinc-900"
            : "glassmorphism border-t border-white/5 text-zinc-100"
        }`}>
          <nav className="flex flex-col gap-1">
            {currentLinks.map((link) => {
              if (isExperiencesPage) {
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setIsOpen(false)}
                    className="text-base font-semibold text-zinc-700 hover:text-zinc-950 transition-colors py-2.5 px-2 rounded-lg hover:bg-zinc-50 flex items-center justify-between"
                  >
                    <span>{link.label}</span>
                    {link.hasDropdown && <ChevronDown className="h-4 w-4 text-zinc-400" />}
                  </Link>
                );
              } else {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setIsOpen(false)}
                    className="text-base font-medium text-zinc-300 hover:text-white transition-colors py-2.5 px-2 rounded-lg hover:bg-white/5 flex items-center gap-2"
                  >
                    <Icon className={`h-5 w-5 ${link.iconColor}`} />
                    {link.label}
                  </Link>
                );
              }
            })}
          </nav>
          <hr className={isExperiencesPage ? "border-zinc-200" : "border-white/5"} />
          <div className="flex flex-col gap-3">
            <a
              href="https://teamtastic.games"
              className={`w-full flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-medium transition-colors ${
                isExperiencesPage
                  ? "border border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                  : "border border-white/10 text-zinc-300 hover:text-white hover:bg-white/5"
              }`}
            >
              <LogIn className={`h-4 w-4 ${isExperiencesPage ? "text-purple-600" : "text-purple-400"}`} />
              Host Login
            </a>
            {isExperiencesPage ? (
              <Link
                href="/#quiz"
                onClick={() => setIsOpen(false)}
                className="w-full flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-bold text-white bg-[#D81B60] hover:bg-pink-600 transition-colors"
              >
                BOOK YOUR EVENT
              </Link>
            ) : (
              <Link
                href="/#quiz"
                onClick={() => setIsOpen(false)}
                className="w-full flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 transition-colors"
              >
                <Sparkles className="h-4 w-4 text-amber-300" />
                Book an Event
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
