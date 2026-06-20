"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowRight, ArrowLeft, Check, Sparkles, MessageSquare, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function TalkToMichaelModal({ isOpen, onClose, isFamily = false }) {
  const [step, setStep] = useState(1);
  const [answers, setAnswers] = useState({
    eventType: "",
    groupSize: "",
    vibe: "",
    preferences: "",
    name: "",
    email: "",
    company: "",
    phone: "",
    eventDate: "",
  });

  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");

  const handleSelect = (field, value) => {
    setAnswers((prev) => ({ ...prev, [field]: value }));
    setStep((prev) => prev + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep((prev) => prev - 1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!answers.name || !answers.email || !answers.company) return;

    setLoading(true);

    const states = [
      "Analyzing your team dynamics...",
      "Matching vibes with emcee schedules...",
      "Drafting custom package recommendations...",
    ];

    for (let i = 0; i < states.length; i++) {
      setLoadingMessage(states[i]);
      await new Promise((resolve) => setTimeout(resolve, 600));
    }

    try {
      // Concatenate conversational responses for the leads DB message column
      const messageDetail = `
Event Type: ${answers.eventType}
Group Size: ${answers.groupSize}
Desired Vibe: ${answers.vibe}
Preferences: ${answers.preferences}
Preferred Date: ${answers.eventDate || "Not specified"}
Phone: ${answers.phone || "Not specified"}
      `.trim();

      // Sync lead directly to Supabase DB leads table
      const { error } = await supabase.from("leads").insert([
        {
          name: answers.name,
          email: answers.email,
          company: answers.company,
          team_size: answers.groupSize,
          vibe: answers.vibe,
          occasion: answers.eventType,
          message: messageDetail,
          lead_source: isFamily ? "Ask Michael's Family Event Concierge" : "Ask Michael's Event Concierge",
          status: "New",
          created_at: new Date().toISOString(),
        },
      ]);

      if (error) {
        console.warn("Supabase lead integration warning:", error.message);
      }
    } catch (err) {
      console.error("Supabase connect failed locally, using mock response:", err);
    }

    setLoading(false);
    setStep(6);
  };

  const handleReset = () => {
    setAnswers({
      eventType: "",
      groupSize: "",
      vibe: "",
      preferences: "",
      name: "",
      email: "",
      company: "",
      phone: "",
      eventDate: "",
    });
    setStep(1);
    onClose();
  };

  const getRecommendations = () => {
    const recs = [];
    const pref = answers.preferences.toLowerCase();
    const vibe = answers.vibe.toLowerCase();

    if (isFamily) {
      if (pref.includes("trivia") || vibe.includes("competition")) {
        recs.push({
          title: "Family Trivia Showdown",
          desc: "Fun, fast-paced trivia custom-written about your family stories, memories, and photos.",
          badge: "Most Popular"
        });
        recs.push({
          title: "Generations Battle",
          desc: "Kids vs. adults in a high-energy showdown of trivia, memory cues, and pop culture.",
          badge: "High Energy"
        });
      } else if (pref.includes("bingo") || vibe.includes("casual")) {
        recs.push({
          title: "Virtual Family Bingo",
          desc: "Classic family bingo with interactive twists, live boards, and silly callouts.",
          badge: "Fun & Social"
        });
        recs.push({
          title: "Music & Memories",
          desc: "Name that tune, audio decades, and music Bingo cards for all generations.",
          badge: "Cooperative"
        });
      } else {
        recs.push({
          title: "Family Trivia Showdown",
          desc: "Our most popular live-hosted family game show with personalized family trivia.",
          badge: "Most Popular"
        });
        recs.push({
          title: "Generations Battle",
          desc: "A fun-filled clash between the kids and the adults to see who reigns supreme.",
          badge: "High Energy"
        });
        recs.push({
          title: "Custom Game Night",
          desc: "We construct custom challenges, puzzles, and quizzes completely tailored to your family.",
          badge: "100% Tailored"
        });
      }
      return recs.slice(0, 3);
    }

    if (pref.includes("trivia") || vibe.includes("competition")) {
      recs.push({
        title: "Signature Trivia Jam",
        desc: "A high-octane buzzer trivia showdown custom-themed for your brand and culture.",
        badge: "Most Popular"
      });
      recs.push({
        title: "Game Show Challenge",
        desc: "Classic TV-style game shows with live scoreboards, buzzers, and friendly banter.",
        badge: "High Energy"
      });
    } else if (pref.includes("escape") || vibe.includes("solving")) {
      recs.push({
        title: "Escape Room Adventures",
        desc: "Cooperative team-based logic puzzles, secret codes, and escape rooms.",
        badge: "Cooperative"
      });
      recs.push({
        title: "Mystery Mosaic",
        desc: "Solve collaborative clues to unlock puzzle tiles and unveil your custom team photo.",
        badge: "Collaboration"
      });
    } else if (pref.includes("bingo") || pref.includes("music")) {
      recs.push({
        title: "Music Bingo Mania",
        desc: "High-energy sound riffs, song clips, custom boards, and dancing in your seats.",
        badge: "Fun & Social"
      });
      recs.push({
        title: "Sound Bite Trivia",
        desc: "Guess movie clips, audio memes, and retro sounds in a fast-paced audio quiz.",
        badge: "Music & Audio"
      });
    } else {
      recs.push({
        title: "Signature Trivia Jam",
        desc: "Our most popular corporate team-building experience featuring custom company trivia.",
        badge: "Most Popular"
      });
      recs.push({
        title: "Game Show Challenge",
        desc: "Tv-style mini games, buzzer battle, and interactive team-vs-team modes.",
        badge: "High Energy"
      });
      recs.push({
        title: "Custom Celebration",
        desc: "A hand-crafted mixture of drawing canvases, trivia, and team awards.",
        badge: "100% Tailored"
      });
    }

    return recs.slice(0, 3);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop Blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/85 backdrop-blur-sm"
          />

          {/* Modal Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: "spring", duration: 0.4 }}
            className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-white/10 bg-zinc-950 shadow-2xl z-10 flex flex-col max-h-[90vh] md:max-h-none"
          >
            {/* Top color strip */}
            <div className="h-1.5 bg-gradient-to-r from-brand-purple via-brand-pink to-amber-400 w-full shrink-0" />

            {/* Back Button (if not on first step or results step) */}
            {step > 1 && step < 6 && !loading && (
              <button
                onClick={handleBack}
                className="absolute top-4 left-4 p-2 rounded-full text-zinc-400 hover:text-white hover:bg-white/5 transition-all z-20 flex items-center gap-1 text-xs font-bold"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
            )}

            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-full text-zinc-400 hover:text-white hover:bg-white/5 transition-all z-20"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Header Concierge Status */}
            <div className="px-6 pt-6 sm:px-8 sm:pt-8 flex items-center gap-3 shrink-0">
              <div className="relative w-10 h-10 rounded-full overflow-hidden border border-brand-purple shrink-0 bg-zinc-900 flex items-center justify-center">
                <img
                  src="/emcee-engaged-transparent.png"
                  alt="Michael"
                  className="w-full h-full object-cover scale-110 object-top"
                />
              </div>
              <div className="text-left">
                <h4 className="text-xs font-black text-white flex items-center gap-1.5 uppercase tracking-wider">
                  Ask Michael&apos;s Event Concierge
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                </h4>
                <p className="text-[10px] text-zinc-400">Conversational Planner Agent</p>
              </div>
            </div>

            {/* Content Body */}
            <div className="p-6 sm:p-8 overflow-y-auto flex-1 flex flex-col justify-between">
              {loading ? (
                /* Loading State */
                <div className="py-16 flex flex-col items-center justify-center space-y-4 text-center">
                  <Loader2 className="h-10 w-10 animate-spin text-brand-pink" />
                  <p className="text-sm font-bold text-white tracking-wide animate-pulse">
                    {loadingMessage}
                  </p>
                </div>
              ) : (
                <div className="w-full">
                  {step === 1 && (
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="space-y-6 text-left"
                    >
                      <div className="space-y-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-brand-purple">Step 1 of 5</span>
                        <h3 className="text-xl sm:text-2xl font-extrabold text-white">What kind of event are you planning?</h3>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {(isFamily ? [
                          "Family reunion",
                          "Birthday party",
                          "Holiday gathering",
                          "Anniversary celebration",
                          "Graduation party",
                          "Long-distance family night",
                          "Custom family event",
                          "Not sure yet"
                        ] : [
                          "Team building",
                          "Holiday party",
                          "Employee appreciation",
                          "Onboarding",
                          "Celebration",
                          "Culture/DEI event",
                          "Not sure yet"
                        ]).map((option) => (
                          <button
                            key={option}
                            onClick={() => handleSelect("eventType", option)}
                            className="w-full p-4 text-left rounded-xl bg-white/5 border border-white/5 hover:border-brand-purple/40 hover:bg-brand-purple/10 text-sm font-semibold text-zinc-200 hover:text-white transition-all duration-200 cursor-pointer"
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {step === 2 && (
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="space-y-6 text-left"
                    >
                      <div className="space-y-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-brand-purple">Step 2 of 5</span>
                        <h3 className="text-xl sm:text-2xl font-extrabold text-white">How many people are joining?</h3>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {[
                          { label: "5 – 20 players", val: "5-20" },
                          { label: "21 – 50 players", val: "21-50" },
                          { label: "51 – 100 players", val: "51-100" },
                          { label: "100+ players", val: "100+" }
                        ].map((option) => (
                          <button
                            key={option.val}
                            onClick={() => handleSelect("groupSize", option.label)}
                            className="w-full p-5 text-center rounded-xl bg-white/5 border border-white/5 hover:border-brand-pink/40 hover:bg-brand-pink/10 text-sm font-semibold text-zinc-200 hover:text-white transition-all duration-200 cursor-pointer"
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {step === 3 && (
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="space-y-6 text-left"
                    >
                      <div className="space-y-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-brand-purple">Step 3 of 5</span>
                        <h3 className="text-xl sm:text-2xl font-extrabold text-white">What vibe do you want?</h3>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {[
                          "High-energy competition",
                          "Funny and casual",
                          "Creative and silly",
                          "Collaborative/problem-solving",
                          "Celebration/awards",
                          "Mix of everything"
                        ].map((option) => (
                          <button
                            key={option}
                            onClick={() => handleSelect("vibe", option)}
                            className="w-full p-4 text-left rounded-xl bg-white/5 border border-white/5 hover:border-brand-purple/40 hover:bg-brand-purple/10 text-sm font-semibold text-zinc-200 hover:text-white transition-all duration-200 cursor-pointer"
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {step === 4 && (
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="space-y-6 text-left"
                    >
                      <div className="space-y-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-brand-purple">Step 4 of 5</span>
                        <h3 className="text-xl sm:text-2xl font-extrabold text-white">Any activity preferences?</h3>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {[
                          "Trivia",
                          "Bingo",
                          "Escape room",
                          "Music games",
                          "Creative challenges",
                          isFamily ? "Custom family trivia & stories" : "Custom company content",
                          "Recommend for me"
                        ].map((option) => (
                          <button
                            key={option}
                            onClick={() => handleSelect("preferences", option)}
                            className="w-full p-4 text-left rounded-xl bg-white/5 border border-white/5 hover:border-brand-pink/40 hover:bg-brand-pink/10 text-sm font-semibold text-zinc-200 hover:text-white transition-all duration-200 cursor-pointer"
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {step === 5 && (
                    <motion.div
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-6 text-left"
                    >
                      <div className="space-y-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-brand-purple">Step 5 of 5</span>
                        <h3 className="text-xl sm:text-2xl font-extrabold text-white">Where should Michael send your options?</h3>
                        <p className="text-xs text-zinc-400 leading-relaxed">
                          Great! We will recommend a few custom experiences tailored to your options. Let us know who to contact.
                        </p>
                      </div>

                      <form onSubmit={handleSubmit} className="space-y-4 font-sans">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Your Name *</label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. Sarah Connor"
                              value={answers.name}
                              onChange={(e) => setAnswers({ ...answers, name: e.target.value })}
                              className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-brand-purple focus:ring-1 focus:ring-brand-purple/40 placeholder-zinc-650 font-sans transition-all"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">{isFamily ? "Email Address *" : "Work Email *"}</label>
                            <input
                              type="email"
                              required
                              placeholder={isFamily ? "e.g. sarah@gmail.com" : "e.g. sarah@techcorp.com"}
                              value={answers.email}
                              onChange={(e) => setAnswers({ ...answers, email: e.target.value })}
                              className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-brand-purple focus:ring-1 focus:ring-brand-purple/40 placeholder-zinc-650 font-sans transition-all"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">{isFamily ? "Family / Group Name *" : "Company Name *"}</label>
                            <input
                              type="text"
                              required
                              placeholder={isFamily ? "e.g. The Connor Family" : "e.g. TechCorp Inc."}
                              value={answers.company}
                              onChange={(e) => setAnswers({ ...answers, company: e.target.value })}
                              className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-brand-purple focus:ring-1 focus:ring-brand-purple/40 placeholder-zinc-650 font-sans transition-all"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Preferred Event Date</label>
                            <input
                              type="text"
                              placeholder="e.g. Oct 24th, or Q3 Social"
                              value={answers.eventDate}
                              onChange={(e) => setAnswers({ ...answers, eventDate: e.target.value })}
                              className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-brand-purple focus:ring-1 focus:ring-brand-purple/40 placeholder-zinc-650 font-sans transition-all"
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Phone Number (Optional)</label>
                          <input
                            type="tel"
                            placeholder="e.g. (555) 000-0000"
                            value={answers.phone}
                            onChange={(e) => setAnswers({ ...answers, phone: e.target.value })}
                            className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-brand-purple focus:ring-1 focus:ring-brand-purple/40 placeholder-zinc-650 font-sans transition-all"
                          />
                        </div>

                        <button
                          type="submit"
                          className="w-full flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-bold text-white bg-[#D81B60] hover:bg-pink-600 shadow-lg shadow-pink-500/20 hover:scale-[1.01] uppercase tracking-wider transition-all cursor-pointer"
                        >
                          Send My Event Details
                          <ArrowRight className="h-4 w-4" />
                        </button>
                      </form>
                    </motion.div>
                  )}

                  {step === 6 && (
                    <motion.div
                      initial={{ scale: 0.96, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="text-left space-y-6"
                    >
                      {/* Success Check */}
                      <div className="flex items-center gap-4 border-b border-white/10 pb-4">
                        <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                          <Check className="h-6 w-6" />
                        </div>
                        <div>
                          <h3 className="text-xl font-extrabold text-white">Event Brief Sent!</h3>
                          <p className="text-xs text-zinc-400">
                            Thanks! Michael will follow up with experience recommendations and next steps.
                          </p>
                        </div>
                      </div>

                      {/* Customized Recommendation Box */}
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 text-xs font-extrabold text-amber-300 uppercase tracking-wider">
                          <Sparkles className="h-4 w-4 animate-spin text-amber-400" />
                          Recommended for {answers.company}:
                        </div>

                        <div className="space-y-3">
                          {getRecommendations().map((rec, idx) => (
                            <div
                              key={idx}
                              className="p-4 rounded-2xl border border-white/5 bg-white/3 flex flex-col justify-between gap-1 hover:border-brand-purple/35 transition-colors"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <h4 className="text-sm font-extrabold text-zinc-100">{rec.title}</h4>
                                <span className="text-[8px] bg-brand-purple/20 text-purple-300 border border-brand-purple/30 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                                  {rec.badge}
                                </span>
                              </div>
                              <p className="text-[11px] text-zinc-400 leading-relaxed font-sans">
                                {rec.desc}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <button
                        onClick={handleReset}
                        className="w-full flex h-11 items-center justify-center rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold text-sm transition-all"
                      >
                        Done
                      </button>
                    </motion.div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
