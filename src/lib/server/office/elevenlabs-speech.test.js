import { afterEach, describe, expect, it, vi } from "vitest";
import { createEddieSpeech, DEFAULT_EDDIE_MODEL_ID, DEFAULT_EDDIE_VOICE_ID, directEddieSpeech, ElevenLabsSpeechError } from "./elevenlabs-speech";

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
      text: "[warmly] [engaged] [with lively confidence] Good morning, Michael.",
      model_id: DEFAULT_EDDIE_MODEL_ID,
    });
    expect(JSON.parse(init.body)).not.toHaveProperty("voice_settings");
  });

  it("uses restrained stage directions only with expressive v3 models", () => {
    expect(directEddieSpeech("The campaign is paused.", "eleven_v3"))
      .toBe("[warmly] [engaged] [with lively confidence] The campaign is paused.");
    expect(directEddieSpeech("The campaign is paused.", "eleven_flash_v2_5"))
      .toBe("The campaign is paused.");
  });

  it("responds to serious content without sounding falsely cheerful", () => {
    expect(directEddieSpeech("Two urgent blockers need attention.", "eleven_v3"))
      .toBe("[focused] [calmly] [with clear urgency] Two urgent blockers need attention.");
  });

  it("gives low-latency models livelier but controlled settings", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "private-test-key");
    vi.stubEnv("EDDIE_ELEVENLABS_MODEL_ID", "eleven_flash_v2_5");
    const fetchImpl = vi.fn().mockResolvedValue(new Response("audio", { status: 200 }));

    await createEddieSpeech("Status", { fetchImpl });

    expect(JSON.parse(fetchImpl.mock.calls[0][1].body).voice_settings).toEqual({
      stability: 0.38,
      similarity_boost: 0.8,
      style: 0.05,
      use_speaker_boost: true,
      speed: 1.04,
    });
  });

  it("returns a safe provider error", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "private-test-key");
    const fetchImpl = vi.fn().mockResolvedValue(new Response("no", { status: 429 }));
    await expect(createEddieSpeech("Status", { fetchImpl })).rejects.toBeInstanceOf(ElevenLabsSpeechError);
  });
});
