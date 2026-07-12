import Link from "next/link";
import { ArrowRight, BookOpen, HelpCircle, Map, FileText, Calendar } from "lucide-react";

export const metadata = {
  alternates: {
    canonical: "https://teamtastic.events/resources",
  },
  title: "Virtual Team Building Resources & Event Planning Guides | Teamtastic",
  description:
    "Free resources for HR leaders and event planners. How Teamtastic works, event planning guides, FAQs, and platform integration details for virtual team building.",
  openGraph: {
    title: "Resources — Teamtastic Event Planning Hub",
    description: "Everything you need to plan the perfect virtual team event. Guides, FAQs, platform integrations, and more.",
    url: "https://teamtastic.events/resources",
  },
};

const resources = [
  {
    icon: Map,
    title: "How It Works",
    desc: "A step-by-step visual guide to booking, briefing, and going live with Teamtastic in under 10 minutes.",
    href: "/resources/how-it-works",
    color: "border-purple-500/30 bg-purple-500/5",
    iconColor: "text-purple-400",
    badge: "Start Here",
  },
  {
    icon: HelpCircle,
    title: "FAQ",
    desc: "Answers to the 20+ most common questions from HR leaders, EAs, and event organizers about Teamtastic.",
    href: "/resources/faq",
    color: "border-sky-500/30 bg-sky-500/5",
    iconColor: "text-sky-400",
    badge: null,
  },
  {
    icon: FileText,
    title: "Event Planning Guide",
    desc: "Our comprehensive checklist for planning a stress-free, high-engagement virtual team event from start to finish.",
    href: "/resources/event-planning-guide",
    color: "border-emerald-500/30 bg-emerald-500/5",
    iconColor: "text-emerald-400",
    badge: "Free Download",
  },
  {
    icon: Calendar,
    title: "Event Calendar Templates",
    desc: "Pre-built monthly team building calendar templates for HR teams — covering cultural moments, quarters, and seasonal themes.",
    href: "/#quiz",
    color: "border-amber-500/30 bg-amber-500/5",
    iconColor: "text-amber-400",
    badge: null,
  },
];

const platforms = [
  { name: "Zoom", logo: "🎥" },
  { name: "Microsoft Teams", logo: "💼" },
  { name: "Google Meet", logo: "📹" },
  { name: "Webex", logo: "🌐" },
  { name: "Any Browser", logo: "🖥️" },
];

export default function Resources() {
  return (
    <main className="flex flex-col min-h-screen bg-brand-dark">
      {/* Hero */}
      <section className="relative pt-24 pb-20 overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-sky-900/20 via-zinc-950 to-zinc-950" />
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-4 py-1.5 text-xs font-semibold text-sky-300">
            <BookOpen className="h-3 w-3" />
            Free Guides & Planning Tools
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Event Planning Resources
          </h1>
          <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
            Everything HR leaders, executive assistants, and team managers need to plan, brief, and run a flawless virtual team event with Teamtastic.
          </p>
        </div>
      </section>

      {/* Resource Cards */}
      <section className="py-16 md:py-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {resources.map(({ icon: Icon, title, desc, href, color, iconColor, badge }) => (
              <Link
                key={title}
                href={href}
                className={`glassmorphism rounded-2xl p-7 border hover:-translate-y-1 transition-all duration-300 group ${color}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <Icon className={`h-7 w-7 ${iconColor}`} />
                  {badge && (
                    <span className="px-2.5 py-1 bg-black/40 border border-white/10 text-white text-[10px] font-bold uppercase tracking-wider rounded-full">
                      {badge}
                    </span>
                  )}
                </div>
                <h2 className="text-xl font-bold text-white mb-2 group-hover:text-purple-300 transition-colors">{title}</h2>
                <p className="text-sm text-zinc-400 leading-relaxed mb-4">{desc}</p>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-purple-400 group-hover:gap-2 transition-all">
                  Explore <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Platform Integrations */}
      <section className="py-16 bg-zinc-950/40 border-y border-white/5">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-extrabold text-white mb-4">Works With Every Platform You Already Use</h2>
          <p className="text-zinc-400 text-sm mb-10 max-w-lg mx-auto">
            Teamtastic runs inside your existing video call. No new software. No IT approvals. Just share a link and play.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            {platforms.map(({ name, logo }) => (
              <div key={name} className="glassmorphism rounded-xl px-5 py-3 border border-white/5 flex items-center gap-2">
                <span className="text-xl">{logo}</span>
                <span className="text-sm font-semibold text-zinc-300">{name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="mx-auto max-w-2xl px-4 text-center space-y-6">
          <h2 className="text-3xl font-extrabold text-white">Have a Question Not Covered Here?</h2>
          <p className="text-zinc-400">Take our Event Quiz and we&apos;ll give you a tailored recommendation and answer any questions directly.</p>
          <Link
            href="/#quiz"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-base font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-[0_0_25px_rgba(139,92,246,0.4)] transition-all duration-300 hover:-translate-y-1"
          >
            Start the Event Quiz <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>
    </main>
  );
}
