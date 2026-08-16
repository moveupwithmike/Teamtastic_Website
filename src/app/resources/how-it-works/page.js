import Link from "next/link";
import { ArrowRight, Laptop, Users, Award, CheckCircle, Video, Star, Smile } from "lucide-react";

export const metadata = {
  alternates: {
    canonical: "https://teamtastic.events/resources/how-it-works",
  },
  title: "How It Works — Plan & Host Your Virtual Event in 10 Mins | Teamtastic",
  description:
    "A step-by-step visual guide to booking, briefing, and going live with Teamtastic. Learn how to launch virtual team lobbies, invite players, and run hosted or self-service games.",
  openGraph: {
    title: "How It Works — Teamtastic Event Guide",
    description: "Launch your virtual event in under 10 minutes. Step-by-step visual onboarding guide.",
    url: "https://teamtastic.events/resources/how-it-works",
  },
};

const steps = [
  {
    num: "01",
    title: "Choose Your Format & Vibe",
    icon: Laptop,
    desc: "Browse our dynamic arcade library of 50+ virtual games. Choose between self-hosted play or booking a professional VIP Master Emcee to run the entire session.",
    details: [
      "Filter games by energy: Chill Bingo to High-Energy buzzer trivia.",
      "Custom Question Packs: easily upload your own company trivia.",
      "Custom Branding: inject your organization's logo and primary colors."
    ],
    color: "from-purple-500/20 to-pink-500/20 border-purple-500/30",
    iconColor: "text-purple-400",
  },
  {
    num: "02",
    title: "Launch & Invite in One Click",
    icon: Users,
    desc: "Open your active game lobby on teamtastic.games in under 60 seconds. Simply copy the secure room link and paste it directly into your video call chat.",
    details: [
      "Zero player accounts: players enter their names and join instantly.",
      "No downloads: runs entirely in mobile or desktop web browsers.",
      "Frictionless joining: QR code support for instant mobile gamepads."
    ],
    color: "from-sky-500/20 to-indigo-500/20 border-sky-500/30",
    iconColor: "text-sky-400",
  },
  {
    num: "03",
    title: "Play, Laugh, & Celebrate",
    icon: Award,
    desc: "Run live buzzers, creative drawing rounds, and team-vs-team cooperative game shows. The system handles all timers, score counting, and visual podiums automatically.",
    details: [
      "Dynamic Leaderboards: real-time point tracking after every round.",
      "Confetti & Medals: high-energy visual celebrations for the winners.",
      "Post-Game Recap: download team photos, answers, and scoreboard stats."
    ],
    color: "from-emerald-500/20 to-teal-500/20 border-emerald-500/30",
    iconColor: "text-emerald-400",
  },
];

