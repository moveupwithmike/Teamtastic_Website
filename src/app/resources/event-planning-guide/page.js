"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight, CheckSquare, Square, RotateCcw, Calendar, FileText, ChevronRight, Share2, Clipboard } from "lucide-react";

// Note: Next.js metadata needs to be exported from a separate layout file or we can define it inside the page body for dynamic clientside. Since Next.js v13+ allows metadata only in Server Components, we will structure this as a client component but keep clean HTML headers in document where possible or structure it cleanly. Next.js supports adding metadata in app/resources/event-planning-guide/layout.js, let's also create a layout.js file there later to handle static metadata, ensuring the client component compiles perfectly!

const initialPhases = [
  {
    id: "strategy",
    title: "1. Pre-Event Strategy (2-4 Weeks Out)",
    color: "border-purple-500/30 bg-purple-500/5",
    accent: "text-purple-400",
    tasks: [
      { id: "s1", text: "Define the primary event goal (e.g. quarterly celebration, onboarding, seasonal theme)." },
      { id: "s2", text: "Poll the team for date options & optimal time slot (avoid late Friday afternoons)." },
      { id: "s3", text: "Confirm final headcount and plan your budget range." },
      { id: "s4", text: "Decide on facilitation: Self-Service (you host) vs. booking a live VIP Professional Emcee." },
      { id: "s5", text: "Send initial 'Save the Date' calendar invites with high-energy placeholder copy." }
    ]
  },
  {
    id: "setup",
    title: "2. Game Setup & Customization (1 Week Out)",
    color: "border-sky-500/30 bg-sky-500/5",
    accent: "text-sky-400",
    tasks: [
      { id: "c1", text: "Select games from the Teamtastic library matching your team's energy (Chill vs. High Energy)." },
      { id: "c2", text: "Create custom questions: write 5-10 fun trivia questions about your company, history, or team members." },
      { id: "c3", text: "Log in to teamtastic.games to upload your brand logo and select custom dashboard background themes." },
      { id: "c4", text: "Send the final video call invite (Zoom, Teams, or Meet) including link guidelines for players." }
    ]
  },
  {
    id: "eventday",
    title: "3. The Event Day Checklist (Day of Event)",
    color: "border-emerald-500/30 bg-emerald-500/5",
    accent: "text-emerald-400",
    tasks: [
      { id: "d1", text: "Join the video call room 5 minutes early to double-check camera, mic, and screen-sharing permissions." },
      { id: "d2", text: "Open the Teamtastic Host Dashboard on teamtastic.games in a separate tab." },
      { id: "d3", text: "Paste the player invite link in your meeting chat as soon as attendees join." },
      { id: "d4", text: "Start with a fast 3-minute warm-up game (e.g. Icebreaker poll) while people arrive." },
      { id: "d5", text: "Keep your webcam ON, set a friendly tone, and let the arcade handle all scoring and visual confetti." }
    ]
  },
  {
    id: "postevent",
    title: "4. Post-Event Engagement (Day After)",
    color: "border-amber-500/30 bg-amber-500/5",
    accent: "text-amber-400",
    tasks: [
      { id: "p1", text: "Log in to download your custom team photo, scoreboard ranks, and creative submissions." },
      { id: "p2", text: "Send a follow-up 'Thank You' email to the team, attaching the final podium and funny drawings." },
      { id: "p3", text: "Capture feedback from the team to align on the vibe for your next team social." }
    ]
  }
];

