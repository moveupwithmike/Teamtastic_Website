// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

function readSource(relativePath) {
  return readFileSync(fileURLToPath(new URL(`../../${relativePath}`, import.meta.url)), "utf8");
}

const PLACEHOLDER_PATTERN = /(?:\bTODO\b|\bTBD\b|\[YOUR|\[Name|\[Company|\bLorem\b|\bXXX\b)/i;

describe("policy pages", () => {
  const pages = [
    { file: "src/app/privacy/page.js", canonical: "https://teamtastic.events/privacy" },
    { file: "src/app/terms/page.js", canonical: "https://teamtastic.events/terms" },
    { file: "src/app/cancellation-policy/page.js", canonical: "https://teamtastic.events/cancellation-policy" },
  ];

  for (const page of pages) {
    it(`serve real, canonical, placeholder-free legal content (${page.canonical})`, () => {
      const source = readSource(page.file);
      expect(source).toContain('canonical: "');
      expect(source).toContain(page.canonical);
      expect(source).toContain("PolicyShell");
      expect(source).toContain('updated="August 29, 2026"');
      expect(source).not.toMatch(PLACEHOLDER_PATTERN);
    });
  }

  it("renders the shared policy shell with an explicit last-updated marker", () => {
    const source = readSource("src/components/PolicyShell.js");
    expect(source).toContain("Last updated");
  });

  it("cancellation policy renders the refund schedule from the single source of truth", () => {
    const source = readSource("src/app/cancellation-policy/page.js");
    expect(source).toContain('CANCELLATION_POLICY_TABLE');
    expect(source).toContain('CANCELLATION_POLICY_TABLE.map');
  });
});

describe("footer legal navigation", () => {
  const source = readSource("src/components/Footer.js");

  it("links every policy page, keeps the support mailto, and contains no dead placeholder links", () => {
    expect(source).toContain('href="/privacy"');
    expect(source).toContain('href="/terms"');
    expect(source).toContain('href="/cancellation-policy"');
    expect(source).toContain("mailto:hello@teamtastic.events");
    expect(source).not.toMatch(/href="#/);
  });

  it("links to the seasonal themes hub", () => {
    expect(source).toContain('href="/themes"');
  });

  it("never renders a non-clickable fake legal link alongside the real one (regression: duplicate stale footer block)", () => {
    // The bug this guards: a leftover second copyright row with dead
    // `<span>Privacy Policy</span>` / `<span>Terms of Service</span>` (no
    // href at all) rendered right below the real, working links.
    expect(source).not.toMatch(/>\s*Privacy Policy\s*<\/span>/);
    expect(source).not.toMatch(/>\s*Terms of Service\s*<\/span>/);
    expect(source).not.toContain("© 2024");
    expect(source).not.toMatch(/&copy;\s*2024/);
  });

  it("renders each real policy link exactly once per footer variant (no duplicate copyright rows)", () => {
    // Two return branches exist in this component (experiences-page footer,
    // default footer) — each should contain exactly one working Privacy link.
    const privacyLinkCount = (source.match(/href="\/privacy"/g) || []).length;
    expect(privacyLinkCount).toBe(2);
  });
});

describe("lead-form embedded consent", () => {
  it("every lead capture surface references the privacy policie(s) and offers an opt-out", () => {
    for (const file of [
      "src/components/CorporateLeadForm.js",
      "src/components/TalkToMichaelModal.js",
      "src/components/GameQuiz.js",
      "src/components/HolidayChecklistForm.js",
      "src/components/SoloDemo.js",
    ]) {
      const source = readSource(file);
      expect(source, `${file} should link the privacy policy`).toContain('href="/privacy"');
      expect(source, `${file} should link the terms`).toContain('href="/terms"');
      expect(source.match(/opt out anytime/i), `${file} should state an opt-out`).toBeTruthy();
    }
  });
});