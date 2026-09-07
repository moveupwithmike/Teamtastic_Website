// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getOfficeUser, createEddieSpeech, SpeechError } = vi.hoisted(() => ({
  getOfficeUser: vi.fn(),
  createEddieSpeech: vi.fn(),
  SpeechError: class SpeechError extends Error {
    constructor(code, status = 503) {
      super(code);
      this.code = code;
      this.status = status;
    }
  },
}));
vi.mock("@/lib/server/office-auth", () => ({ getOfficeUser: () => getOfficeUser() }));
vi.mock("@/lib/server/office/elevenlabs-speech", () => ({
  createEddieSpeech: (...args) => createEddieSpeech(...args),
  ElevenLabsSpeechError: SpeechError,
}));

function request(body = { text: "Good morning." }, origin = "https://www.teamtastic.events") {
  return new Request("https://www.teamtastic.events/api/office/eddie/speech", {
    method: "POST",
    headers: { "content-type": "application/json", origin, "x-forwarded-for": "203.0.113.90" },
    body: JSON.stringify(body),
  });
}

describe("Eddie speech route", () => {
  beforeEach(() => {
    vi.resetModules();
    getOfficeUser.mockReset();
    createEddieSpeech.mockReset();
    getOfficeUser.mockResolvedValue({ id: "owner-1", email: "michael@teamtastic.events" });
  });

  it("requires the Office login", async () => {
    getOfficeUser.mockResolvedValue(null);
    const { POST } = await import("./route");
    const response = await POST(request());
    expect(response.status).toBe(401);
    expect(createEddieSpeech).not.toHaveBeenCalled();
  });

  it("rejects cross-origin requests", async () => {
    const { POST } = await import("./route");
    const response = await POST(request(undefined, "https://attacker.example"));
    expect(response.status).toBe(403);
  });

  it("streams the selected Eddie voice privately", async () => {
    createEddieSpeech.mockResolvedValue(new Response("audio", {
      status: 200,
      headers: { "content-type": "audio/mpeg" },
    }));
    const { POST } = await import("./route");
    const response = await POST(request({ text: "Two leads need attention." }));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("audio/mpeg");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(createEddieSpeech).toHaveBeenCalledWith("Two leads need attention.");
  });

  it("rejects oversized speech text", async () => {
    const { POST } = await import("./route");
    const response = await POST(request({ text: "x".repeat(4_001) }));
    expect(response.status).toBe(400);
    expect(createEddieSpeech).not.toHaveBeenCalled();
  });
});