export default function EventPlanningGuide() {
  const [checkedTasks, setCheckedTasks] = useState({});
  const [copied, setCopied] = useState(false);

  // Load checklist state from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("teamtastic_planning_checklist");
    if (saved) {
      try {
        setCheckedTasks(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse checklist state", e);
      }
    }
  }, []);

  // Save checklist state to localStorage when it changes
  const toggleTask = (id) => {
    setCheckedTasks((prev) => {
      const updated = { ...prev, [id]: !prev[id] };
      localStorage.setItem("teamtastic_planning_checklist", JSON.stringify(updated));
      return updated;
    });
  };

  // Reset checklist
  const resetChecklist = () => {
    if (confirm("Are you sure you want to clear all checked items in your planner?")) {
      setCheckedTasks({});
      localStorage.removeItem("teamtastic_planning_checklist");
    }
  };

  // Copy shareable check info
  const copyChecklistSummary = () => {
    const totalTasks = initialPhases.flatMap(p => p.tasks).length;
    const completedTasks = Object.values(checkedTasks).filter(Boolean).length;
    const text = `Teamtastic Event Planning Progress: ${completedTasks}/${totalTasks} tasks completed! Plan your perfect virtual event at https://teamtastic.events/resources/event-planning-guide`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Calculate progress stats
  const totalTasks = initialPhases.flatMap(p => p.tasks).length;
  const completedTasks = Object.values(checkedTasks).filter(Boolean).length;
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <main className="flex flex-col min-h-screen bg-brand-dark">
      {/* Hero */}
      <section className="relative pt-24 pb-16 overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-sky-900/20 via-zinc-950 to-zinc-950" />
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-4 py-1.5 text-xs font-semibold text-sky-300">
            <Clipboard className="h-3.5 w-3.5" />
            Interactive Organizer Checklist
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Virtual Event Planning Guide
          </h1>
          <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
            Use this interactive B2B planner to coordinate schedules, align tech, choose games, and run a high-energy corporate gathering with zero stress. Your progress is saved automatically!
          </p>
        </div>
      </section>

      {/* Progress Dashboard */}
      <section className="py-6">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="glassmorphism rounded-2xl border border-white/10 p-6 flex flex-col md:flex-row items-center justify-between gap-6 bg-zinc-950/40">
            <div className="space-y-1 text-center md:text-left w-full md:w-auto">
              <div className="text-xs font-bold text-sky-400 uppercase tracking-widest">Planner Progress</div>
              <div className="text-2xl font-black text-white">{progressPercent}% Completed</div>
              <div className="text-sm text-zinc-400">{completedTasks} of {totalTasks} checklist items completed</div>
            </div>
            
            {/* Progress Bar */}
            <div className="w-full md:w-1/3 bg-zinc-900 h-3.5 rounded-full overflow-hidden border border-white/5 shrink-0">
              <div 
                className="bg-gradient-to-r from-purple-500 via-sky-500 to-emerald-500 h-full rounded-full transition-all duration-500" 
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 w-full md:w-auto justify-center md:justify-end">
              <button
                onClick={copyChecklistSummary}
                className="p-3 rounded-xl border border-white/10 hover:border-white/20 bg-white/5 text-zinc-300 hover:text-white transition-all text-xs font-semibold flex items-center gap-2"
                title="Copy shareable checklist summary"
              >
                <Share2 className="h-4 w-4" />
                {copied ? "Copied!" : "Share Progress"}
              </button>
              <button
                onClick={resetChecklist}
                className="p-3 rounded-xl border border-rose-500/20 hover:border-rose-500/40 bg-rose-500/5 text-rose-400 hover:text-rose-300 transition-all text-xs font-semibold flex items-center gap-2"
                title="Reset checklist items"
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive List Sections */}
      <section className="py-10 pb-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 space-y-8">
          {initialPhases.map((phase) => (
            <div
              key={phase.id}
              className={`rounded-2xl border p-6 md:p-8 space-y-6 transition-all duration-300 ${phase.color}`}
            >
              <div className="flex items-center gap-3">
                <FileText className={`h-6 w-6 ${phase.accent}`} />
                <h2 className="text-xl font-bold text-white leading-tight">
                  {phase.title}
                </h2>
              </div>

              <div className="divide-y divide-white/5">
                {phase.tasks.map((task) => {
                  const isChecked = !!checkedTasks[task.id];
                  return (
                    <div
                      key={task.id}
                      onClick={() => toggleTask(task.id)}
                      className="flex items-start gap-4 py-4.5 first:pt-0 last:pb-0 cursor-pointer select-none group"
                    >
                      <div className="shrink-0 mt-0.5 transition-transform group-hover:scale-105">
                        {isChecked ? (
                          <CheckSquare className={`h-5.5 w-5.5 ${phase.accent}`} />
                        ) : (
                          <Square className="h-5.5 w-5.5 text-zinc-500 group-hover:text-zinc-400" />
                        )}
                      </div>
                      <span className={`text-sm md:text-base leading-relaxed transition-all ${isChecked ? "text-zinc-500 line-through" : "text-zinc-300 group-hover:text-white"}`}>
                        {task.text}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Resource Footer Guides */}
      <section className="py-16 bg-zinc-950/40 border-y border-white/5">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <h2 className="text-2xl font-extrabold text-white">Need Customized Support for Your Event?</h2>
          <p className="text-zinc-400 text-sm max-w-md mx-auto leading-relaxed">
            Our expert culture strategists will help you custom-tailor questions, brand your game boards, and ensure your hosted event runs perfectly.
          </p>
          <div className="flex flex-wrap justify-center gap-4 pt-2">
            <Link
              href="/resources/faq"
              className="inline-flex items-center gap-2 text-xs font-semibold text-purple-400 hover:text-purple-300 transition-all"
            >
              Explore FAQ <ChevronRight className="h-4 w-4" />
            </Link>
            <span className="text-zinc-600">|</span>
            <Link
              href="/resources/how-it-works"
              className="inline-flex items-center gap-2 text-xs font-semibold text-sky-400 hover:text-sky-300 transition-all"
            >
              How It Works Guide <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Sticky Quiz CTA */}
      <section className="py-20">
        <div className="mx-auto max-w-2xl px-4 text-center space-y-6">
          <h2 className="text-3xl font-extrabold text-white">Unlock Your Custom Recommendations</h2>
          <p className="text-zinc-400">
            Tell us about your team size, culture preferences, and event date to get a personalized game bundle quote.
          </p>
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
