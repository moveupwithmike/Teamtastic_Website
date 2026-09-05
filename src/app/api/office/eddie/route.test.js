// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const getOfficeUser = vi.fn();
vi.mock("@/lib/server/office-auth", () => ({ getOfficeUser: () => getOfficeUser() }));

const db = { private: true };
vi.mock("@/lib/server/supabase-admin", () => ({ getSupabaseAdmin: () => db }));

const askEddie = vi.fn();
const executeEddieAction = vi.fn();
class EddieError extends Error {
  constructor(code, status = 400) { super(code); this.code = code; this.status = status; }
}
vi.mock("@/lib/server/office/eddie", () => ({
  askEddie: (...args) => askEddie(...args),
  executeEddieAction: (...args) => executeEddieAction(...args),
  EddieError,
}));

function request(body, { origin = "https://www.teamtastic.events", ip = "203.0.113.40" } = {}) {
  return new Request("https://www.teamtastic.events/api/office/eddie", {
    method: "POST",
    headers: { "content-type": "application/json", origin, "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

describe("Eddie Office API", () => {
  beforeEach(() => {
    vi.resetModules();
    getOfficeUser.mockReset();
    askEddie.mockReset();
    executeEddieAction.mockReset();
  });

  it("requires an authenticated allowed Office user", async () => {
    getOfficeUser.mockResolvedValue(null);
    const { POST } = await import("./route");
    const response = await POST(request({ messages: [{ role: "user", content: "Hello" }] }, { ip: "203.0.113.41" }));
    expect(response.status).toBe(401);
    expect(askEddie).not.toHaveBeenCalled();
  });

  it("rejects cross-origin browser requests before authentication", async () => {
    const { POST } = await import("./route");
    const response = await POST(request({}, { origin: "https://attacker.example", ip: "203.0.113.42" }));
    expect(response.status).toBe(403);
    expect(getOfficeUser).not.toHaveBeenCalled();
  });

  it("passes a conversation to the read-only planning path", async () => {
    const user = { id: "owner_1", email: "michael@teamtastic.com" };
    getOfficeUser.mockResolvedValue(user);
    askEddie.mockResolvedValue({ message: "Two leads need attention.", pendingAction: null });
    const { POST } = await import("./route");
    const messages = [{ role: "user", content: "What needs attention?" }];
    const response = await POST(request({ mode: "chat", messages }, { ip: "203.0.113.43" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, message: "Two leads need attention.", pendingAction: null });
    expect(askEddie).toHaveBeenCalledWith({ db, user, messages });
  });

  it("uses a separate confirmation request to execute a signed action", async () => {
    const user = { id: "owner_1", email: "michael@teamtastic.com" };
    getOfficeUser.mockResolvedValue(user);
    executeEddieAction.mockResolvedValue({ message: "Done. I created the task." });
    const { POST } = await import("./route");
    const response = await POST(request({ mode: "execute", token: "signed.token" }, { ip: "203.0.113.44" }));
    expect(response.status).toBe(200);
    expect(executeEddieAction).toHaveBeenCalledWith({ db, user, token: "signed.token" });
    expect(askEddie).not.toHaveBeenCalled();
  });

  it("returns only a safe Eddie error code", async () => {
    getOfficeUser.mockResolvedValue({ id: "owner_1", email: "michael@teamtastic.com" });
    askEddie.mockRejectedValue(new EddieError("sales_data_unavailable", 503));
    const { POST } = await import("./route");
    const response = await POST(request({ messages: [{ role: "user", content: "Status?" }] }, { ip: "203.0.113.45" }));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ success: false, reason: "sales_data_unavailable" });
  });
});
