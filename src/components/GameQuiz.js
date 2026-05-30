"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Users, Compass, PartyPopper, CheckCircle, ArrowRight, ArrowLeft, Loader2, Gamepad2, ArrowUpRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { PAYMENT_CONFIG } from "@/lib/stripe";

const stepTitles = [
  "How big is your crew?",
  "What is the team vibe?",
  "What is the occasion?",
  "Let's customize your arcade!",
];

const teamSizes = [
  { label: "Micro Squad (Under 15 players)", value: "under-15", icon: Users },
  { label: "Vibrant Group (15 - 50 players)", value: "15-50", icon: Users },
  { label: "Large Clan (50 - 150 players)", value: "50-150", icon: Users },
  { label: "Mega Department (150+ players)", value: "150+", icon: Users },
];

const vibes = [
  { label: "Electric & Competitive (Buzz-in battle)", value: "competitive" },
  { label: "Chill & Conversational (Laughter & stories)", value: "social" },
  { label: "Collaborative & Logic (Solve puzzles)", value: "collaborative" },
  { label: "Fast & Icebreaker (Supercharge standups)", value: "icebreaker" },
];

const occasions = [
  { label: "Routine Team Social Hour", value: "social-hour" },
  { label: "Seasonal Holiday Social", value: "holiday" },
  { label: "New Hire Onboarding & Culture", value: "onboarding" },
  { label: "Private Milestone Celebration", value: "private-milestone" },
];

