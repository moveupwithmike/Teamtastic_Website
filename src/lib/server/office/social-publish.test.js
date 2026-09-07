// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseAdminMock } from "@/test/supabase-admin-mock";
import { attemptSocialPublish } from "./social-publish";
import { socialContentFingerprint, socialScheduleFingerprint } from "./social-shared";

vi.mock("server-only", () => ({}));

const account = {
  id: "acc_1",
  platform: "linkedin",
  status: "connected",
  write_enabled: true,
  account_type: "organization",
  provider_id: "1234567",
  destination: "Teamtastic",
  credentials: { access_token: "tok_123" },
};

const config = { social_master_enabled: true, linkedin_write_enabled: true };

function item(overrides = {}) {
  return {
    id: "item_1",
    channel: "linkedin",
    platform: "linkedin",
    format: "text",
    title: "Virtual holiday party",
    caption: "Teams love this.",
    hook: "",
    cta: "",
    media: [],
    destination: "Teamtastic",
    target_page: "/virtual-holiday-party",
    tracked_url: "https://www.teamtastic.events/virtual-holiday-party",
    status: "approved",
    approved_fingerprint: null,
    scheduled_fingerprint: null,
    scheduled_for: null,
    platform_account_id: "acc_1",
    ...overrides,
  };
}

function providerFetch() {
  return vi.fn(async (url, options) => {
    if (options.method === "POST" && url.endsWith("/rest/posts")) {
      return new Response(JSON.stringify({}), { status: 200, headers: { "content-type": "application/json", "x-restli-id": "urn:li:share:live_1" } });
    }
    return new Response(JSON.stringify({}), { status: 200, headers: { "content-type": "application/json" } });
  });
}

function makeDb({ claimed = false, prior = null, itemError = null } = {}) {
  const started = claimed ? [{ id: 1, distribution_item_id: "item_1", status: "started" }] : [];
  const completed = prior ? [{ id: 2, distribution_item_id: "item_1", status: "completed", provider_post_id: prior.provider_post_id, provider_url: prior.provider_url, created_at: "2026-09-01T10:00:00.000Z", completed_at: "2026-09-01T10:00:00.000Z" }] : [];
  const updatedItems = [];
  return {
    db: createSupabaseAdminMock({
      tables: {
        distribution_publishing_log: ({ calls, eqValue }) => {
          if (calls.some((c) => c.method === "insert")) {
            if (claimed) return { data: null, error: { code: "23505", message: "duplicate" } };
            started.length = 0;
            started.push({ id: 1, distribution_item_id: eqValue?.("distribution_item_id") || "item_1", status: "started", ...Object.fromEntries(calls.find((c) => c.method === "insert").args[0] ? Object.entries(calls.find((c) => c.method === "insert").args[0]) : []) });
            return { data: null, error: null };
          }
          if (calls.some((c) => c.method === "update")) {
            const patch = calls.find((c) => c.method === "update").args[0];
            const target = started[0] || completed[0];
            if (target) Object.assign(target, patch, { distribution_item_id: eqValue("distribution_item_id") });
            return { data: { ...target }, error: null };
          }
          const row = completed.find((r) => r.distribution_item_id === eqValue("distribution_item_id"));
          return { data: row || null, error: null };
        },
        distribution_items: ({ calls, eqValue }) => {
          if (calls.some((c) => c.method === "update")) {
            const patch = calls.find((c) => c.method === "update").args[0];
            updatedItems.push({ where: { id: eqValue("id"), status: eqValue("status") }, patch });
            return { data: { id: eqValue("id"), ...patch }, error: itemError };
          }
          return { data: null, error: null };
        },
        distribution_item_events: () => ({ data: null, error: null }),
      },
    }),
    started,
    completed,
    updatedItems,
  };
}

describe("attemptSocialPublish", () => {
  let fetchImpl;
  beforeEach(() => { fetchImpl = providerFetch(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it("publishes a text post end to end and returns the provider ids", async () => {
    const itemRow = item({ status: "approved", approved_fingerprint: socialContentFingerprint(item()) });
    const { db, started, updatedItems } = makeDb();
    const result = await attemptSocialPublish({ db, item: itemRow, account, config, trigger: "office", actor: "michael@teamtastic.com", fetchImpl });
    expect(result).toMatchObject({ published: true, reconciled: false, providerPostId: "urn:li:share:live_1" });
    expect(started[0].status).toBe("completed");
    expect(updatedItems).toHaveLength(1);
    expect(updatedItems[0].patch).toMatchObject({ status: "published", provider_post_id: "urn:li:share:live_1" });
  });

  it("blocks when content changed since approval", async () => {
    const itemRow = item({ status: "approved", approved_fingerprint: socialContentFingerprint(item({ caption: "other" })) });
    const { db } = makeDb();
    await expect(attemptSocialPublish({ db, item: itemRow, account, config, fetchImpl })).rejects.toMatchObject({ code: "social_content_changed" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("refuses a scheduled post before its exact time", async () => {
    const contentFp = socialContentFingerprint(item());
    const scheduledAt = new Date(Date.now() + 3600000).toISOString();
    const itemRow = item({
      status: "scheduled",
      scheduled_for: scheduledAt,
      approved_fingerprint: contentFp,
      scheduled_fingerprint: socialScheduleFingerprint(contentFp, scheduledAt),
    });
    const { db } = makeDb();
    await expect(attemptSocialPublish({ db, item: itemRow, account, config, fetchImpl })).rejects.toMatchObject({ code: "social_not_yet_due" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("recognizes an in-flight attempt instead of double-posting", async () => {
    const itemRow = item({ status: "approved", approved_fingerprint: socialContentFingerprint(item()) });
    const { db } = makeDb({ claimed: true });
    await expect(attemptSocialPublish({ db, item: itemRow, account, config, fetchImpl })).rejects.toMatchObject({ code: "social_publish_already_started" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("marks the item publish_failed when the provider rejects", async () => {
    fetchImpl = vi.fn(async () => new Response("{}", { status: 401 }));
    const itemRow = item({ status: "approved", approved_fingerprint: socialContentFingerprint(item()) });
    const { db, updatedItems } = makeDb();
    const failure = await attemptSocialPublish({ db, item: itemRow, account, config, fetchImpl }).then(() => null, (error) => error);
    expect(failure.code).toBe("social_publish_failed");
    expect(updatedItems.some((u) => u.patch.status === "publish_failed")).toBe(true);
  });

  it("reconciles a verified prior publish instead of re-posting", async () => {
    const prior = { provider_post_id: "urn:li:share:old_1", provider_url: "https://www.linkedin.com/feed/update/urn:li:share:old_1" };
    const fetchImplForVerify = vi.fn(async (url, options) => {
      if (options.method === "GET" && url.includes("/rest/posts/")) {
        return new Response(JSON.stringify({}), { status: 200, headers: { "content-type": "application/json" } });
      }
      return new Response(JSON.stringify({}), { status: 200, headers: { "content-type": "application/json" } });
    });
    const itemRow = item({ status: "approved", approved_fingerprint: socialContentFingerprint(item()) });
    const { db, updatedItems } = makeDb({ prior });
    const result = await attemptSocialPublish({ db, item: itemRow, account, config, fetchImpl: fetchImplForVerify });
    expect(result).toMatchObject({ published: true, reconciled: true, providerPostId: "urn:li:share:old_1" });
    expect(updatedItems[0].patch).toMatchObject({ status: "published", provider_post_id: "urn:li:share:old_1" });
    expect(fetchImplForVerify.mock.calls.filter(([, options]) => options.method === "POST")).toHaveLength(0);
  });
});