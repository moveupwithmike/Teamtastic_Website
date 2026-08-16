import Link from "next/link";
import { ArrowRight, CheckCircle, Users, Zap, Award, ChevronDown } from "lucide-react";
import CorporateLeadForm from "@/components/CorporateLeadForm";

export const metadata = {
  alternates: {
    canonical: "https://teamtastic.events/virtual-team-building",
  },
  title: "Virtual Team Building Activities & Games for Remote Teams | Teamtastic",
  description:
    "Discover the best virtual team building activities for remote and hybrid teams. Live-hosted game shows, trivia, escape rooms & more for groups of 5–500+. Free to try.",
  openGraph: {
    title: "Virtual Team Building Activities & Games | Teamtastic",
    description:
      "Transform Zoom meetings into electric team events. Live emcee-hosted game shows, custom trivia, and interactive team tournaments for remote and hybrid teams.",
    url: "https://teamtastic.events/virtual-team-building",
  },
};

const activityTypes = [
  {
    title: "Live Game Shows",
    desc: "Our Master Emcee hosts high-energy corporate game shows with real-time scoring, buzz-in rounds, and custom question packs tailored to your team.",
    icon: "🎬",
    color: "border-purple-500/30 bg-purple-500/5",
  },
  {
    title: "Custom Trivia",
    desc: "Lightning-fast trivia battles covering company culture, industry knowledge, pop culture, and themed rounds (Black History Month, Pride, Earth Day).",
    icon: "🧠",
    color: "border-pink-500/30 bg-pink-500/5",
  },
  {
    title: "Meme Battles",
    desc: "Teams caption images with the funniest corporate-appropriate text. The group votes in real-time. Creativity, banter, and big laughs guaranteed.",
    icon: "😂",
    color: "border-amber-500/30 bg-amber-500/5",
  },
  {
    title: "Escape Rooms",
    desc: "Collaborative digital escape chambers requiring teams to solve puzzles together under time pressure. Perfect for cross-functional bonding.",
    icon: "🔐",
    color: "border-emerald-500/30 bg-emerald-500/5",
  },
  {
    title: "Music Rounds",
    desc: "Guess songs from clips, identify jingles, and complete lyrics. Audio trivia that lights up even the quietest team members.",
    icon: "🎵",
    color: "border-sky-500/30 bg-sky-500/5",
  },
  {
    title: "Survey Showdown",
    desc: "Family-Feud-style battles where teams compete to guess the most popular answers to hilarious workplace survey questions.",
    icon: "📊",
    color: "border-orange-500/30 bg-orange-500/5",
  },
];

const ideas = [
  { title: "Virtual Trivia Night", desc: "Weekly or monthly team trivia covering pop culture, company history, and custom topics." },
  { title: "Corporate Meme Championship", desc: "Let your team's humor shine with caption contests and voting rounds." },
  { title: "Escape Room Challenge", desc: "Collaborative puzzle-solving that demands communication and creative thinking." },
  { title: "Music & Sound Bite Trivia", desc: "Audio rounds that identify songs, jingles, and movie quotes." },
  { title: "Survey Showdown (Family Feud Style)", desc: "Fast-paced buzz-in battles based on popular survey responses." },
  { title: "Team Scavenger Hunt", desc: "Home-based physical challenges with point scoring and photo proof." },
  { title: "Virtual Cooking Class", desc: "Collaborative culinary sessions with a live chef instructor." },
  { title: "Drawing & Pictionary Games", desc: "Real-time collaborative drawing canvases with team guessing." },
  { title: "Live Game Show with Emcee", desc: "The Teamtastic signature — a fully produced show run by a professional host." },
  { title: "Virtual Bingo", desc: "Corporate bingo with custom cards themed to your industry or company culture." },
];

