// @vitest-environment node
import { describe, expect, it } from "vitest";
import { POSTS } from "@/lib/blog-posts";
import gamesPool from "@/lib/gamesData.json";
import { THEMES, THEME_CATEGORIES, themeBySlug, themesByCategory } from "@/lib/themes";

const GAME_SLUGS = new Set(gamesPool.map((game) => game.slug));
const POST_SLUGS = new Set(POSTS.map((post) => post.slug));
const CATEGORY_KEYS = new Set(THEME_CATEGORIES.map((category) => category.key));

describe("theme taxonomy", () => {
  it("defines non-empty, valid categories", () => {
    expect(THEME_CATEGORIES.length).toBeGreaterThanOrEqual(2);
    for (const category of THEME_CATEGORIES) {
      expect(category.key).toMatch(/^[a-z]+$/);
      expect(category.label.length).toBeGreaterThan(3);
    }
  });

  it("places every theme in a declared category", () => {
    for (const theme of THEMES) {
      expect(CATEGORY_KEYS.has(theme.category)).toBe(true);
    }
  });

  it("filters by category without dropping themes", () => {
    const seen = new Set();
    for (const theme of THEMES) {
      const inOwnCategory = themesByCategory(theme.category).includes(theme);
      expect(inOwnCategory, `${theme.slug} appears in its declared category`).toBe(true);
      seen.add(theme.slug);
    }
    for (const theme of THEMES) {
      expect(seen.has(theme.slug)).toBe(true);
    }
  });
});

describe("theme identity and routing", () => {
  it("exposes themeBySlug for every defined theme", () => {
    for (const theme of THEMES) {
      expect(themeBySlug(theme.slug)).toBe(theme);
    }
    expect(themeBySlug("does-not-exist")).toBeNull();
  });

  it("uses unique, URL-safe slugs", () => {
    const slugs = THEMES.map((theme) => theme.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) {
      expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it("provides the fields a dynamic route needs", () => {
    for (const theme of THEMES) {
      expect(theme).toHaveProperty("name");
      expect(theme).toHaveProperty("title");
      expect(theme).toHaveProperty("metaTitle");
      expect(theme).toHaveProperty("metaDescription");
      expect(theme.metaTitle.length).toBeGreaterThan(20);
      expect(theme.metaDescription.length).toBeGreaterThanOrEqual(70);
      expect(theme.metaDescription.length).toBeLessThanOrEqual(170);
      expect(theme).toHaveProperty("eyebrow");
      expect(theme).toHaveProperty("intro");
      expect(theme).toHaveProperty("summary");
      expect(theme.summary.length).toBeGreaterThanOrEqual(3);
      expect(theme).toHaveProperty("benefits");
      expect(theme.benefits.length).toBeGreaterThanOrEqual(4);
      expect(theme).toHaveProperty("faqs");
      expect(theme.faqs.length).toBeGreaterThanOrEqual(4);
    }
  });
});

describe("theme SEO/AEO content", () => {
  it("front-loads a self-contained direct answer as the intro", () => {
    for (const theme of THEMES) {
      const words = theme.intro.split(/\s+/).length;
      // 2026 AI-answer guidance: a complete, extractable answer early in the page.
      expect(words, `${theme.slug} intro should be 45–90 words`).toBeGreaterThanOrEqual(45);
      expect(words, `${theme.slug} intro should be 45–90 words`).toBeLessThanOrEqual(90);
    }
  });

  it("writes FAQ answers that stand alone (no cross-references)", () => {
    for (const theme of THEMES) {
      for (const faq of theme.faqs) {
        expect(faq.q.endsWith("?")).toBe(true);
        expect(faq.a.length).toBeGreaterThan(60);
        expect(faq.a).not.toMatch(/\bsee above\b|\bas mentioned\b/i);
        expect(faq.a.length).toBeLessThan(450);
      }
    }
  });

  it("keeps sitemap metadata honest and well-formed", () => {
    for (const theme of THEMES) {
      expect(theme.seo.lastModified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(`${theme.seo.lastModified}T00:00:00Z`))).toBe(false);
      expect(["weekly", "daily", "monthly", "yearly", "always"].includes(theme.seo.changeFrequency)).toBe(true);
      expect(theme.seo.priority).toBeGreaterThanOrEqual(0.5);
      expect(theme.seo.priority).toBeLessThanOrEqual(1);
    }
  });
});

describe("theme internal links resolve", () => {
  it("maps every top-game to a real game in the catalog", () => {
    for (const theme of THEMES) {
      expect(theme.topGames.length).toBeGreaterThanOrEqual(5);
      for (const { slug } of theme.topGames) {
        expect(GAME_SLUGS.has(slug), `${theme.slug} references missing game ${slug}`).toBe(true);
      }
    }
  });

  it("never claims a game count in the title that doesn't match the actual games shown", () => {
    for (const theme of THEMES) {
      const match = theme.title.match(/(\d+)\s+Games?\b/i);
      if (match) {
        expect(Number(match[1]), `${theme.slug} title claims ${match[1]} games but lists ${theme.topGames.length}`)
          .toBe(theme.topGames.length);
      }
    }
  });

  it("maps every related article to a real blog post", () => {
    for (const theme of THEMES) {
      for (const slug of theme.relatedArticles || []) {
        expect(POST_SLUGS.has(slug), `${theme.slug} references missing post ${slug}`).toBe(true);
      }
    }
  });

  it("maps every related theme to another live theme (hub cross-links)", () => {
    for (const theme of THEMES) {
      for (const slug of theme.relatedThemes || []) {
        expect(slug, `${theme.slug} cannot link to itself`).not.toBe(theme.slug);
        expect(themeBySlug(slug), `${theme.slug} references missing theme ${slug}`).not.toBeNull();
      }
    }
  });
});

describe("theme lead capture attribution", () => {
  it("gives every theme a unique lead source that is sanctioned elsewhere", () => {
    const sources = THEMES.map((theme) => theme.form.source);
    expect(new Set(sources).size).toBe(sources.length);
    for (const source of sources) {
      expect(source).toMatch(/^theme_[a-z0-9_]+$/);
    }
  });

  it("uses a valid default occasion from the form vocabulary", () => {
    const valid = new Set(["social-hour", "holiday", "onboarding", "private-milestone"]);
    for (const theme of THEMES) {
      expect(valid.has(theme.form.defaultOccasion), `${theme.slug} occasion must be a form value`).toBe(true);
    }
  });

  it("assigns an inline entry point per theme", () => {
    for (const theme of THEMES) {
      expect(theme.form.entryPoint).toBe(`${theme.form.source}_inline`);
    }
  });
});