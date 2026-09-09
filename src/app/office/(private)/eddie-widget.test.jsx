import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import EddieWidget from "./eddie-widget";

vi.mock("next/navigation", () => ({ usePathname: () => "/office/appointments" }));

let container;
let root;

function buttonNamed(name) {
  return [...container.querySelectorAll("button")].find((button) => button.textContent.trim() === name);
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("EddieWidget", () => {
  it("includes the current Office page when asking Eddie", async () => {
    const requests = [];
    vi.stubGlobal("fetch", vi.fn(async (_url, options) => {
      requests.push(JSON.parse(options.body));
      return { ok: true, json: async () => ({ success: true, message: "All clear." }) };
    }));

    await act(async () => root.render(<EddieWidget />));
    await act(async () => buttonNamed("Ask Eddie").dispatchEvent(new MouseEvent("click", { bubbles: true })));
    await act(async () => buttonNamed("Explain this page").dispatchEvent(new MouseEvent("click", { bubbles: true })));

    expect(requests).toHaveLength(1);
    expect(requests[0].messages.at(-1).content).toContain("[Current Office page: Appointments]");
    expect(requests[0].messages.at(-1).content).toContain("Explain this page");
  });
});
