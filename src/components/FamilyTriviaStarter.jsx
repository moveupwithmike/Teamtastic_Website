"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Loader2, LockKeyhole, Printer, Sparkles } from "lucide-react";
import TurnstileWidget from "@/components/TurnstileWidget";
import { captureLead, createSubmissionId } from "@/lib/lead-client";
import { track } from "@/lib/analytics";
import { buildFamilyTrivia } from "@/lib/family-trivia";

const initialDetails = {
  occasion: "",
  ageRange: "",
  playerCount: "",
  interests: "",
  memory: "",
  preferredEventDate: "",
};

export default function FamilyTriviaStarter() {
  const [details, setDetails] = useState(initialDetails);
  const [previewReady, setPreviewReady] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submissionId] = useState(() => createSubmissionId());
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileReset, setTurnstileReset] = useState(0);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const handleToken = useCallback((token) => setTurnstileToken(token), []);
  const questions = useMemo(() => buildFamilyTrivia(details), [details]);

  function updateDetails(event) {
    setDetails((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  function makePreview(event) {
    event.preventDefault();
    setPreviewReady(true);
    setUnlocked(false);
    setError("");
    track("family_trivia_preview_generated", {
      occasion: details.occasion,
      player_count: details.playerCount,
      age_range: details.ageRange,
    });
  }

  async function unlockPack(event) {
    event.preventDefault();
    if (!turnstileToken) {
      setError("Please complete secure verification.");
      return;
    }
    setStatus("submitting");
    setError("");
    try {
      await captureLead({
        submissionId,
        source: "family_trivia_starter",
        name,
        email,
        teamSize: details.playerCount,
        occasion: details.occasion,
        preferredEventDate: details.preferredEventDate || null,
        turnstileToken,
        context: {
          entry_point: "family_trivia_starter",
          audience_type: "family",
          age_range: details.ageRange,
          interests_provided: Boolean(details.interests.trim()),
          memory_provided: Boolean(details.memory.trim()),
          private_memory_stored: false,
          starter_version: "v1",
        },
      });
      setUnlocked(true);
      setStatus("success");
      track("family_trivia_starter_unlocked", {
        occasion: details.occasion,
        player_count: details.playerCount,
      });
    } catch (leadError) {
      setError(leadError.message || "We couldn't unlock your starter. Please try again.");
      setStatus("idle");
      setTurnstileToken("");
      setTurnstileReset((value) => value + 1);
      track("lead_capture_failed", { source: "family_trivia_starter", code: leadError.code });
    }
  }

  return (
    <main className="bg-white text-zinc-900">
      <section className="border-b border-zinc-200 bg-gradient-to-br from-purple-950 via-zinc-950 to-pink-950 py-16 text-white sm:py-24">
        <div className="mx-auto max-w-5xl px-4 text-center sm:px-6">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-pink-500/15 text-pink-300"><Sparkles className="h-8 w-8" /></span>
          <p className="mt-6 text-sm font-black uppercase tracking-[0.2em] text-pink-300">Free family party tool</p>
          <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-6xl">Custom Family Trivia Starter</h1>
          <p className="mx-auto mt-5 max-w-3xl text-lg leading-relaxed text-zinc-300">Turn your occasion, age range, and favorite family topics into a personalized set of conversation-starting trivia prompts.</p>
          <p className="mt-4 text-sm font-semibold text-zinc-400">Free · Takes about two minutes · No payment required</p>
        </div>
      </section>

      <section className="py-14 sm:py-20">
        <div className="mx-auto grid max-w-6xl items-start gap-10 px-4 sm:px-6 lg:grid-cols-2">
          <form onSubmit={makePreview} className="rounded-3xl border border-zinc-200 bg-zinc-50 p-6 shadow-sm sm:p-8">
            <h2 className="text-2xl font-black">1. Tell us about your family game</h2>
            <p className="mt-2 text-zinc-600">Your optional memory stays in this browser. We do not save it with your lead.</p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-bold text-zinc-700">Occasion
                <select required name="occasion" value={details.occasion} onChange={updateDetails} className="mt-1 h-12 w-full rounded-xl border border-zinc-300 bg-white px-3 font-normal">
                  <option value="">Choose one</option><option value="birthday">Birthday</option><option value="reunion">Family reunion</option><option value="anniversary">Anniversary</option><option value="graduation">Graduation</option><option value="holiday">Holiday gathering</option><option value="just-because">Just because</option>
                </select>
              </label>
              <label className="text-sm font-bold text-zinc-700">Age range
                <select required name="ageRange" value={details.ageRange} onChange={updateDetails} className="mt-1 h-12 w-full rounded-xl border border-zinc-300 bg-white px-3 font-normal">
                  <option value="">Choose one</option><option value="mostly adults">Mostly adults</option><option value="children and adults">Children and adults</option><option value="teens and adults">Teens and adults</option><option value="three or more generations">Three or more generations</option>
                </select>
              </label>
              <label className="text-sm font-bold text-zinc-700">Number of players
                <select required name="playerCount" value={details.playerCount} onChange={updateDetails} className="mt-1 h-12 w-full rounded-xl border border-zinc-300 bg-white px-3 font-normal">
                  <option value="">Choose one</option><option value="under-10">Under 10</option><option value="10-25">10–25</option><option value="25-50">25–50</option><option value="50+">50+</option>
                </select>
              </label>
              <label className="text-sm font-bold text-zinc-700">Possible event date <span className="font-normal text-zinc-500">(optional)</span>
                <input type="date" name="preferredEventDate" value={details.preferredEventDate} onChange={updateDetails} className="mt-1 h-12 w-full rounded-xl border border-zinc-300 bg-white px-3 font-normal" />
              </label>
              <label className="text-sm font-bold text-zinc-700 sm:col-span-2">A few family interests
                <input required name="interests" value={details.interests} onChange={updateDetails} maxLength={160} placeholder="Music, baseball, cooking, movies" className="mt-1 h-12 w-full rounded-xl border border-zinc-300 bg-white px-3 font-normal" />
              </label>
              <label className="text-sm font-bold text-zinc-700 sm:col-span-2">Optional family memory
                <textarea name="memory" value={details.memory} onChange={updateDetails} maxLength={180} placeholder="Keep it light—something the family would enjoy remembering" className="mt-1 min-h-24 w-full rounded-xl border border-zinc-300 bg-white p-3 font-normal" />
              </label>
            </div>
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-950">
              Please do not enter children’s full names, addresses, medical or financial information, or anything you would not want included in a family game.
            </div>
            <button className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-purple-700 px-5 font-bold text-white hover:bg-purple-800">Make my preview <Sparkles className="h-5 w-5" /></button>
          </form>

          <div aria-live="polite" className="rounded-3xl border border-purple-200 bg-purple-50 p-6 sm:p-8">
            <h2 className="text-2xl font-black">2. Preview your starter</h2>
            {!previewReady ? (
              <div className="mt-6 flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-purple-300 bg-white/70 p-8 text-center text-zinc-600">
                <Sparkles className="h-10 w-10 text-purple-300" />
                <p className="mt-4">Your first three personalized prompts will appear here.</p>
              </div>
            ) : (
              <>
                <ol className="mt-6 space-y-3">
                  {(unlocked ? questions : questions.slice(0, 3)).map((question, index) => (
                    <li key={`${index}-${question}`} className="rounded-2xl border border-purple-100 bg-white p-4 shadow-sm"><span className="mr-2 font-black text-purple-500">{index + 1}.</span>{question}</li>
                  ))}
                </ol>
                {!unlocked ? (
                  <form onSubmit={unlockPack} className="mt-6 rounded-2xl bg-zinc-950 p-5 text-white">
                    <div className="flex items-center gap-2"><LockKeyhole className="h-5 w-5 text-pink-400" /><h3 className="font-extrabold">Unlock all 12 prompts</h3></div>
                    <p className="mt-2 text-sm text-zinc-400">Enter your details to view, print, or save the complete starter.</p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <input required name="name" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} placeholder="Your name" aria-label="Your name" className="h-12 rounded-xl border border-white/10 bg-white/5 px-4 text-white placeholder:text-zinc-500" />
                      <input required type="email" name="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} placeholder="Email address" aria-label="Email address" className="h-12 rounded-xl border border-white/10 bg-white/5 px-4 text-white placeholder:text-zinc-500" />
                    </div>
                    <div className="mt-4"><TurnstileWidget onToken={handleToken} resetKey={turnstileReset} /></div>
                    {error && <p role="alert" className="mt-3 text-sm text-rose-300">{error}</p>}
                    <button disabled={status === "submitting" || !turnstileToken} className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#D81B60] px-5 font-bold text-white hover:bg-pink-600 disabled:cursor-not-allowed disabled:opacity-40">
                      {status === "submitting" ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving securely…</> : <>Unlock my free starter <ArrowRight className="h-4 w-4" /></>}
                    </button>
                    <p className="mt-3 text-xs leading-relaxed text-zinc-500">By submitting, you agree to our <Link href="/privacy" className="underline">privacy policy</Link> and <Link href="/terms" className="underline">terms</Link>. We may email you about your inquiry and event ideas. You can opt out anytime.</p>
                  </form>
                ) : (
                  <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950">
                    <div className="flex items-center gap-2 font-extrabold"><Check className="h-5 w-5" /> Your complete starter is ready</div>
                    <p className="mt-2 text-sm">Use these prompts as written or replace them with facts only your family knows.</p>
                    <button type="button" onClick={() => window.print()} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-700 px-5 font-bold text-white hover:bg-emerald-800"><Printer className="h-4 w-4" /> Print or save</button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      <section className="border-t border-zinc-200 bg-zinc-50 py-14 text-center">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <h2 className="text-3xl font-black">Want someone else to run the whole show?</h2>
          <p className="mt-3 text-zinc-600">Teamtastic turns your family details into a professionally hosted live game show.</p>
          <Link href="/virtual-family-game-night#availability" className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#D81B60] px-6 font-bold text-white hover:bg-pink-700">Explore hosted family games <ArrowRight className="h-5 w-5" /></Link>
        </div>
      </section>
    </main>
  );
}
