const ELEVENLABS_API = "https://api.elevenlabs.io/v1/text-to-speech";

export const DEFAULT_EDDIE_VOICE_ID = "uznTibduhI714GjhEXrS";
export const DEFAULT_EDDIE_MODEL_ID = "eleven_v3";

export function directEddieSpeech(text, modelId = DEFAULT_EDDIE_MODEL_ID) {
  const cleanText = String(text || "").trim().slice(0, modelId.startsWith("eleven_v3") ? 4_800 : 4_000);
  if (!cleanText || !modelId.startsWith("eleven_v3")) return cleanText;
  const needsAttention = /\b(urgent|blocked|blocker|failed|failure|overdue|warning|risk|problem|error)\b/i.test(cleanText);
  const direction = needsAttention
    ? "[focused] [calmly] [with clear urgency]"
    : "[warmly] [engaged] [with lively confidence]";
  return `${direction} ${cleanText}`;
}

function voiceSettings(modelId) {
  if (modelId.startsWith("eleven_v3")) return undefined;
  return {
    stability: 0.38,
    similarity_boost: 0.8,
    style: 0.05,
    use_speaker_boost: true,
    speed: 1.04,
  };
}

export class ElevenLabsSpeechError extends Error {
  constructor(code, status = 503) {
    super(code);
    this.name = "ElevenLabsSpeechError";
    this.code = code;
    this.status = status;
  }
}

export async function createEddieSpeech(text, { fetchImpl = fetch } = {}) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new ElevenLabsSpeechError("elevenlabs_not_configured");

  const cleanText = String(text || "").trim().slice(0, 4_000);
  if (!cleanText) throw new ElevenLabsSpeechError("speech_text_required", 400);

  const voiceId = process.env.EDDIE_ELEVENLABS_VOICE_ID || DEFAULT_EDDIE_VOICE_ID;
  const modelId = process.env.EDDIE_ELEVENLABS_MODEL_ID || DEFAULT_EDDIE_MODEL_ID;
  const settings = voiceSettings(modelId);
  let response;
  try {
    response = await fetchImpl(`${ELEVENLABS_API}/${encodeURIComponent(voiceId)}/stream?output_format=mp3_44100_128`, {
      method: "POST",
      headers: {
        accept: "audio/mpeg",
        "content-type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text: directEddieSpeech(cleanText, modelId),
        model_id: modelId,
        ...(settings ? { voice_settings: settings } : {}),
      }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new ElevenLabsSpeechError("elevenlabs_unavailable");
  }

  if (!response.ok || !response.body) throw new ElevenLabsSpeechError("elevenlabs_unavailable");
  return response;
}
