import "server-only";
import { requiresManualPost } from "./social-shared";

// Platform publishing adapters. Only LinkedIn has a real, approved connector
// today; every other platform fails closed until its connector is built and
// the exact account is marked write-ready. App-level guarantees (one in-flight
// attempt, content fingerprint at approval, signed confirmation) live in the
// Social Desk and Eddie; this module only talks to the platform.

export class SocialPublisherError extends Error {
  constructor(code, status = 400, message = code) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

// What each platform can hold for an organic post. Used by the UI and by
// preparation checks; it is advisory, not the final publish gate.
export const FORMAT_CAPABILITIES = {
  linkedin: { text: true, image: true, multi_image: true, document: true, video: true, reel: false },
  instagram: { text: true, image: true, multi_image: true, document: false, video: true, reel: true },
  facebook: { text: true, image: true, multi_image: true, document: false, video: true, reel: true },
  x: { text: true, image: true, multi_image: true, document: false, video: true, reel: false },
  reddit: { text: true, image: true, multi_image: true, document: false, video: true, reel: false },
};

export function platformWriteKey(platform) {
  if (platform === "linkedin") return "linkedin_write_enabled";
  if (platform === "instagram") return "instagram_write_enabled";
  if (platform === "facebook") return "facebook_write_enabled";
  if (platform === "x") return "x_write_enabled";
  return null;
}

// The single gate used by both Eddie and the Social Desk before a provider
// call. Everything must be exact before this returns ready: master switch,
// per-platform switch, connected account with write permission, and a real
// connector implementation.
export function platformStatus({ platform, account, config }) {
  if (requiresManualPost(platform)) {
    return { ready: false, automated: false, provider: null, reason: "social_manual_post" };
  }
  if (!config?.social_master_enabled) {
    return { ready: false, automated: true, provider: null, reason: "social_publish_not_ready" };
  }
  const writeKey = platformWriteKey(platform);
  if (!writeKey || !config[writeKey]) {
    return { ready: false, automated: true, provider: null, reason: "social_publish_not_ready" };
  }
  if (!account || !account.write_enabled || account.status !== "connected") {
    return { ready: false, automated: true, provider: null, reason: "social_publish_not_ready" };
  }
  if (platform !== "linkedin") {
    return { ready: false, automated: true, provider: null, reason: "platform_publish_not_supported" };
  }
  return { ready: true, automated: true, provider: "linkedin" };
}

function linkedInVersion() {
  return process.env.LINKEDIN_API_VERSION || "202507";
}

function authorUrn(account) {
  const explicit = account?.credentials?.org_urn || account?.credentials?.person_urn;
  if (explicit) return String(explicit);
  if (account?.provider_id?.startsWith?.("urn:li:")) return account.provider_id;
  if (account?.provider_id) {
    const type = account.account_type === "company_page" ? "organization" : "person";
    return `urn:li:${type}:${account.provider_id}`;
  }
  throw new SocialPublisherError("social_account_urn_missing");
}

/**
 * @param {typeof fetch} fetchImpl
 * @param {string} path
 * @param {{ token?: string, method?: string, json?: any, bytes?: any }} options
 */
async function linkedInJson(fetchImpl, path, { token, method = "GET", json, bytes } = {}) {
  const headers = {
    Authorization: `Bearer ${token}`,
    "LinkedIn-Version": linkedInVersion(),
    Accept: "application/json",
    "X-Restli-Protocol-Version": "2.0",
  };
  let body = undefined;
  if (json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(json);
  } else if (bytes !== undefined) {
    headers["Content-Type"] = "application/octet-stream";
    body = bytes;
  }
  const response = await fetchImpl(`https://api.linkedin.com${path}`, { method, headers, body });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new SocialPublisherError("linkedin_provider_error", response.status, `linkedin_provider_error: ${detail.slice(0, 200)}`);
  }
  if (response.status === 204) return { headers: {}, status: 204 };
  const text = await response.text();
  const result = text ? JSON.parse(text) : {};
  return { headers: Object.fromEntries(response.headers.entries()), status: response.status, json: result };
}

async function initializeUpload(fetchImpl, token, kind, author, extra = {}) {
  const { json } = await linkedInJson(fetchImpl, `/rest/${kind}?action=initializeUpload`, {
    token,
    method: "POST",
    json: { initializeUploadRequest: { owner: author, ...extra } },
  });
  const value = json?.value || {};
  const urn = value[kind === "images" ? "image" : kind === "videos" ? "video" : kind === "documents" ? "document" : "image"];
  const uploadUrl = Array.isArray(value.uploadInstruction)
    ? value.uploadInstruction[0]?.uploadUrl
    : value.uploadUrl;
  if (!urn || !uploadUrl) throw new SocialPublisherError("linkedin_upload_initialize_failed");
  return { urn, uploadUrl };
}

