// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const getOfficeUser = vi.fn();
vi.mock("@/lib/server/office-auth", () => ({ getOfficeUser: () => getOfficeUser() }));

function request({ origin = "https://www.teamtastic.events", body = "v=0\r\n" } = {}) {
  return new Request("https://www.teamtastic.events/api/office/eddie/realtime", {
    method: "POST",
    headers: { "content-type": "application/sdp", origin, "x-forwarded-for": "203.0.113.80" },
    body,
  });
}

describe("Eddie Realtime session", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("OPENAI_API_KEY", "test-openai-key");
    getOfficeUser.mockResolvedValue({ id: "owner-1", email: "michael@teamtastic.events" });
  });

  it("requires an authenticated Office user", async () => {
    getOfficeUser.mockResolvedValue(null);
    const { POST } = await import("./route");
    const response = await POST(request());
    expect(response.status).toBe(401);
  });

  it("rejects cross-origin session creation", async () => {
    const { POST } = await import("./route");
    const response = await POST(request({ origin: "https://attacker.example" }));
    expect(response.status).toBe(403);
    expect(getOfficeUser).not.toHaveBeenCalled();
  });

  it("does not expose or send a session when the server key is missing", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { POST } = await import("./route");
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ success: false, reason: "realtime_not_configured" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("creates a protected unified WebRTC session", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("v=0\r\na=answer", { status: 200 }));
    const { POST } = await import("./route");
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/sdp");
    expect(await response.text()).toContain("a=answer");

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/realtime/calls");
    const headers = new Headers(init.headers);
    const form = /** @type {FormData} */ (init.body);
    expect(headers.get("authorization")).toBe("Bearer test-openai-key");
    expect(headers.get("OpenAI-Safety-Identifier")).toHaveLength(64);
    expect(form.get("sdp")).toContain("v=0");
    const session = JSON.parse(String(form.get("session")));
    expect(session.audio.input.turn_detection).toMatchObject({ create_response: false, interrupt_response: true });
    expect(session.audio.output.voice).toBe("marin");
  });
});
