"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { finishSocialVideoRender, prepareSocialVideoUpload } from "@/app/office/actions";

const WIDTH = 1080;
const HEIGHT = 1920;
const FPS = 30;
const CARD_MS = 2600;
const FADE_MS = 420;
const MAX_RENDER_SIZE = 50 * 1024 * 1024;

const clamp01 = (value) => Math.max(0, Math.min(1, value));
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const CTA_FALLBACK = "Book a 15-minute walkthrough — teamtastic.events";

function wrapText(ctx, text, maxWidth, maxLines) {
  const words = String(text || "").split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
      if (lines.length >= maxLines) break;
    } else {
      line = test;
    }
  }
  if (lines.length < maxLines) lines.push(line);
  return lines;
}

function drawTexture(ctx, t = 0) {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  gradient.addColorStop(0, "#0d0f22");
  gradient.addColorStop(1, "#1c1440");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const glow = ctx.createRadialGradient(WIDTH / 2, HEIGHT * 0.42, 0, WIDTH / 2, HEIGHT * 0.42, WIDTH * 0.85);
  glow.addColorStop(0, "rgba(139,92,246,0.18)");
  glow.addColorStop(1, "rgba(139,92,246,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const sweep = (t / FPS) % 320;
  const arc = ctx.createLinearGradient(0, HEIGHT * 0.5 - 360, 0, HEIGHT * 0.5 + 360);
  arc.addColorStop(0, "rgba(244,114,182,0.10)");
  arc.addColorStop(0.5, "rgba(167,139,250,0.14)");
  arc.addColorStop(1, "rgba(99,102,241,0.10)");
  ctx.fillStyle = arc;
  ctx.beginPath();
  ctx.arc(WIDTH / 2, HEIGHT * 0.5 - 90, Math.max(0, 300 + sweep), 0, Math.PI * 2);
  ctx.fill();
}

function drawCard(ctx, card, rise = 0, t = 0) {
  drawTexture(ctx, t);
  ctx.textAlign = "center";
  ctx.save();
  ctx.translate(0, rise);

  ctx.font = "500 64px system-ui, sans-serif";
  ctx.fillStyle = "rgba(226,232,240,0.9)";
  ctx.fillText("TEAMTASTIC", WIDTH / 2, 170);
  ctx.font = "600 240px system-ui, sans-serif";
  ctx.lineWidth = 6;
  ctx.strokeStyle = "rgba(167,139,250,0.55)";
  ctx.fillStyle = "rgba(255,255,255,0.14)";
  const brand = "…";
  ctx.strokeText(brand, WIDTH / 2, 330);
  ctx.fillText(brand, WIDTH / 2, 330);

  ctx.font = "500 44px system-ui, sans-serif";
  ctx.fillStyle = "rgba(244,114,182,0.95)";
  ctx.fillText(card.kicker, WIDTH / 2, 218);

  ctx.font = "700 108px system-ui, sans-serif";
  ctx.fillStyle = "#f1f5f9";
  const bodyLines = wrapText(ctx, card.body, WIDTH - 200, 4);
  let y = 520;
  for (const line of bodyLines) {
    ctx.fillText(line, WIDTH / 2, y);
    y += 118;
  }

  if (card.note) {
    ctx.font = "500 58px system-ui, sans-serif";
    ctx.fillStyle = "rgba(148,163,184,0.95)";
    ctx.fillText(card.note, WIDTH / 2, y + 90);
  }

  const rule = ctx.createLinearGradient(WIDTH / 2 - 260, 0, WIDTH / 2 + 260, 0);
  rule.addColorStop(0, "rgba(167,139,250,0)");
  rule.addColorStop(0.5, "rgba(167,139,250,0.9)");
  rule.addColorStop(1, "rgba(167,139,250,0)");
  ctx.fillStyle = rule;
  ctx.fillRect(WIDTH / 2 - 260, HEIGHT - 260, 520, 6);

  ctx.font = "500 48px system-ui, sans-serif";
  ctx.fillStyle = "rgba(226,232,240,0.85)";
  ctx.fillText(card.footer, WIDTH / 2, HEIGHT - 190);
  ctx.restore();
}

export default function VideoRecorder({ itemId, renderJobId, title, hook, cta, destination, shots = [] }) {
  const router = useRouter();
  const canvasRef = useRef(null);
  const [state, setState] = useState("idle");
  const [seconds, setSeconds] = useState(0);
  const [message, setMessage] = useState("");

  function buildCards() {
    const target = destination || "teamtastic.events";
    const titleLine = title || hook || "Teamtastic";
    const cards = [
      { kicker: "VIRTUAL EVENTS", body: titleLine, note: hook && hook !== titleLine ? hook : null, footer: target },
    ];
    const list = Array.isArray(shots) && shots.length ? shots : [{ time: "0:00", shot: titleLine }];
    for (const shot of list) {
      cards.push({ kicker: shot.time || "SHOT", body: shot.shot || "…", note: null, footer: target });
    }
    cards.push({ kicker: "NEXT STEP", body: cta || CTA_FALLBACK, note: null, footer: target });
    return cards;
  }

  async function runRender(cards, ctx) {
    const total = cards.length * CARD_MS;
    let lastSecond = -1;
    return new Promise((resolve) => {
      const start = performance.now();
      function frame(now) {
        const t = now - start;
        const index = Math.min(cards.length - 1, Math.floor(t / CARD_MS));
        const local = t - index * CARD_MS;
        const fade = easeInOut(clamp01(Math.min(local / FADE_MS, (CARD_MS - local) / FADE_MS)));
        drawCard(ctx, cards[index], (1 - fade) * 42, t);

        const second = Math.floor(t / 1000);
        if (second !== lastSecond) { lastSecond = second; setSeconds(second); }
        if (t >= total) resolve();
        else requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    });
  }

  async function handleRender() {
    const canvas = canvasRef.current;
    if (!canvas || typeof MediaRecorder === "undefined") {
      setState("error");
      setMessage("This browser can't record video.");
      return;
    }
    const ctx = canvas.getContext("2d");
    const cards = buildCards();

    const mimeOptions = ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
    const mimeType = mimeOptions.find((option) => MediaRecorder.isTypeSupported(option));
    if (!mimeType) {
      setState("error");
      setMessage("No supported video encoder (try Safari or Chrome).");
      return;
    }
    const extension = mimeType.startsWith("video/mp4") ? "mp4" : "webm";

    const chunks = [];
    drawCard(ctx, cards[0]);
    const stream = canvas.captureStream(FPS);
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 });
    recorder.ondataavailable = (event) => { if (event.data && event.data.size) chunks.push(event.data); };
    recorder.onstop = async () => {
      setState("encoding");
      const blob = new Blob(chunks, { type: mimeType.split(";")[0] });
      const file = new File([blob], `render-${renderJobId}.${extension}`, { type: mimeType.split(";")[0] });
      try {
        if (!file.size || file.size > MAX_RENDER_SIZE) throw new Error("The rendered video is too large to save.");
        const request = new FormData();
        request.append("item_id", itemId);
        request.append("render_job_id", renderJobId);
        request.append("mime", file.type);
        const prepared = await prepareSocialVideoUpload(request);
        if (!prepared?.success || !prepared.path || !prepared.token) throw new Error("Teamtastic could not prepare the private upload.");

        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (!url || !key) throw new Error("Teamtastic storage is not configured.");
        const storage = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }).storage;
        const { error: uploadError } = await storage.from("distribution-media")
          .uploadToSignedUrl(prepared.path, prepared.token, file, { contentType: file.type, upsert: true });
        if (uploadError) throw new Error("The video could not be uploaded.");

        const finish = new FormData();
        finish.append("item_id", itemId);
        finish.append("render_job_id", renderJobId);
        finish.append("mime", file.type);
        finish.append("width", String(WIDTH));
        finish.append("height", String(HEIGHT));
        finish.append("duration_ms", String(cards.length * CARD_MS));
        const result = await finishSocialVideoRender(finish);
        if (!result?.success) throw new Error("The video uploaded but could not be attached.");
        setState("done");
        router.push("/office/distribution?success=rendered:done");
        router.refresh();
      } catch (error) {
        setState("error");
        setMessage(error?.message || "The video could not be saved.");
      }
    };

    setState("recording");
    setSeconds(0);
    setMessage("");
    recorder.start(100);
    await runRender(cards, ctx);
    recorder.stop();
    stream.getTracks().forEach((track) => track.stop());
  }

  return (
    <div className="mt-3 space-y-2">
      <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} className="max-h-56 w-auto rounded-lg border border-white/10 bg-slate-950" />
      <div className="flex flex-wrap items-center gap-2">
        {state === "idle" && (
          <button type="button" onClick={handleRender} className="rounded-lg border border-white/10 px-3 py-2 text-sm">Render video in this tab</button>
        )}
        {state === "recording" && <span className="text-xs text-amber-300">Recording… {seconds}s — keep this tab open</span>}
        {state === "encoding" && <span className="text-xs text-sky-300">Finalizing and attaching to the post…</span>}
        {state === "done" && <span className="text-xs text-emerald-300">Video attached. Opening the refreshed post…</span>}
        {state === "error" && <span className="text-xs text-red-300">{message}</span>}
      </div>
      <p className="text-xs text-slate-500">Renders a branded card video from the shot list in your browser, then attaches it as post media. Nothing publishes until you approve.</p>
    </div>
  );
}
