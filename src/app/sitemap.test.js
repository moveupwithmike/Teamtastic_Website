// @vitest-environment node
import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import { THEMES } from "@/lib/themes";
import { POSTS } from "@/lib/blog-posts";
import gamesPool from "@/lib/gamesData.json";

describe("sitemap", () => {
  it("includes the themes hub and every live theme route", () => {
    const urls = sitemap().map((entry) => entry.url);
    expect(urls).toContain("https://teamtastic.events/themes");
    for (const theme of THEMES) {
      expect(urls).toContain(`https://teamtastic.events/themes/${theme.slug}`);
    }
  });

  it("uses each theme's real content date rather than a shared fabricated date for theme pages", () => {
    for (const theme of THEMES) {
      const entry = sitemap().find((e) => e.url === `https://teamtastic.events/themes/${theme.slug}`);
      expect(entry).toBeTruthy();
      expect(entry.lastModified).toBe(theme.seo.lastModified);
      expect(entry.changeFrequency).toBe(theme.seo.changeFrequency);
      expect(entry.priority).toBe(theme.seo.priority);
    }
  });

  it("emits no duplicate routes", () => {
    const urls = sitemap().map((entry) => entry.url);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("includes the legal policy pages with honest last-modified dates", () => {
    const urls = sitemap().map((entry) => entry.url);
    expect(urls).toContain("https://teamtastic.events/privacy");
    expect(urls).toContain("https://teamtastic.events/terms");
    expect(urls).toContain("https://teamtastic.events/cancellation-policy");
    for (const route of ["/privacy", "/terms", "/cancellation-policy"]) {
      const entry = sitemap().find((e) => e.url === `https://teamtastic.events${route}`);
      expect(entry?.lastModified).toBe("2026-08-29");
    }
  });

  it("derives blog lastModified from each post's own tracked date, not a fabricated shared date", () => {
    const entries = sitemap();
    for (const post of POSTS) {
      const entry = entries.find((e) => e.url === `https://teamtastic.events/blog/${post.slug}`);
      expect(entry).toBeTruthy();
      const expected = new Date(post.date).toISOString().split("T")[0];
      expect(entry.lastModified).toBe(expected);
    }
    // Two posts published on different real dates must not collapse to one shared value.
    const dates = new Set(entries.filter((e) => e.url.includes("/blog/")).map((e) => e.lastModified));
    expect(dates.size).toBeGreaterThan(1);
  });

  it("omits lastModified for pages with no genuinely tracked update date, instead of fabricating today's date", () => {
    const entries = sitemap();
    const homepage = entries.find((e) => e.url === "https://teamtastic.events");
    expect(homepage.lastModified).toBeUndefined();

    const firstGame = gamesPool[0];
    const gameEntry = entries.find((e) => e.url === `https://teamtastic.events/games/${firstGame.slug}`);
    expect(gameEntry).toBeTruthy();
    expect(gameEntry.lastModified).toBeUndefined();
  });

  it("never emits today's date as a fabricated lastModified for undated routes", () => {
    const today = new Date().toISOString().split("T")[0];
    const undatedUrls = ["https://teamtastic.events", "https://teamtastic.events/pricing", "https://teamtastic.events/games"];
    for (const entry of sitemap()) {
      if (undatedUrls.includes(entry.url)) {
        expect(entry.lastModified).not.toBe(today);
      }
    }
  });
});