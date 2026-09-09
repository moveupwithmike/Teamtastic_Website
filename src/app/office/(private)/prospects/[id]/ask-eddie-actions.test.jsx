import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AskEddieActions from "./ask-eddie-actions";

let container;
let root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("AskEddieActions", () => {
  it("targets the exact prospect and deal instead of relying on a name", async () => {
    const listener = vi.fn();
    window.addEventListener("office:ask-eddie", listener);
    await act(async () => root.render(<AskEddieActions label="Alex Smith" prospectId="prospect-123" openDeals={[{ id: "deal-456", title: "Family reunion" }]} />));

    const proposalButton = [...container.querySelectorAll("button")].find((button) => button.textContent.trim() === "Prepare proposal");
    await act(async () => proposalButton.dispatchEvent(new MouseEvent("click", { bubbles: true })));

    expect(listener).toHaveBeenCalledOnce();
    expect(listener.mock.calls[0][0].detail.question).toContain("prospect ID prospect-123");
    expect(listener.mock.calls[0][0].detail.question).toContain("deal ID deal-456");
    window.removeEventListener("office:ask-eddie", listener);
  });
});