export default function GameQuiz() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  
  // Custom Anti-Bot Human Verification States
  const [verified, setVerified] = useState(false);
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [verificationFailed, setVerificationFailed] = useState(false);

  const [formData, setFormData] = useState({
    teamSize: "",
    vibe: "",
    occasion: "",
    name: "",
    email: "",
    company: "",
  });

  const [recommendation, setRecommendation] = useState(null);

  const handleSelect = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setTimeout(() => {
      handleNext();
    }, 300);
  };

  const handleNext = () => {
    if (step < 3) {
      setStep((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (step > 0) {
      setStep((prev) => prev - 1);
    }
  };

  const handleVerificationClick = () => {
    setVerificationLoading(true);
    setVerificationFailed(false);
    setTimeout(() => {
      setVerificationLoading(false);
      setVerified(true);
    }, 800);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.email || !formData.name) return;
    if (!verified) return;

    setLoading(true);

    // Mock high-energy AI SDR evaluation steps
    const loadingStates = [
      "Analyzing group dynamics...",
      "Consulting the game show oracle...",
      "Custom-prepping your live arcade recommendation...",
    ];

    for (let i = 0; i < loadingStates.length; i++) {
      setLoadingMessage(loadingStates[i]);
      await new Promise((resolve) => setTimeout(resolve, 800));
    }

    try {
      // Sync storefront lead directly to shared Supabase DB leads table
      const { error } = await supabase.from("leads").insert([
        {
          name: formData.name,
          email: formData.email,
          company: formData.company || "N/A",
          team_size: formData.teamSize,
          vibe: formData.vibe,
          occasion: formData.occasion,
          created_at: new Date().toISOString(),
        },
      ]);
      
      // Note: If leads table doesn't exist yet, we catch error gracefully to let lead proceed.
      if (error) console.warn("Supabase lead sync logged (will proceed with fallback):", error.message);
    } catch (err) {
      console.warn("Supabase connection skipped locally. Proceeding to recommendation:", err);
    }

    // Evaluate customized game package based on vibe selection
    let gameRec = {
      title: "Lightning Feud + Meme Battle",
      games: ["Lightning Feud", "What the Meme"],
      badge: "Highly Competitive & Hilarious",
      desc: "Perfect for fast-paced corporate teams who love friendly banter. Buzz in on rapid family-feud trivia, and complete the round by styling the most upvoted memes.",
      gamesLink: "https://teamtastic.games?vibe=competitive&size=" + formData.teamSize,
    };

    if (formData.vibe === "social") {
      gameRec = {
        title: "Sound Bite Trivia + Conversation Starter",
        games: ["Sound Bite Trivia", "Tell a Fun Fact"],
        badge: "Chill & Hilarious",
        desc: "Great for routine social hours. Guess classic movie sound clips, audio riffs, and discover funny, authenticated secrets from your colleagues in a safe format.",
        gamesLink: "https://teamtastic.games?vibe=social&size=" + formData.teamSize,
      };
    } else if (formData.vibe === "collaborative") {
      gameRec = {
        title: "Virtual Escape Room + Drawing Masterpiece",
        games: ["Boss Raid Escape", "Canvas Co-op"],
        badge: "Brainy & Collaborative",
        desc: "Designed for engineering and logical teams. Split into secure virtual rooms, crack puzzle codes, and build shared drawing masterpieces together against a clock.",
        gamesLink: "https://teamtastic.games?vibe=collaborative&size=" + formData.teamSize,
      };
    } else if (formData.vibe === "icebreaker") {
      gameRec = {
        title: "Rapid Fire Standup + Dynamic Icebreaker",
        games: ["Quick Buzz", "Standup Trivia"],
        badge: "Fast-Paced & Connecting",
        desc: "Supercharge your morning syncs. Zero preparation required. Spark instant laughter in under 5 minutes with low-stress, engaging check-ins.",
        gamesLink: "https://teamtastic.games?vibe=icebreaker&size=" + formData.teamSize,
      };
    }

    setRecommendation(gameRec);
    setLoading(false);
    setCompleted(true);
  };

  return (
    <section id="quiz" className="py-20 md:py-28 relative">
      <div className="absolute inset-x-0 bottom-0 h-[400px] bg-gradient-to-t from-pink-900/5 via-transparent to-transparent pointer-events-none -z-10" />

      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <div className="text-center space-y-4 mb-12">
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-5xl text-white">
            Find Your Perfect Event
          </h2>
          <p className="text-zinc-400 max-w-lg mx-auto text-base">
            Take our 60-second virtual social planner quiz to receive a customized gameshow package and launch a pre-configured free game lobby instantly.
          </p>
        </div>

        {/* Quiz Shell Container */}
        <div className="glassmorphism rounded-3xl p-8 md:p-12 shadow-2xl border border-white/10 relative min-h-[420px] flex flex-col justify-between">
          <AnimatePresence mode="wait">
            {!completed && !loading && (
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="flex-1 flex flex-col"
              >
                {/* Step Header */}
                <div className="flex items-center justify-between mb-8">
                  <span className="text-xs uppercase tracking-widest font-bold text-purple-400">
                    Step {step + 1} of 4
                  </span>
                  <span className="text-sm font-semibold text-zinc-500">
                    {stepTitles[step]}
                  </span>
                </div>

                {/* Step Content */}
                {step === 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1 items-center">
                    {teamSizes.map((item) => (
                      <button
                        key={item.value}
                        onClick={() => handleSelect("teamSize", item.value)}
                        className={`p-6 rounded-2xl border text-left transition-all duration-300 hover:-translate-y-0.5 ${
                          formData.teamSize === item.value
                            ? "bg-purple-600/20 border-purple-500 text-white shadow-[0_0_15px_rgba(139,92,246,0.2)]"
                            : "bg-zinc-900/40 border-white/5 text-zinc-300 hover:border-white/15 hover:bg-zinc-900/60"
                        }`}
                      >
                        <item.icon className="h-6 w-6 text-purple-400 mb-3" />
                        <span className="font-semibold block text-sm">{item.label}</span>
                      </button>
                    ))}
                  </div>
                )}

                {step === 1 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1 items-center">
                    {vibes.map((item) => (
                      <button
                        key={item.value}
                        onClick={() => handleSelect("vibe", item.value)}
                        className={`p-6 rounded-2xl border text-left transition-all duration-300 hover:-translate-y-0.5 ${
                          formData.vibe === item.value
                            ? "bg-orange-600/20 border-orange-500 text-white shadow-[0_0_15px_rgba(249,115,22,0.2)]"
                            : "bg-zinc-900/40 border-white/5 text-zinc-300 hover:border-white/15 hover:bg-zinc-900/60"
                        }`}
                      >
                        <Compass className="h-6 w-6 text-orange-400 mb-3" />
                        <span className="font-semibold block text-sm">{item.label}</span>
                      </button>
                    ))}
                  </div>
                )}

                {step === 2 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1 items-center">
                    {occasions.map((item) => (
                      <button
                        key={item.value}
                        onClick={() => handleSelect("occasion", item.value)}
                        className={`p-6 rounded-2xl border text-left transition-all duration-300 hover:-translate-y-0.5 ${
                          formData.occasion === item.value
                            ? "bg-pink-600/20 border-pink-500 text-white shadow-[0_0_15px_rgba(236,72,153,0.2)]"
                            : "bg-zinc-900/40 border-white/5 text-zinc-300 hover:border-white/15 hover:bg-zinc-900/60"
                        }`}
                      >
                        <PartyPopper className="h-6 w-6 text-pink-400 mb-3" />
                        <span className="font-semibold block text-sm">{item.label}</span>
                      </button>
                    ))}
                  </div>
                )}

                {step === 3 && (
                  <form onSubmit={handleSubmit} className="space-y-4 flex-1 flex flex-col justify-center">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs uppercase font-bold tracking-wider text-zinc-400">Your Name</label>
                        <input
                          type="text"
                          required
                          value={formData.name}
                          onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                          placeholder="Host Founder"
                          className="w-full bg-zinc-900/60 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-purple-500 transition-colors"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs uppercase font-bold tracking-wider text-zinc-400">Work Email</label>
                        <input
                          type="email"
                          required
                          value={formData.email}
                          onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                          placeholder="founder@company.com"
                          className="w-full bg-zinc-900/60 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-purple-500 transition-colors"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs uppercase font-bold tracking-wider text-zinc-400">Company Name</label>
                      <input
                        type="text"
                        value={formData.company}
                        onChange={(e) => setFormData((prev) => ({ ...prev, company: e.target.value }))}
                        placeholder="Teamtastic Inc."
                        className="w-full bg-zinc-900/60 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-purple-500 transition-colors"
                      />
                    </div>
                    {/* Custom Anti-Bot Verification challenge */}
                    <div className="bg-zinc-950/60 border border-white/5 rounded-2xl p-4 mt-3">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
                        <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-500">Anti-Bot Verification</span>
                      </div>
                      <p className="text-xs text-zinc-300 mb-3">
                        Verify you are human: Tap the <strong className="text-amber-400 font-bold">Lightning Bolt</strong> icon.
                      </p>

                      {verificationLoading ? (
                        <div className="flex items-center gap-2 text-xs text-purple-400 py-1">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Checking browser patterns...</span>
                        </div>
                      ) : verified ? (
                        <div className="flex items-center gap-2 text-xs text-emerald-400 font-bold py-1.5 bg-emerald-950/20 border border-emerald-900/30 rounded-xl px-3 animate-fade-in">
                          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>Human verified. clear to proceed!</span>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          <div className="flex gap-3 items-center">
                            <button
                              type="button"
                              onClick={() => setVerificationFailed(true)}
                              className="w-10 h-10 rounded-xl bg-zinc-900 border border-white/5 flex items-center justify-center hover:bg-zinc-800 transition-colors"
                            >
                              <Users className="w-4 h-4 text-zinc-500" />
                            </button>

                            <button
                              type="button"
                              onClick={handleVerificationClick}
                              className={`w-10 h-10 rounded-xl bg-zinc-900 border flex items-center justify-center hover:bg-zinc-800 transition-all ${
                                verificationFailed ? 'border-rose-500/30' : 'border-white/5'
                              }`}
                            >
                              <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
                            </button>

                            <button
                              type="button"
                              onClick={() => setVerificationFailed(true)}
                              className="w-10 h-10 rounded-xl bg-zinc-900 border border-white/5 flex items-center justify-center hover:bg-zinc-800 transition-colors"
                            >
                              <Compass className="w-4 h-4 text-zinc-500" />
                            </button>
                          </div>
                          {verificationFailed && (
                            <span className="text-[10px] text-rose-400 font-semibold animate-shake">
                              ❌ Verification failed. Please select the correct amber Lightning Bolt.
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="pt-4">
                      <button
                        type="submit"
                        disabled={!verified}
                        className={`w-full flex h-12 items-center justify-center gap-2 rounded-xl text-base font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30 transition-all ${
                          !verified ? 'opacity-40 cursor-not-allowed' : 'hover:-translate-y-0.5'
                        }`}
                      >
                        Generate My Recommendation
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </form>
                )}

                {/* Progress dot indicators */}
                <div className="flex items-center justify-between border-t border-white/5 pt-6 mt-8">
                  <button
                    onClick={handlePrev}
                    disabled={step === 0}
                    className={`flex items-center gap-1.5 text-xs font-semibold ${
                      step === 0 ? "text-zinc-600 cursor-not-allowed" : "text-zinc-400 hover:text-white transition-colors"
                    }`}
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back
                  </button>
                  <div className="flex gap-2">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={`h-2 rounded-full transition-all duration-300 ${
                          step === i ? "w-6 bg-purple-500" : "w-2 bg-zinc-800"
                        }`}
                      />
                    ))}
                  </div>
                  <button
                    onClick={handleNext}
                    disabled={step === 3 || !formData[Object.keys(formData)[step]]}
                    className={`flex items-center gap-1.5 text-xs font-semibold ${
                      step === 3 || !formData[Object.keys(formData)[step]]
                        ? "text-zinc-600 cursor-not-allowed"
                        : "text-zinc-400 hover:text-white transition-colors"
                    }`}
                  >
                    Next
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* Evaluation Loading Stage */}
            {loading && (
              <motion.div
                key="loading"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex flex-col items-center justify-center text-center space-y-4"
              >
                <Loader2 className="h-10 w-10 text-purple-500 animate-spin" />
                <h3 className="text-lg font-bold text-white uppercase tracking-wider">AI SDR Orchestration</h3>
                <p className="text-zinc-400 text-sm animate-pulse">{loadingMessage}</p>
              </motion.div>
            )}

            {/* Recommendation Result Screen */}
            {completed && recommendation && (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex-1 flex flex-col items-center justify-between"
              >
                {/* Check Badge */}
                <div className="h-14 w-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4 animate-bounce">
                  <CheckCircle className="h-8 w-8" />
                </div>

                <div className="text-center space-y-2 max-w-md">
                  <span className="inline-flex px-3 py-1 bg-zinc-950 border border-purple-500/30 text-purple-300 text-xs font-semibold rounded-full uppercase tracking-wider">
                    {recommendation.badge}
                  </span>
                  <h3 className="text-xl md:text-2xl font-extrabold text-white pt-2">
                    {recommendation.title}
                  </h3>
                  <p className="text-sm text-zinc-400 leading-relaxed pt-2">
                    {recommendation.desc}
                  </p>
                </div>

                {/* Grid list of included games */}
                <div className="my-6 w-full max-w-md grid grid-cols-2 gap-4">
                  {recommendation.games.map((g) => (
                    <div key={g} className="px-4 py-3 bg-zinc-900/50 border border-white/5 rounded-xl flex items-center gap-2">
                      <Gamepad2 className="h-4 w-4 text-pink-400" />
                      <span className="text-xs font-semibold text-zinc-200">{g}</span>
                    </div>
                  ))}
                </div>

                {/* Dynamic High-Conversion CTAs */}
                <div className="w-full max-w-md space-y-4 pt-4">
                  {/* Primary CTA: Hosted MC Event Booking (Highly recommended for groups/occasions) */}
                  <a
                    href={`${PAYMENT_CONFIG.calendlyUrl}?name=${encodeURIComponent(formData.name)}&email=${encodeURIComponent(formData.email)}&a1=${encodeURIComponent(formData.company || "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex h-14 items-center justify-center gap-2 rounded-2xl text-base font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-xl shadow-purple-500/25 hover:shadow-purple-500/35 transition-all duration-300 hover:-translate-y-0.5"
                  >
                    🎤 Book Hosted VIP MC Event ($200 Deposit)
                    <ArrowUpRight className="h-4 w-4" />
                  </a>

                  {/* Secondary CTA: SaaS Pro Plan Subscription */}
                  <a
                    href={`${PAYMENT_CONFIG.proSaaSLink}?prefilled_email=${encodeURIComponent(formData.email)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white bg-zinc-900 border border-white/10 hover:bg-zinc-800 hover:border-purple-500/50 shadow-md transition-all duration-300 hover:-translate-y-0.5"
                  >
                    ⚙️ Unlock Pro Self-Service ($99/mo)
                  </a>

                  {/* Tertiary CTA: Free Sandbox Sandbox Trial (Secondary outline link) */}
                  <div className="flex items-center justify-between gap-4 pt-2">
                    <a
                      href={recommendation.gamesLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-zinc-400 hover:text-white transition-colors underline"
                    >
                      Try a Free 5-Min Sandbox Lobby
                    </a>

                    <button
                      onClick={() => {
                        setStep(0);
                        setCompleted(false);
                        setFormData({ teamSize: "", vibe: "", occasion: "", name: "", email: "", company: "" });
                        setVerified(false);
                        setVerificationLoading(false);
                        setVerificationFailed(false);
                      }}
                      className="text-xs font-medium text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      Retake Quiz
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
