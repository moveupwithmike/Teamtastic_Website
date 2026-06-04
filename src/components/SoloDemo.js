"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Gamepad2, Award, ArrowRight, CheckCircle2, RefreshCw, Star, Mail, Building, User } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { PAYMENT_CONFIG } from "@/lib/stripe";
import { toast } from "sonner";

const questions = [
  {
    text: "What percentage of remote workers report feeling lonely or isolated during the workweek?",
    options: [
      { text: "15% - Barely anyone", value: "A" },
      { text: "30% - A moderate group", value: "B" },
      { text: "50% - Exactly half", value: "C" },
      { text: "65% - The silent majority", value: "D" },
    ],
    correct: "D",
    explanation: "Correct! Over 65% of remote staff battle isolation. Teamtastic replaces dull Zoom meetings with high-energy games to build actual friendships.",
  },
  {
    text: "What is the most popular corporate team-building activity format chosen on Teamtastic?",
    options: [
      { text: "Awkward trust-fall simulations", value: "A" },
      { text: "Electric, live-host trivia shows", value: "B" },
      { text: "Static powerpoint feedback loops", value: "C" },
      { text: "Self-paced reading assignments", value: "D" },
    ],
    correct: "B",
    explanation: "Correct! Our buzz-in trivia battles and cooperative challenges generate 300% higher interaction than standard slide presentations.",
  },
  {
    text: "When a teammate triggers a 'Hype Emoji' during a live Teamtastic event, what happens?",
    options: [
      { text: "Nothing - it's muted", value: "A" },
      { text: "The system logs them out", value: "B" },
      { text: "The shared screen explodes with particle animations", value: "C" },
      { text: "The host gets a manual email", value: "D" },
    ],
    correct: "C",
    explanation: "Spot on! Real-time animations and sounds make remote players feel like they are in the exact same room, laughing together.",
  },
];

