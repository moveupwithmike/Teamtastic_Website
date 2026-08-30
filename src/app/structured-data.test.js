// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

function readSource(relativePath) {
  return readFileSync(fileURLToPath(new URL(`../../${relativePath}`, import.meta.url)), "utf8");
}

describe("Organization JSON-LD — single source of truth", () => {
  it("is declared exactly once, site-wide, in layout.js", () => {
    const layout = readSource("src/app/layout.js");
    const occurrences = (layout.match(/"@type":\s*"Organization"/g) || []).length;
    expect(occurrences).toBe(1);
  });

  it("is not duplicated as a competing top-level entity on the homepage (regression: two conflicting Organization entities on /)", () => {
    // A nested `provider: { "@type": "Organization", ... }` reference inside
    // the Service schema is fine and expected — this only guards against a
    // second full, top-level Organization object (its own "@context" +
    // "@type": "Organization" pair) competing with the one in layout.js.
    const homepage = readSource("src/app/page.js");
    expect(homepage).not.toMatch(/"@context":\s*"https:\/\/schema\.org",\s*\n\s*"@type":\s*"Organization"/);
  });
});
