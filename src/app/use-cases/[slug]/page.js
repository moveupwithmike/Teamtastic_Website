import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Users, ShieldCheck, Heart, Sparkles, HelpCircle, CheckCircle, ArrowRight } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

// Use Case metadata pool
const useCasesData = {
  "hr-and-people-ops": {
    title: "HR & People Operations Solutions",
    hook: "Frictionless virtual event templates built for remote-first corporate cultures.",
    badge: "Culture & Retention",
    painPoint: "Distributed remote employees suffer from culture silos and Zoom fatigue. Finding engaging, high-quality team social activities is highly time-consuming, resulting in low attendance and awkward forced icebreakers.",
    solution: "Teamtastic offers structured corporate game shows that employees actually want to show up to. With true team mode dynamics (collaborative buzz-ins, team scores), we dissolve silos, reduce hybrid burnouts, and raise team engagement scores by up to 40%.",
    benefitTitle: "Why HR Teams Love Us:",
    benefits: [
      "Zero Planning Stress: Select a pre-loaded standard template and launch in 5 seconds.",
      "High Inclusion: Diverse game modes (Trivia, Music, Creative Memes) ensure everyone participates.",
      "Professional MC Facilitation: Secure our founder or trained emcees to host your VIP quarterly social."
    ],
    recommendedGames: ["Survey Showdown", "Meme Battle"],
    slug: "hr-and-people-ops"
  },
  "remote-engineering-teams": {
    title: "Activities for Remote Engineering Teams",
    hook: "Low-stress, logic-driven virtual socials built for tech-savvy squads.",
    badge: "High-Logic Bonding",
    painPoint: "Traditional B2B team-building events feel cheesy, forced, or awkward for developers, QA analysts, and product leads. Tech-focused squads prefer collaborative, structural problem solving rather than rigid 'share a fun fact' check-ins.",
    solution: "We engineered puzzle escape chambers and cooperative drawing challenges designed for high-logic minds. It provides a collaborative gaming playground where developers can show off their wits, joke about stack failures inside meme battles, and connect without forced social pressure.",
    benefitTitle: "Why Tech Managers Love Us:",
    benefits: [
      "No Forced Smalltalk: Structured gameplay rules keep players focused on collaborative puzzle solving.",
      "Developer-Friendly bantering: Inject custom questions about your codebase, bugs, or system stack.",
      "Zero account friction: Play instantly inside the browser on any phone or notebook."
    ],
    recommendedGames: ["Boss Raid Escape", "Meme Battle"],
    slug: "remote-engineering-teams"
  },
  "virtual-intern-cohorts": {
    title: "Engagement for Virtual Intern Cohorts",
    hook: "Accelerate cohort trust and build long-lasting career networks virtually.",
    badge: "Rapid Trust-Building",
    painPoint: "Intern cohorts are remote-first and struggles to bond during short summer programs. Without routine physical desk interaction, it is difficult to build high-quality professional connections and alignment.",
    solution: "Teamtastic accelerates onboarding check-ins and internship programs by setting up rapid-fire, competitive game shows. Interns form collaborative teams, bantering, laughing, and building shared milestones in under 30 minutes.",
    benefitTitle: "Why Program Coordinators Love Us:",
    benefits: [
      "Rapid Cohort Integration: High-energy group setups foster immediate peer relationships.",
      "Onboarding Icebreakers: Custom-load training trivia and company history in a fun game format.",
      "Engagement Insights: View lobby stats to identify active, high-morale players."
    ],
    recommendedGames: ["Lightning Feud", "Canvas Co-op"],
    slug: "virtual-intern-cohorts"
  },
  "private-vip-socials": {
    title: "Hosted Private VIP Celebrations",
    hook: "Secure a professional game show emcee for milestone family parlor parties.",
    badge: "Milestone Parties",
    painPoint: "Private social events—milestone birthdays, virtual anniversaries, or high-end retirement gatherings—often lack coordinate energy when done online, separating distant families.",
    solution: "Bring the high-octane production values of a live B2B game show straight to your social parlor. Secure our master emcee personally to direct buzz-in movie trivia, custom family quizzes, and funny capture-the-moment photo rounds.",
    benefitTitle: "Why Private Hosts Love Us:",
    benefits: [
      "Founder-Hosted MC: Guaranteed charisma, comedy, and room-reading facilitation.",
      "Custom Family Boards: Inject custom questions, vintage baby photos, and private inside jokes.",
      "Safe and Simple: All generations can connect on any phone or browser in seconds."
    ],
    recommendedGames: ["Sound Bite Trivia", "Survey Showdown"],
    slug: "private-vip-socials"
  }
};

// Generates static pages at build time
export function generateStaticParams() {
  return [
    { slug: "hr-and-people-ops" },
    { slug: "remote-engineering-teams" },
    { slug: "virtual-intern-cohorts" },
    { slug: "private-vip-socials" }
  ];
}

export default async function UseCasePage({ params }) {
  const { slug } = await params;
  const uc = useCasesData[slug];

  if (!uc) {
    notFound();
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />

      <main className="flex-1 pt-24 pb-20">
        {/* Main Section */}
        <section className="relative py-12 md:py-20 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-pink-900/10 via-zinc-950 to-zinc-950 -z-10" />

          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <div className="space-y-6 text-left max-w-3xl">
              <span className="inline-flex px-3 py-1 bg-pink-500/10 border border-pink-500/20 text-pink-300 text-xs font-semibold rounded-full uppercase tracking-wider">
                {uc.badge}
              </span>
              <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl text-white">
                {uc.title}
              </h1>
              <p className="text-xl font-bold text-purple-300 italic">
                "{uc.hook}"
              </p>
              
              {/* Problem/Solution Box */}
              <div className="p-8 rounded-3xl bg-zinc-900/40 border border-white/5 space-y-6 mt-8">
                <div className="space-y-2">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-500 block">The B2B Challenge</span>
                  <p className="text-sm text-zinc-300 leading-relaxed">{uc.painPoint}</p>
                </div>
                <hr className="border-white/5" />
                <div className="space-y-2">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-purple-400 block">The Teamtastic Cure</span>
                  <p className="text-sm text-zinc-300 leading-relaxed">{uc.solution}</p>
                </div>
              </div>

              {/* Benefits list */}
              <div className="pt-8 space-y-4">
                <h3 className="text-lg font-bold text-white uppercase tracking-wider">{uc.benefitTitle}</h3>
                <ul className="space-y-3">
                  {uc.benefits.map((b) => (
                    <li key={b} className="flex items-start gap-3">
                      <div className="mt-1 h-5 w-5 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 flex-shrink-0">
                        <CheckCircle className="h-3 w-3" />
                      </div>
                      <span className="text-sm text-zinc-300 font-medium leading-relaxed">{b}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Action Pitch */}
              <div className="pt-10 flex flex-col sm:flex-row gap-4">
                <Link
                  href="/#quiz"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30 transition-all hover:-translate-y-0.5"
                >
                  Schedule A Customized Social Plan
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/#pricing"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl text-sm font-bold text-zinc-300 border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 transition-all hover:-translate-y-0.5"
                >
                  View Corporate Pricing
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
