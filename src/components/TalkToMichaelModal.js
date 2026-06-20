"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Check, Loader2, Sparkles, MessageSquare } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function TalkToMichaelModal({ isOpen, onClose }) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
    teamSize: "15-50",
    message: "",
  });

  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email) return;

    setLoading(true);

    // Dynamic messaging steps for premium interactive feel
    const states = [
      "Securing connection to host lobby...",
      "Syncing requirements with Michael...",
      "Prepping customized gameshow advice...",
    ];

    for (let i = 0; i < states.length; i++) {
      setLoadingMessage(states[i]);
      await new Promise((resolve) => setTimeout(resolve, 600));
    }

    try {
      // Save lead directly to Supabase leads table
      const { error } = await supabase.from("leads").insert([
        {
          name: formData.name,
          email: formData.email,
          company: formData.company || "N/A",
          team_size: formData.teamSize,
          message: formData.message || "No message provided.",
          lead_source: "Talk to Michael (Landing Page)",
          status: "New",
          created_at: new Date().toISOString(),
        },
      ]);

      if (error) {
        console.warn("Supabase lead insertion logged warning:", error.message);
      }
    } catch (err) {
      console.error("Failed to sync lead to database, using local fallback:", err);
    }

    setLoading(false);
    setSubmitted(true);
  };

  const handleReset = () => {
    setFormData({
      name: "",
      email: "",
      company: "",
      teamSize: "15-50",
      message: "",
    });
    setSubmitted(false);
    onClose();
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
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: "spring", duration: 0.4 }}
            className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-zinc-950 shadow-2xl z-10 flex flex-col"
          >
            {/* Header / Brand Accent */}
            <div className="h-1.5 bg-gradient-to-r from-brand-purple via-brand-pink to-amber-400 w-full" />

            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-full text-zinc-400 hover:text-white hover:bg-white/5 transition-all z-20"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="p-6 sm:p-8 flex-1 flex flex-col justify-between">
              {!submitted ? (
                <div className="space-y-6">
                  {/* Title & Avatar */}
                  <div className="flex items-center gap-4">
                    <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-brand-purple shrink-0 bg-zinc-900 flex items-center justify-center">
                      <img
                        src="/emcee-engaged-transparent.png"
                        alt="Michael - Master Emcee"
                        className="w-full h-full object-cover scale-110 object-top"
                        onError={(e) => {
                          e.target.style.display = "none";
                          e.target.nextSibling.style.display = "flex";
                        }}
                      />
                      <div className="hidden absolute inset-0 bg-brand-purple/20 items-center justify-center text-brand-purple">
                        <MessageSquare className="h-5 w-5" />
                      </div>
                    </div>
                    <div className="text-left">
                      <h4 className="text-sm font-extrabold text-white flex items-center gap-2">
                        Michael <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full uppercase tracking-wider font-sans font-black">● Online & Ready</span>
                      </h4>
                      <p className="text-xs text-zinc-400 leading-normal">
                        Your dedicated event host & lead planner
                      </p>
                    </div>
                  </div>

                  <div className="text-left space-y-2">
                    <h3 className="text-2xl font-extrabold tracking-tight text-white">
                      Let&apos;s Customize Your Event
                    </h3>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Leave your details below. Michael will look over your team occasion and get back to you with custom game recommendations and pricing options in under 2 hours.
                    </p>
                  </div>

                  {loading ? (
                    /* Loading State */
                    <div className="py-12 flex flex-col items-center justify-center space-y-4 text-center">
                      <Loader2 className="h-8 w-8 animate-spin text-brand-pink" />
                      <p className="text-sm font-bold text-white tracking-wide animate-pulse">
                        {loadingMessage}
                      </p>
                    </div>
                  ) : (
                    /* Form State */
                    <form onSubmit={handleSubmit} className="space-y-4 text-left">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 block">
                            Your Name *
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Sarah Connor"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-brand-purple focus:ring-1 focus:ring-brand-purple/40 placeholder-zinc-600 transition-all font-sans"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 block">
                            Business Email *
                          </label>
                          <input
                            type="email"
                            required
                            placeholder="e.g. sarah@techcorp.com"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-brand-purple focus:ring-1 focus:ring-brand-purple/40 placeholder-zinc-600 transition-all font-sans"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 block">
                            Company Name
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. TechCorp Inc."
                            value={formData.company}
                            onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                            className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-brand-purple focus:ring-1 focus:ring-brand-purple/40 placeholder-zinc-600 transition-all font-sans"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 block">
                            Expected Group Size
                          </label>
                          <select
                            value={formData.teamSize}
                            onChange={(e) => setFormData({ ...formData, teamSize: e.target.value })}
                            className="w-full h-11 px-4 rounded-xl bg-zinc-900 border border-white/10 text-sm text-white focus:outline-none focus:border-brand-purple focus:ring-1 focus:ring-brand-purple/40 transition-all font-sans cursor-pointer"
                          >
                            <option value="under-15">Micro Squad (&lt;15 players)</option>
                            <option value="15-50">Vibrant Group (15-50 players)</option>
                            <option value="50-150">Large Department (50-150 players)</option>
                            <option value="150+">Mega Enterprise (150+ players)</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 block">
                          Tell Michael About Your Event
                        </label>
                        <textarea
                          rows={3}
                          placeholder="Tell us what you're celebrating! Include date preferences, game requests, or specific customization ideas."
                          value={formData.message}
                          onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                          className="w-full p-4 rounded-xl bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-brand-purple focus:ring-1 focus:ring-brand-purple/40 placeholder-zinc-600 transition-all font-sans resize-none leading-relaxed"
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-bold text-white bg-[#D81B60] hover:bg-pink-600 transition-all shadow-lg shadow-pink-500/20 hover:scale-[1.01] uppercase tracking-wider"
                      >
                        Submit Request
                        <Send className="h-4 w-4" />
                      </button>
                    </form>
                  )}
                </div>
              ) : (
                /* Success State */
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="py-8 flex flex-col items-center justify-center text-center space-y-6"
                >
                  <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)] animate-bounce">
                    <Check className="h-8 w-8" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-2xl font-extrabold text-white">Request Submitted!</h3>
                    <p className="text-sm text-zinc-300 max-w-sm leading-relaxed">
                      Thank you, <span className="font-bold text-white">{formData.name}</span>! Michael has been briefed on your event details. We will contact you at <span className="font-bold text-white">{formData.email}</span> within 2 hours.
                    </p>
                  </div>
                  <button
                    onClick={handleReset}
                    className="px-8 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold text-sm transition-all hover:scale-[1.02]"
                  >
                    Close Window
                  </button>
                </motion.div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
