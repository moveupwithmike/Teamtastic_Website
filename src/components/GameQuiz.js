"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Users, Compass, PartyPopper, CheckCircle, ArrowRight, ArrowLeft, Loader2, Gamepad2, ArrowUpRight } from "lucide-react";
import { PAYMENT_CONFIG } from "@/lib/stripe";
import { captureLead, createSubmissionId } from "@/lib/lead-client";
import { track } from "@/lib/analytics";
import TurnstileWidget from "@/components/TurnstileWidget";
import Link from "next/link";

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

function teamSizeFromPlayers(players) {
  const count = Number(players);
  if (!Number.isFinite(count) || count < 1) return "";
  if (count < 15) return "under-15";
  if (count <= 50) return "15-50";
  if (count <= 150) return "50-150";
  return "150+";
}

export default function GameQuiz() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileReset, setTurnstileReset] = useState(0);
  const [submissionId, setSubmissionId] = useState(() => createSubmissionId());
  const handleTurnstileToken = useCallback((token) => setTurnstileToken(token), []);

  const [formData, setFormData] = useState({
    teamSize: "",
    vibe: "",
    occasion: "",
    name: "",
    email: "",
    company: "",
  });
  const [estimatorContext, setEstimatorContext] = useState(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("teamtastic_estimator");
      if (raw) {
        const saved = JSON.parse(raw);
        if (
          Number.isFinite(Number(saved?.players)) &&
          ["core", "premium"].includes(saved?.packageType) &&
          saved?.addOns &&
          typeof saved.addOns === "object"
        ) {
          // This one-time hydration synchronizes quiz state with the pricing estimator.
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setEstimatorContext(saved);
          setFormData((previous) => ({
            ...previous,
            teamSize: teamSizeFromPlayers(saved.players),
          }));
        }
        sessionStorage.removeItem("teamtastic_estimator");
      }
    } catch {
      // sessionStorage unavailable
    }
  }, []);

  const [recommendation, setRecommendation] = useState(null);

  const handleSelect = (field, value) => {
    if (step === 0) track("quiz_started", { source: "event_quiz" });
    setFormData((prev) => ({ ...prev, [field]: value }));
    track("quiz_step_completed", { source: "event_quiz", step: step + 1, [field]: value });
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.email || !formData.name) return;
    if (!turnstileToken) {
      setError("Please complete secure verification.");
      return;
    }

    setLoading(true);
    setError("");
    track("lead_submit_attempted", { source: "event_quiz", teamSize: formData.teamSize, vibe: formData.vibe, occasion: formData.occasion });
    try {
      const result = await captureLead({
        submissionId,
        source: "event_quiz",
        name: formData.name,
        email: formData.email,
        company: formData.company,
        teamSize: formData.teamSize,
        vibe: formData.vibe,
        occasion: formData.occasion,
        turnstileToken,
        ...(estimatorContext ? { context: {
          estimator_players: estimatorContext.players,
          estimator_package: estimatorContext.packageType,
          estimator_add_ons: Object.entries(estimatorContext.addOns)
            .filter(([, v]) => v)
            .map(([k]) => k),
          estimator_total: estimatorContext.estimatedTotal,
        }} : {}),
      });
      setRecommendation(result.recommendation);
      setCompleted(true);
      track("lead_captured", { source: "event_quiz", teamSize: formData.teamSize, vibe: formData.vibe, occasion: formData.occasion, recommendation: result.recommendation.key });
    } catch (err) {
      setError(err.message);
      track("lead_capture_failed", { source: "event_quiz", code: err.code, retryable: err.retryable });
      setTurnstileToken("");
      setTurnstileReset((value) => value + 1);
    } finally {
      setLoading(false);
    }
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
          {estimatorContext && !completed && (
            <div className="mb-6 rounded-2xl border border-purple-400/20 bg-purple-500/10 px-4 py-3 text-sm text-purple-100">
              Your estimate is attached: {estimatorContext.players} players,{" "}
              {estimatorContext.packageType === "premium" ? "Premium" : "Core"} event, approximately $
              {Number(estimatorContext.estimatedTotal).toLocaleString()}.
            </div>
          )}
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
                    <TurnstileWidget onToken={handleTurnstileToken} resetKey={turnstileReset} />
                    {error && <p role="alert" className="text-sm text-rose-400">{error}</p>}

                    <div className="pt-4">
                      <button
                        type="submit"
                        disabled={!turnstileToken || loading}
                        className={`w-full flex h-12 items-center justify-center gap-2 rounded-xl text-base font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30 transition-all ${
                          !turnstileToken || loading ? 'opacity-40 cursor-not-allowed' : 'hover:-translate-y-0.5'
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
                <h3 className="text-lg font-bold text-white">Saving your event details…</h3>
                <p className="text-zinc-400 text-sm">Your recommendation will be ready in a moment.</p>
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
                  {(recommendation.slugs || recommendation.games).map((g, i) => (
                    <Link
                      key={g}
                      href={`/games/${recommendation.slugs ? recommendation.slugs[i] : g.toLowerCase().replace(/ /g, "-")}`}
                      className="px-4 py-3 bg-zinc-900/50 border border-white/5 rounded-xl flex items-center gap-2 hover:border-purple-500/30 hover:bg-zinc-900/80 transition-colors group"
                    >
                      <Gamepad2 className="h-4 w-4 text-pink-400 shrink-0" />
                      <span className="text-xs font-semibold text-zinc-200 group-hover:text-white transition-colors">{recommendation.games[i]}</span>
                    </Link>
                  ))}
                </div>


                {/* Dynamic High-Conversion CTAs */}
                <div className="w-full max-w-md space-y-4 pt-4">
                  {/* Primary CTA: Hosted MC Event Booking (Highly recommended for groups/occasions) */}
                  <a
                    href={`${PAYMENT_CONFIG.depositUrl}?prefilled_email=${encodeURIComponent(formData.email)}&client_reference_id=${encodeURIComponent(submissionId)}`}
                    onClick={() => track("deposit_cta_clicked", { source: "event_quiz", teamSize: formData.teamSize, vibe: formData.vibe, occasion: formData.occasion, recommendation: recommendation.key })}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex h-14 items-center justify-center gap-2 rounded-2xl text-base font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-xl shadow-purple-500/25 hover:shadow-purple-500/35 transition-all duration-300 hover:-translate-y-0.5"
                  >
                    Reserve Your Event — $200 Deposit
                    <ArrowUpRight className="h-4 w-4" />
                  </a>

                  <a
                    href={`/book?${new URLSearchParams({ name: formData.name, email: formData.email, company: formData.company || "", submission_id: submissionId })}`}
                    onClick={() => track("booking_call_clicked", { source: "event_quiz", teamSize: formData.teamSize, vibe: formData.vibe, occasion: formData.occasion, recommendation: recommendation.key })}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 text-sm font-semibold text-zinc-200 hover:bg-white/10 hover:border-white/20 transition-colors"
                  >
                    Book a 15-Minute Call
                    <ArrowUpRight className="h-4 w-4" />
                  </a>

                  {/* Free Sandbox Trial */}
                  <div className="flex items-center justify-between gap-4 pt-2">
                    <a
                    href={`https://teamtastic.games?${new URLSearchParams({ vibe: formData.vibe, size: formData.teamSize, occasion: formData.occasion, recommendation: recommendation.key, submission_id: submissionId }).toString()}`}
                    onClick={() => track("free_game_clicked", { source: "event_quiz", teamSize: formData.teamSize, vibe: formData.vibe, occasion: formData.occasion, recommendation: recommendation.key })}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-zinc-400 hover:text-white transition-colors underline"
                    >
                      Launch a Free Game
                    </a>

                    <button
                      onClick={() => {
                        setStep(0);
                        setCompleted(false);
                        setFormData({ teamSize: "", vibe: "", occasion: "", name: "", email: "", company: "" });
                        setSubmissionId(createSubmissionId());
                        setTurnstileToken("");
                        setTurnstileReset((value) => value + 1);
                        setError("");
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