export default function SoloDemo() {
  const [gameState, setGameState] = useState("start"); // start, playing, results, lead_captured
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [score, setScore] = useState(0);
  const [isAnswered, setIsAnswered] = useState(false);

  // Lead Form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const startQuiz = () => {
    setGameState("playing");
    setCurrentIdx(0);
    setScore(0);
    setSelectedOption(null);
    setIsAnswered(false);
  };

  const selectOption = (opt) => {
    if (isAnswered) return;
    setSelectedOption(opt);
    setIsAnswered(true);

    if (opt === questions[currentIdx].correct) {
      setScore((prev) => prev + 1);
    }
  };

  const nextQuestion = () => {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx((prev) => prev + 1);
      setSelectedOption(null);
      setIsAnswered(false);
    } else {
      setGameState("results");
    }
  };

  const handleLeadSubmit = async (e) => {
    e.preventDefault();
    if (!name || !email) {
      toast.error("Please fill in both name and work email");
      return;
    }
    setSubmitting(true);

    try {
      // Save lead into shared Supabase database
      const { error } = await supabase.from("leads").insert({
        name,
        email,
        company: company || "Sandbox / Individual",
        lead_source: "website",
        vibe: "social",
        occasion: "team-building",
        team_size: "15-50",
        status: "new", // triggers welcome email trigger
      });

      if (error) throw error;

      setGameState("lead_captured");
      toast.success("Starter lobby credentials queued! Check your inbox.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to submit lead: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <CardContainer>
      <AnimatePresence mode="wait">
        {gameState === "start" && (
          <motion.div
            key="start-screen"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="space-y-6 text-center"
          >
            <div className="mx-auto w-16 h-16 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(139,92,246,0.15)]">
              <Gamepad2 className="w-8 h-8 animate-bounce" />
            </div>
            <div className="space-y-2">
              <h3 className="text-3xl font-black text-white leading-tight">
                60-Second Solo Demo
              </h3>
              <p className="text-slate-400 text-sm max-w-sm mx-auto leading-relaxed">
                Test your culture chemistry! Answer 3 quick B2B questions to experience the interaction mechanics remote managers rely on.
              </p>
            </div>
            <button
              onClick={startQuiz}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-3 px-6 rounded-2xl transition-all shadow-[0_4px_15px_rgba(139,92,246,0.3)] flex items-center justify-center gap-2"
            >
              Start Playable Teaser
              <ArrowRight className="w-5 h-5" />
            </button>
          </motion.div>
        )}

        {gameState === "playing" && (
          <motion.div
            key="playing-screen"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            {/* Progress Header */}
            <div className="flex justify-between items-center text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <span>Question {currentIdx + 1} of {questions.length}</span>
              <span className="text-purple-400 font-bold">Score: {score}</span>
            </div>

            {/* Question Text */}
            <h4 className="text-xl font-bold text-white leading-snug">
              {questions[currentIdx].text}
            </h4>

            {/* Options List */}
            <div className="space-y-2.5">
              {questions[currentIdx].options.map((opt, idx) => {
                const isSelected = selectedOption === opt.value;
                const isCorrect = opt.value === questions[currentIdx].correct;
                const showSuccess = isAnswered && isCorrect;
                const showDanger = isAnswered && isSelected && !isCorrect;

                return (
                  <button
                    key={idx}
                    onClick={() => selectOption(opt.value)}
                    disabled={isAnswered}
                    className={`w-full text-left p-3.5 rounded-xl border text-sm font-medium transition-all ${
                      showSuccess
                        ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300"
                        : showDanger
                        ? "bg-red-500/10 border-red-500/40 text-red-300"
                        : isSelected
                        ? "border-purple-500 text-white bg-purple-500/10"
                        : "border-slate-800 text-slate-300 hover:border-slate-700 bg-slate-950/40"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{opt.text}</span>
                      {showSuccess && <span className="text-emerald-400 font-bold">✓ Correct</span>}
                      {showDanger && <span className="text-red-400 font-bold">✗ Wrong</span>}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Feedback Explanation */}
            {isAnswered && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-300 text-xs leading-relaxed"
              >
                {questions[currentIdx].explanation}
                <button
                  onClick={nextQuestion}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 rounded-xl mt-3 transition-colors text-xs"
                >
                  {currentIdx < questions.length - 1 ? "Next Question" : "View Results"}
                </button>
              </motion.div>
            )}
          </motion.div>
        )}

        {gameState === "results" && (
          <motion.div
            key="results-screen"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="space-y-6 text-center"
          >
            <div className="mx-auto w-16 h-16 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-full flex items-center justify-center">
              <Award className="w-8 h-8 animate-pulse" />
            </div>
            <div className="space-y-1">
              <h3 className="text-3xl font-black text-white">Quiz Finished!</h3>
              <p className="text-purple-400 font-bold text-lg">
                You scored {score} out of {questions.length}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-purple-950/15 border border-purple-500/20 text-left space-y-4">
              <h4 className="text-white font-extrabold text-sm flex items-center gap-1.5">
                <Star className="w-4 h-4 text-purple-400" />
                Claim Your Free 15-Minute Icebreaker Lobby!
              </h4>
              <p className="text-slate-300 text-xs leading-relaxed">
                Ready to try it with your team? Claim your starter lobby. No credit card required. Credentials sent instantly.
              </p>

              <form onSubmit={handleLeadSubmit} className="space-y-3.5 pt-2">
                <div className="relative">
                  <User className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    required
                    placeholder="Your Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={submitting}
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="email"
                    required
                    placeholder="Work Email Address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={submitting}
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div className="relative">
                  <Building className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Company Name"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    disabled={submitting}
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-2.5 rounded-xl transition-all shadow-[0_4px_12px_rgba(139,92,246,0.3)] flex items-center justify-center gap-1.5 text-xs"
                >
                  {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Claim Free Starter Lobby 🎁"}
                </button>
              </form>
            </div>
          </motion.div>
        )}

        {gameState === "lead_captured" && (
          <motion.div
            key="lead-captured-screen"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="space-y-6 text-center"
          >
            <div className="mx-auto w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-black text-white">Starter Code Queued!</h3>
              <p className="text-slate-400 text-sm max-w-xs mx-auto leading-relaxed">
                Check your inbox at <strong className="text-purple-300">{email}</strong> for instructions and login credentials to host your starter event.
              </p>
            </div>

            <div className="pt-4 border-t border-slate-800 space-y-3">
              <p className="text-slate-400 text-xs font-semibold">Ready to scale it up?</p>
              <div className="grid grid-cols-2 gap-2">
                <a
                  href={PAYMENT_CONFIG.proSaaSLink}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold py-2.5 px-3 rounded-xl transition-colors flex items-center justify-center gap-1"
                >
                  Unlock SaaS Pro ($99)
                </a>
                <a
                  href={PAYMENT_CONFIG.calendlyUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-bold py-2.5 px-3 rounded-xl transition-colors flex items-center justify-center"
                >
                  Book Live VIP Demo
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </CardContainer>
  );
}

function CardContainer({ children }) {
  return (
    <div className="w-full max-w-lg mx-auto bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 lg:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.4)] relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 blur-3xl rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-500/5 blur-3xl rounded-full pointer-events-none" />
      {children}
    </div>
  );
}
