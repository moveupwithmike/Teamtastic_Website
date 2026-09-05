import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createGateway } from "npm:@ai-sdk/gateway@4.0.74";
import { experimental_generateSpeech as generateSpeechWithAi } from "npm:ai@7.0.92";
import { authorizeWebhook, errorText, functionError, serviceClient } from "../_shared/runtime.ts";

// Haiku-class model via Vercel AI Gateway -- cost/latency fit for a short
// daily summary, mirrors the existing gmail-reply classifier's model choice.
// Re-fetch https://ai-gateway.vercel.sh/v1/models before ever changing this;
// don't assume this id stays current.
const SUMMARY_MODEL = "anthropic/claude-haiku-4.5";
// Vercel's supported speech interface currently exposes OpenAI speech models.
const SPEECH_MODEL = "openai/tts-1";
const AUDIO_BUCKET = "daily-report-audio";

const SUMMARY_SYSTEM_PROMPT = `You are Eddie, narrating a 60-90 second spoken morning brief for a small business owner, built entirely from their sales report data below. Open with exactly "Good morning, this is Eddie." as your first sentence, then continue in plain, warm, direct English, second person ("you have..."), as continuous spoken sentences -- no markdown, no headers, no bullet points. State only what is in the data. If a section is empty, missing, or the data looks stale, say so plainly (e.g. "no incidents today") rather than inventing anything. If marketing platform data is provided, briefly mention anything notable (e.g. a campaign spending without results); if no marketing platforms are connected yet, say so plainly rather than skipping the topic silently. End with one clear recommended first action if the data suggests one.`;

function reportDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function stripHtml(html: string): string {
  return String(html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

async function generateSummary(gatewayKey: string, summary: unknown, bodyHtml: string, marketingSnapshots: unknown[]): Promise<string> {
  const marketingSection = marketingSnapshots.length
    ? `Marketing platform snapshots (most recent per platform; only present when connected):\n${JSON.stringify(marketingSnapshots).slice(0, 3000)}`
    : "No marketing platform data is connected yet.";
  const response = await fetch("https://ai-gateway.vercel.sh/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${gatewayKey}`,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: SUMMARY_MODEL,
      max_tokens: 400,
      system: SUMMARY_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Report summary (structured):\n${JSON.stringify(summary ?? {}).slice(0, 4000)}\n\n${marketingSection}\n\nFull report data (HTML, for extra context only):\n${stripHtml(bodyHtml).slice(0, 6000)}`,
        },
      ],
    }),
    signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) throw new Error(`AI Gateway summary ${response.status}: ${(await response.text()).slice(0, 500)}`);

  const data = await response.json();
  const textBlock = (data.content || []).find((block: { type?: string }) => block.type === "text");
  const text = textBlock?.text?.trim();
  if (!text) throw new Error("AI Gateway summary returned no text content");
  return text;
}

async function generateSpeech(gatewayKey: string, text: string): Promise<Uint8Array> {
  const gateway = createGateway({ apiKey: gatewayKey });
  const result = await generateSpeechWithAi({
    model: gateway.speechModel(SPEECH_MODEL),
    text,
    voice: "fable",
    outputFormat: "mp3",
    abortSignal: AbortSignal.timeout(30_000),
  });
  if (!result.audio?.uint8Array?.length) throw new Error("AI Gateway speech returned no audio");
  return result.audio.uint8Array;
}

Deno.serve(async (request) => {
  const unauthorized = await authorizeWebhook(request, "DAILY_VOICE_BRIEF_WEBHOOK_SECRET");
  if (unauthorized) return unauthorized;
  const supabase = serviceClient();

  const { data: config, error: configError } = await supabase
    .from("system_config")
    .select("master_enabled,daily_report_voice_brief_enabled")
    .eq("id", true)
    .single();
  if (configError) return functionError("config_query_failed");
  if (!config.master_enabled || !config.daily_report_voice_brief_enabled) {
    return Response.json({ generated: false, skipped: true, reason: "voice_brief_disabled" });
  }

  const date = reportDate();
  const { data: report, error: reportError } = await supabase
    .from("daily_reports")
    .select("report_date,body_html,summary,voice_brief_status")
    .eq("report_date", date)
    .maybeSingle();
  if (reportError) return functionError("report_query_failed");
  if (!report || !report.body_html) {
    return Response.json({ generated: false, skipped: true, reason: "report_not_ready" });
  }
  if (report.voice_brief_status === "ready") {
    return Response.json({ generated: false, skipped: true, reason: "already_generated" });
  }

  const gatewayKey = Deno.env.get("AI_GATEWAY_API_KEY");
  if (!gatewayKey) {
    await supabase.from("daily_reports").update({
      voice_brief_status: "unavailable",
      voice_brief_error: "AI_GATEWAY_API_KEY is not configured",
    }).eq("report_date", date);
    return Response.json({ generated: false, skipped: true, reason: "gateway_key_missing" });
  }

  // Every step below is independently caught -- a failure here only ever
  // marks this day's voice brief unavailable, it can never touch the
  // columns send-daily-sales-report owns (status/body_html/sent_at), and
  // that function's reliable email path never depends on this one running.
  const { data: marketingSnapshotsRaw } = await supabase
    .from("marketing_performance_snapshots")
    .select("platform,snapshot_date,metrics,error")
    .order("snapshot_date", { ascending: false })
    .limit(12);
  const seenPlatforms = new Set<string>();
  const marketingSnapshots = (marketingSnapshotsRaw || []).filter((row) => {
    if (seenPlatforms.has(row.platform)) return false;
    seenPlatforms.add(row.platform);
    return true;
  });

  let transcript: string;
  try {
    transcript = await generateSummary(gatewayKey, report.summary, report.body_html, marketingSnapshots);
  } catch (error) {
    const message = errorText(error);
    console.error("daily-voice-brief summary generation failed:", message);
    await supabase.from("daily_reports").update({
      voice_brief_status: "unavailable",
      voice_brief_error: message.slice(0, 1000),
    }).eq("report_date", date);
    return Response.json({ generated: false, reason: "summary_failed" });
  }

  let audioBytes: Uint8Array;
  try {
    audioBytes = await generateSpeech(gatewayKey, transcript);
  } catch (error) {
    const message = errorText(error);
    console.error("daily-voice-brief speech generation failed:", message);
    await supabase.from("daily_reports").update({
      voice_brief_status: "unavailable",
      voice_brief_error: message.slice(0, 1000),
      transcript,
    }).eq("report_date", date);
    return Response.json({ generated: false, reason: "speech_failed" });
  }

  const audioPath = `${date}.mp3`;
  const { error: uploadError } = await supabase.storage
    .from(AUDIO_BUCKET)
    .upload(audioPath, audioBytes, { contentType: "audio/mpeg", upsert: true });
  if (uploadError) {
    await supabase.from("daily_reports").update({
      voice_brief_status: "unavailable",
      voice_brief_error: `Storage upload failed: ${uploadError.message}`.slice(0, 1000),
      transcript,
    }).eq("report_date", date);
    return Response.json({ generated: false, reason: "upload_failed" });
  }

  await supabase.from("daily_reports").update({
    audio_url: audioPath,
    transcript,
    voice_brief_status: "ready",
    voice_brief_error: null,
  }).eq("report_date", date);
  return Response.json({ generated: true, report_date: date });
});
