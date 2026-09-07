import { afterEach, describe, expect, it, vi } from "vitest";
import { createEddieSpeech, DEFAULT_EDDIE_VOICE_ID, ElevenLabsSpeechError } from "./elevenlabs-speech";

describe("Eddie ElevenLabs speech", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("requires the private ElevenLabs key", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "");
    await expect(createEddieSpeech("Good morning.")).rejects.toMatchObject({
      code: "elevenlabs_not_configured",
      status: 503,
    });
  });

  it("uses Eddie's selected voice without exposing the key", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "private-test-key");
    vi.stubEnv("EDDIE_ELEVENLABS_VOICE_ID", "");
    const fetchImpl = vi.fn().mockResolvedValue(new Response("audio", {
      status: 200,
      headers: { "content-type": "audio/mpeg" },
    }));

    const response = await createEddieSpeech("Good morning, Michael.", { fetchImpl });
    expect(response.ok).toBe(true);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toContain(`/text-to-speech/${DEFAULT_EDDIE_VOICE_ID}/stream`);
    expect(init.headers["xi-api-key"]).toBe("private-test-key");
    expect(JSON.parse(init.body)).toMatchObject({
      text: "Good morning, Michael.",
      model_id: "eleven_flash_v2_5",
    });
  });

  it("returns a safe provider error", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "private-test-key");
    const fetchImpl = vi.fn().mockResolvedValue(new Response("no", { status: 429 }));
    await expect(createEddieSpeech("Status", { fetchImpl })).rejects.toBeInstanceOf(ElevenLabsSpeechError);
  });
});
