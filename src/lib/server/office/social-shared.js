import "server-only";
import { createHash } from "node:crypto";

// Pure, dependency-free helpers shared by the Social Desk server actions, the
// platform publishers, and Eddie's social actions. No database access here.

export const SOCIAL_PLATFORMS = ["linkedin", "instagram", "facebook", "x", "reddit"];
export const SOCIAL_FORMATS = ["text", "image", "multi_image", "document", "video", "reel", "comment"];
export const SOCIAL_OBJECTIVES = ["awareness", "consideration", "conversion", "engagement", "follow_up"];
export const SOCIAL_VIDEO_TEMPLATES = [
  "reel", "feed_square", "linkedin_demo", "hook_three_points", "before_after",
  "testimonial", "list", "product_demo", "seasonal_announcement",
];

// Manual copy-and-post platforms have no sanctioned API publishing path yet.
export function requiresManualPost(platform) {
  return platform === "reddit";
}

export function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function buildTrackedUrl({ channel, targetPage, campaign, content }) {
  const page = String(targetPage || "/").trim();
  const params = new URLSearchParams({
    utm_source: channel,
    utm_medium: "organic_distribution",
    utm_campaign: campaign || `social_${new Date().toISOString().slice(0, 7).replace("-", "_")}`,
    utm_content: slugify(content || channel),
  });
  return `https://www.teamtastic.events${page.startsWith("/") ? page : `/${page}`}?${params.toString()}`;
}

export function normalizeMedia(media) {
  if (!Array.isArray(media)) return [];
  return media
    .filter((entry) => entry && typeof entry === "object" && entry.path)
    .map((entry) => ({
      bucket: entry.bucket || "distribution-media",
      path: String(entry.path),
      mime: String(entry.mime || ""),
      kind: String(entry.kind || "image"),
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

// Approval-time content binding. Anything here changing after approval will
// produce a different fingerprint and block publishing.
export function socialContentFingerprint(item = {}) {
  return createHash("sha256")
    .update([
      String(item.platform_account_id || ""),
      String(item.format || "text"),
      String(item.caption || ""),
      String(item.hook || ""),
      String(item.cta || ""),
      JSON.stringify(normalizeMedia(item.media)),
      String(item.tracked_url || ""),
      String(item.destination || ""),
    ].join("\n"))
    .digest("hex");
}

// The scheduled time is bound only at schedule/publish time, never at content
// approval time (publish-now approvals do not bind a wall clock).
export function socialScheduleFingerprint(contentFingerprintValue, when) {
  const date = new Date(when);
  if (!Number.isFinite(date.getTime())) return null;
  return createHash("sha256")
    .update([contentFingerprintValue, date.toISOString()].join("\n"))
    .digest("hex");
}