const faqs = [
  {
    q: "What is virtual team building?",
    a: "Virtual team building refers to structured online activities designed to strengthen relationships, improve communication, and boost morale among remote or hybrid team members. It replaces in-person social events with engaging digital experiences.",
  },
  {
    q: "How many people can participate?",
    a: "Teamtastic supports groups from as small as 5 people all the way up to 500+ active participants. Our platform scales dynamically with your team size.",
  },
  {
    q: "Do participants need to download anything?",
    a: "No. All Teamtastic games run entirely in the browser. Players join with a simple link — no app downloads, no account creation required for participants.",
  },
  {
    q: "What platforms does Teamtastic work with?",
    a: "Teamtastic runs alongside any video conferencing tool you already use — Zoom, Microsoft Teams, Google Meet, Webex, or any browser-based conferencing solution.",
  },
  {
    q: "How long does a typical virtual team building event last?",
    a: "Most sessions run between 30–60 minutes. We offer shorter 20-minute warm-up games as well as extended 90-minute themed event packages.",
  },
  {
    q: "Can we customize the games for our company?",
    a: "Absolutely. You can inject custom question packs, upload your company logo, apply brand colors, and build themed rounds around your industry, values, or seasonal events.",
  },
  {
    q: "Is there a live host/emcee option?",
    a: "Yes — our VIP Hosted Event tier features our founder personally as your dedicated Master Emcee. He facilitates the entire event live, handles the energy, reads the room, and guarantees an electric experience.",
  },
  {
    q: "How do I get started?",
    a: "You can launch a free lobby instantly at teamtastic.games, or take our 4-step Event Quiz to get a custom recommendation and quote tailored to your team.",
  },
];