export default function HowItWorks() {
  return (
    <main className="flex flex-col min-h-screen bg-brand-dark">
      {/* Hero */}
      <section className="relative pt-24 pb-16 overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-900/20 via-zinc-950 to-zinc-950" />
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-4 py-1.5 text-xs font-semibold text-purple-300">
            <CheckCircle className="h-3.5 w-3.5" />
            Quick Setup Guide
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
            How Teamtastic Works
          </h1>
          <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
            From picking your games to crowning your company champions, here is exactly how we transform boring corporate meetings into high-energy game shows in three simple steps.
          </p>
        </div>
      </section>

      {/* Process Steps */}
      <section className="py-12 pb-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="space-y-16">
            {steps.map(({ num, title, icon: Icon, desc, details, color, iconColor }) => (
              <div
                key={title}
                className="relative flex flex-col lg:flex-row gap-8 lg:gap-12 items-center"
              >
                {/* Step Visual Block */}
                <div className={`w-full lg:w-2/5 aspect-[4/3] rounded-2xl border bg-gradient-to-br ${color} flex flex-col justify-between p-8 relative overflow-hidden shrink-0`}>
                  <div className="absolute -right-8 -top-8 text-9xl font-black text-white/5 select-none font-sans">
                    {num}
                  </div>
                  <div className="flex items-center justify-between">
                    <Icon className={`h-10 w-10 ${iconColor}`} />
                    <span className="text-sm font-extrabold text-white/50 tracking-widest uppercase">
                      Step {num}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-white/40 tracking-wider uppercase">Teamtastic Arcade</div>
                    <div className="text-2xl font-bold text-white leading-tight">{title}</div>
                  </div>
                </div>

                {/* Step Copy Block */}
                <div className="w-full lg:w-3/5 space-y-6">
                  <div className="inline-block text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
                    {num}
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                    {title}
                  </h2>
                  <p className="text-base text-zinc-400 leading-relaxed">
                    {desc}
                  </p>
                  <ul className="space-y-3">
                    {details.map((detail, dIdx) => (
                      <li key={dIdx} className="flex items-center gap-3 text-zinc-300 text-sm">
                        <CheckCircle className={`h-4.5 w-4.5 ${iconColor} shrink-0`} />
                        <span>{detail}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Checklist Grid */}
      <section className="py-20 bg-zinc-950/40 border-y border-white/5">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl font-extrabold text-white">Built for Zero-Stress Hosting</h2>
            <p className="text-zinc-400 text-sm max-w-lg mx-auto">
              Our web-first architecture completely removes the IT security reviews and installation barriers of traditional corporate apps.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glassmorphism rounded-2xl p-6 border border-white/5 space-y-3">
              <Video className="h-6 w-6 text-purple-400" />
              <h3 className="font-bold text-white">Conferencing Agnostic</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Runs seamlessly alongside Zoom, MS Teams, Webex, Google Meet, or Slack. If you can share a link, you can play Teamtastic.
              </p>
            </div>
            <div className="glassmorphism rounded-2xl p-6 border border-white/5 space-y-3">
              <Star className="h-6 w-6 text-sky-400" />
              <h3 className="font-bold text-white">Professional Hosting</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Book a VIP hosted event to get a professional comedic emcee who manages all screen sharing, game lobby pacing, and room energy.
              </p>
            </div>
            <div className="glassmorphism rounded-2xl p-6 border border-white/5 space-y-3">
              <Smile className="h-6 w-6 text-emerald-400" />
              <h3 className="font-bold text-white">Audience Scaling</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                From a small virtual huddle of 5 people to a major corporate kick-off of 500+ attendees. The system scales instantly with zero lag.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24">
        <div className="mx-auto max-w-2xl px-4 text-center space-y-6">
          <h2 className="text-3xl font-extrabold text-white">Ready to Boost Your Team Connectedness?</h2>
          <p className="text-zinc-400">
            Launch a free, zero-commitment lobby for up to 10 players in under 60 seconds, or book a fully hosted VIP event.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link
              href="/#quiz"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-base font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-[0_0_25px_rgba(139,92,246,0.4)] transition-all duration-300 hover:-translate-y-1"
            >
              Start the Event Quiz <ArrowRight className="h-5 w-5" />
            </Link>
            <a
              href="https://teamtastic.games"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-base font-bold text-zinc-300 hover:text-white border border-white/10 hover:border-white/20 hover:bg-white/5 transition-all duration-300 hover:-translate-y-1"
            >
              Launch a Free Lobby
            </a>
          </div>
        </div>
      </section>

      {/* JSON-LD HowTo Schema for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "HowTo",
            "name": "How to Host a Virtual Team Building Event with Teamtastic",
            "description": "A step-by-step visual guide to choosing games, inviting participants, and playing browser-based team games with Teamtastic.",
            "step": [
              {
                "@type": "HowToStep",
                "position": 1,
                "name": "Choose Your Format & Vibe",
                "text": "Browse the dynamic arcade library of 50+ virtual games. Choose between self-hosted play or booking a professional VIP Master Emcee."
              },
              {
                "@type": "HowToStep",
                "position": 2,
                "name": "Launch & Invite in One Click",
                "text": "Open your active game lobby on teamtastic.games, copy the room link, and paste it into Zoom, MS Teams, or Meet chat. Players join instantly in the browser."
              },
              {
                "@type": "HowToStep",
                "position": 3,
                "name": "Play, Laugh, & Celebrate",
                "text": "Run interactive rounds, submit drawings/votes, and check real-time scoreboards. Confetti and automated medals celebrate the winners."
              }
            ],
            "totalTime": "PT10M"
          }),
        }}
      />
    </main>
  );
}