async function mediaUpload(fetchImpl, token, uploadUrl, bytes) {
  const headers = {
    Authorization: `Bearer ${token}`,
    "LinkedIn-Version": linkedInVersion(),
    "Content-Type": "application/octet-stream",
  };
  const response = await fetchImpl(uploadUrl, { method: "PUT", headers, body: bytes });
  if (!response.ok) throw new SocialPublisherError("linkedin_media_upload_failed");
}

export async function verifyLinkedInPost({ token, providerPostId, fetchImpl = fetch }) {
  if (!providerPostId) return false;
  try {
    const { status } = await linkedInJson(fetchImpl, `/rest/posts/${encodeURIComponent(providerPostId)}`, { token, method: "GET" });
    return status === 200;
  } catch {
    return false;
  }
}

// Publishes an item to LinkedIn using the modern Posts API. Returns the
// provider post URN and a best-effort public URL.
export async function publishLinkedInPost({ item, account, fetchImpl = fetch }) {
  const token = account?.credentials?.access_token;
  if (!token) throw new SocialPublisherError("social_credential_missing");
  const author = authorUrn(account);
  const caption = String(item.caption || item.body_text || "");
  const media = Array.isArray(item.media) ? item.media : [];
  const format = item.format || "text";

  let content = undefined;
  if (["image", "multi_image"].includes(format)) {
    const mediaKind = format === "image" ? "images" : "images";
    const urns = [];
    for (const asset of media) {
      const { urn, uploadUrl } = await initializeUpload(fetchImpl, token, mediaKind, author);
      await mediaUpload(fetchImpl, token, uploadUrl, await readAssetBytes(asset));
      urns.push(urn);
    }
    content = urns.length === 1 ? { media: { id: urns[0], altText: caption.slice(0, 80) } } : { media: { images: urns.map((id) => ({ id })) } };
  } else if (format === "document") {
    const { urn, uploadUrl } = await initializeUpload(fetchImpl, token, "documents", author);
    await mediaUpload(fetchImpl, token, uploadUrl, await readAssetBytes(media[0]));
    await linkedInJson(fetchImpl, "/rest/documents?action=finalizeUpload", {
      token, method: "POST", json: { finalizeUploadRequest: { document: urn, recipe: "urn:li:digitalmedia:recipes:templateddocument" } },
    });
    content = { mention: { id: urn }, media: { title: caption.slice(0, 200) } };
  } else if (["video", "reel"].includes(format)) {
    const asset = media[0];
    const { urn, uploadUrl } = await initializeUpload(fetchImpl, token, "videos", author, {
      fileSizeBytes: asset?.bytes || asset?.size || 0,
      uploadCaptions: false,
      uploadTitle: caption.slice(0, 120),
      uploadDescription: "",
    });
    await mediaUpload(fetchImpl, token, uploadUrl, await readAssetBytes(asset));
    await linkedInJson(fetchImpl, "/rest/videos?action=finalizeUpload", {
      token, method: "POST", json: { finalizeUploadRequest: { video: urn } },
    });
    content = { media: { id: urn } };
  }

  const post = {
    author,
    commentary: caption,
    visibility: "PUBLIC",
    distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
  };
  if (content) post.content = content;

  const response = await linkedInJson(fetchImpl, "/rest/posts", { token, method: "POST", json: post });
  const providerPostId = response.headers?.["x-restli-id"] || response.json?.id || response.json?.post;
  if (!providerPostId) throw new SocialPublisherError("linkedin_post_id_missing");
  return {
    provider: "linkedin",
    provider_post_id: providerPostId,
    provider_url: `https://www.linkedin.com/feed/update/${providerPostId}`,
  };
}

// Dispatches an item to its provider after the platformStatus gate. Manual
// platforms must go through the Office copy-and-post flow and never call here.
export async function publishToPlatform({ item, account, config, fetchImpl = fetch }) {
  const status = platformStatus({ platform: item.channel || item.platform, account, config });
  if (!status.ready) throw new SocialPublisherError(status.reason, 409);
  if (status.provider === "linkedin") return publishLinkedInPost({ item, account, fetchImpl });
  throw new SocialPublisherError("platform_publish_not_supported");
}

async function readAssetBytes(asset) {
  // The Office / Eddie layer resolves storage objects to bytes before calling
  // the publisher. Non-bytes references cannot reach the provider.
  if (asset?.bytes) return asset.bytes instanceof Uint8Array ? Buffer.from(asset.bytes) : asset.bytes;
  throw new SocialPublisherError("social_media_missing");
}
