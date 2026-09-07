// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { platformStatus, publishLinkedInPost, SocialPublisherError } from "./social-publishers";

/** @param {Record<string, unknown>} body @param {string} [idHeader] */
function linkedInResponse(body = {}, idHeader) {
  const headers = { "content-type": "application/json" };
  const status = 200;
  if (idHeader) headers["x-restli-id"] = String(idHeader);
  return new Response(JSON.stringify(body), { status, headers });
}

const account = {
  id: "acc_1",
  platform: "linkedin",
  status: "connected",
  write_enabled: true,
  account_type: "company_page",
  provider_id: "1234567",
  destination: "Teamtastic",
  credentials: { access_token: "tok_123" },
};

describe("platformStatus gates", () => {
  it("fails closed when nothing is enabled", () => {
    expect(platformStatus({ platform: "linkedin", account, config: {} })).toMatchObject({ ready: false, reason: "social_publish_not_ready" });
  });

  it("requires the per-platform switch, account write, and connected status", () => {
    const config = { social_master_enabled: true, linkedin_write_enabled: true };
    expect(platformStatus({ platform: "linkedin", account: { ...account, write_enabled: false }, config })).toMatchObject({ ready: false });
    expect(platformStatus({ platform: "linkedin", account: { ...account, status: "disconnected" }, config })).toMatchObject({ ready: false });
  });

  it("only allows platforms with a real connector", () => {
    const config = { social_master_enabled: true, instagram_write_enabled: true };
    expect(platformStatus({ platform: "instagram", account, config })).toMatchObject({ ready: false, reason: "platform_publish_not_supported" });
  });

  it("returns ready only for a fully enabled linkedin account", () => {
    const config = { social_master_enabled: true, linkedin_write_enabled: true };
    expect(platformStatus({ platform: "linkedin", account, config })).toEqual({ ready: true, automated: true, provider: "linkedin" });
  });

  it("marks reddit as manual", () => {
    expect(platformStatus({ platform: "reddit", account, config: {} })).toMatchObject({ ready: false, automated: false, reason: "social_manual_post" });
  });
});

describe("publishLinkedInPost", () => {
  it("posts text to the modern Posts API and returns the provider id", async () => {
    const requests = [];
    const fetchImpl = async (url, options) => {
      requests.push({ url, options });
      if (options.method === "POST" && url.endsWith("/rest/posts")) return linkedInResponse({}, "urn:li:share:abc");
      return linkedInResponse({});
    };
    const result = await publishLinkedInPost({ item: { caption: "Hello world", format: "text", media: [] }, account, fetchImpl });
    expect(result.provider_post_id).toBe("urn:li:share:abc");
    const post = requests.find((r) => r.url.endsWith("/rest/posts"));
    expect(post.options.method).toBe("POST");
    expect(post.options.headers.Authorization).toBe("Bearer tok_123");
    expect(post.options.headers["LinkedIn-Version"]).toBeTruthy();
    expect(JSON.parse(post.options.body)).toMatchObject({ author: "urn:li:organization:1234567", commentary: "Hello world", visibility: "PUBLIC" });
  });

  it("throws when the token is missing", async () => {
    await expect(publishLinkedInPost({ item: { caption: "x", format: "text", media: [] }, account: { ...account, credentials: null } }))
      .rejects.toMatchObject({ code: "social_credential_missing" });
  });

  it("surfaces provider rejections as provider errors, not range errors", async () => {
    const fetchImpl = async () => new Response("{}", { status: 401 });
    await expect(publishLinkedInPost({ item: { caption: "x", format: "text", media: [] }, account, fetchImpl }))
      .rejects.toBeInstanceOf(SocialPublisherError);
  });
});