export default function VirtualTeamBuilding() {
  return (
    <main className="flex flex-col min-h-screen bg-brand-dark">
      {/* Hero */}
      <section className="relative pt-24 pb-20 overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-900/30 via-zinc-950 to-zinc-950" />
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold text-emerald-300">
            <Users className="h-3 w-3" />
            For Remote & Hybrid Teams of 5–500+
          </div>
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight">
            Virtual Team Building Activities{" "}
            <span className="text-brand-purple">Your Team Will Actually Love</span>
          </h1>
          <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
            Stop hosting forgettable Zoom calls. Transform your remote team events into electric, live game shows that build real connections — powered by a professional emcee and browser-based games with zero downloads.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Link
              href="#get-quote"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-base font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-[0_0_25px_rgba(139,92,246,0.4)] hover:shadow-[0_0_35px_rgba(236,72,153,0.5)] transition-all duration-300 hover:-translate-y-1"
            >
              Get Availability &amp; Pricing
              <ArrowRight className="h-5 w-5" />
            </Link>
            <a
              href="https://teamtastic.games"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-base font-bold text-zinc-200 border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 hover:text-white transition-all duration-300 hover:-translate-y-1"
            >
              Try a Free Game Now
            </a>
          </div>
        </div>
      </section>

      {/* Why It Matters */}
      <section className="py-16 bg-zinc-950/60 border-y border-white/5">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { stat: "76%", label: "of remote workers feel isolated at least sometimes", color: "text-purple-400" },
              { stat: "$550B", label: "lost annually due to employee disengagement in the US", color: "text-pink-400" },
              { stat: "3×", label: "higher engagement scores after interactive team events", color: "text-amber-400" },
              { stat: "92%", label: "of HR leads say team building improves morale", color: "text-emerald-400" },
            ].map(({ stat, label, color }) => (
              <div key={stat} className="space-y-2">
                <span className={`text-4xl font-extrabold ${color}`}>{stat}</span>
                <p className="text-xs text-zinc-500 leading-relaxed">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Inline lead capture */}
      <section id="get-quote" className="py-16 md:py-24 bg-zinc-950/60 border-b border-white/5">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div className="space-y-5">
            <span className="text-xs font-black uppercase tracking-[0.2em] text-brand-pink">Hosted events</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white">Get availability and pricing for your team</h2>
            <p className="text-zinc-400 leading-relaxed">
              Tell us your team size and occasion. Michael will reply within one business day with open dates and the game show format that fits your group best.
            </p>
            <ul className="space-y-3">
              {[
                "Live Master Emcee runs the whole event",
                "Custom trivia about your company included",
                "Works inside Zoom, Teams, Meet, or Webex",
                "$35 per person · $350 minimum · $200 reserves your date",
              ].map((f) => (
                <li key={f} className="flex items-center gap-3 text-sm text-zinc-300">
                  <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
          <CorporateLeadForm
            source="virtual_team_building_money_page"
            entryPoint="virtual_team_building_inline"
            eyebrow="Fast event check"
            title="Check dates for your team event"
            successTitle="Your event brief is saved."
            submitLabel="Check availability"
          />
        </div>
      </section>

      {/* Activity Types */}
      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white">Virtual Team Building Activities</h2>
            <p className="text-zinc-400 max-w-xl mx-auto">Six formats built to energize every kind of team — from engineering squads to HR cohorts to VIP corporate events.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activityTypes.map((a) => (
              <div key={a.title} className={`glassmorphism rounded-2xl p-6 border hover:-translate-y-1 transition-all duration-300 ${a.color}`}>
                <div className="text-3xl mb-4">{a.icon}</div>
                <h3 className="text-lg font-bold text-white mb-2">{a.title}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{a.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Top 10 Ideas */}
      <section className="py-20 bg-zinc-950/40 border-y border-white/5">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-4 mb-12">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
              Top 10 Virtual Team Building Ideas for 2025
            </h2>
            <p className="text-zinc-400">Activities your team will actually look forward to — not just endure.</p>
          </div>
          <div className="space-y-4">
            {ideas.map((idea, i) => (
              <div key={idea.title} className="glassmorphism rounded-2xl p-5 flex gap-5 items-start border border-white/5 hover:border-purple-500/20 transition-colors">
                <span className="text-2xl font-extrabold text-purple-500/40 shrink-0 w-8">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <h3 className="font-bold text-white mb-1">{idea.title}</h3>
                  <p className="text-sm text-zinc-400">{idea.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The Teamtastic Difference */}
      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white">Self-Service vs. Live Hosted Events</h2>
            <p className="text-zinc-400 max-w-lg mx-auto">Choose the experience level that fits your team&apos;s needs and budget.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="glassmorphism rounded-2xl p-8 border border-white/5">
              <div className="flex items-center gap-3 mb-6">
                <Zap className="h-6 w-6 text-purple-400" />
                <h3 className="text-xl font-bold text-white">Self-Service Arcade</h3>
              </div>
              <ul className="space-y-3">
                {["Launch in under 60 seconds", "No emcee required — you host", "Instant free lobby", "Great for small weekly standups", "10–50 players per session"].map((f) => (
                  <li key={f} className="flex items-center gap-3 text-sm text-zinc-300">
                    <CheckCircle className="h-4 w-4 text-purple-400 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href="https://teamtastic.games"
                className="mt-8 w-full flex h-11 items-center justify-center rounded-xl text-sm font-bold text-white border border-white/10 bg-white/5 hover:bg-white/10 transition-colors"
              >
                Try Free Now
              </a>
            </div>
            <div className="glassmorphism rounded-2xl p-8 border border-purple-500/30 bg-purple-500/5">
              <div className="flex items-center gap-3 mb-6">
                <Award className="h-6 w-6 text-amber-400" />
                <h3 className="text-xl font-bold text-white">VIP Live Hosted Event</h3>
              </div>
              <ul className="space-y-3">
                {["Professional Master Emcee runs everything", "50–500+ players handled seamlessly", "Custom question packs & branding", "Pre-event consultation included", "Guaranteed high-energy experience"].map((f) => (
                  <li key={f} className="flex items-center gap-3 text-sm text-zinc-300">
                    <CheckCircle className="h-4 w-4 text-amber-400 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="#get-quote"
                className="mt-8 w-full flex h-11 items-center justify-center rounded-xl text-sm font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 transition-all shadow-lg shadow-purple-500/20"
              >
                Request a Quote
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ with Schema */}
      <section className="py-20 bg-zinc-950/40 border-y border-white/5">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-4 mb-12">
            <h2 className="text-3xl font-extrabold text-white">Frequently Asked Questions</h2>
          </div>
          <div className="space-y-4">
            {faqs.map((faq) => (
              <div key={faq.q} className="glassmorphism rounded-2xl p-6 border border-white/5">
                <div className="flex items-start gap-3">
                  <ChevronDown className="h-5 w-5 text-purple-400 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-bold text-white mb-2">{faq.q}</h3>
                    <p className="text-sm text-zinc-400 leading-relaxed">{faq.a}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
            Ready to Transform Your Next Team Event?
          </h2>
          <p className="text-zinc-400">
            Take our 4-step event quiz and get a custom game recommendation in under 2 minutes. No commitment, no credit card.
          </p>
          <Link
            href="/#quiz"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-base font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-[0_0_25px_rgba(139,92,246,0.4)] transition-all duration-300 hover:-translate-y-1"
          >
            Get Your Event Recommendation
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>

      {/* FAQ JSON-LD Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faqs.map((faq) => ({
              "@type": "Question",
              name: faq.q,
              acceptedAnswer: { "@type": "Answer", text: faq.a },
            })),
          }),
        }}
      />
    </main>
  );
}
