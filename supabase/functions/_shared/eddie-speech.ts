export const DEFAULT_EDDIE_MODEL_ID = "eleven_v3";

export function directEddieSpeech(text: string, modelId = DEFAULT_EDDIE_MODEL_ID) {
  const cleanText = String(text || "").trim().slice(0, modelId.startsWith("eleven_v3") ? 4_800 : 10_000);
  if (!cleanText || !modelId.startsWith("eleven_v3")) return cleanText;
  const needsAttention = /\b(urgent|blocked|blocker|failed|failure|overdue|warning|risk|problem|error)\b/i.test(cleanText);
  const direction = needsAttention
    ? "[focused] [calmly] [with clear urgency]"
    : "[warmly] [engaged] [with lively confidence]";
  return `${direction} ${cleanText}`;
}

export function eddieVoiceSettings(modelId: string) {
  if (modelId.startsWith("eleven_v3")) return undefined;
  return {
    stability: 0.38,
    similarity_boost: 0.8,
    style: 0.05,
    use_speaker_boost: true,
    speed: 1.04,
  };
}
