// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { createSupabaseAdminMock } from "@/test/supabase-admin-mock";
import { prepareSocialAction, runSocialConfirmedAction } from "./eddie-social";
import { socialContentFingerprint } from "./social-shared";

vi.mock("server-only", () => ({}));

const USER = { id: "owner_1", email: "michael@teamtastic.com" };

const account = {
  id: "acc_1",
  platform: "linkedin",
  account_name: "Teamtastic",
  account_type: "organization",
  destination: "Teamtastic",
  provider_id: "1234567",
  requires_manual_post: false,
  write_enabled: true,
  status: "connected",
  credentials: { access_token: "tok_123" },
};

const config = { social_master_enabled: true, linkedin_write_enabled: true, instagram_write_enabled: false, facebook_write_enabled: false, x_write_enabled: false };

function itemRow(overrides = {}) {
  return {
    id: "item_1",
    title: "Virtual holiday party",
    channel: "linkedin",
    format: "text",
    caption: "Teams love this.",
    hook: "",
    cta: "",
    media: [],
    body_text: "Teams love this.",
    destination: "Teamtastic",
    target_page: "/virtual-holiday-party",
    tracked_url: "https://www.teamtastic.events/virtual-holiday-party",
    platform_account_id: "acc_1",
    status: "draft",
    scheduled_for: null,
    scheduled_fingerprint: null,
    approved_fingerprint: null,
    revision: 0,
    ...overrides,
  };
}

function makeDb({ item = itemRow(), logClaimError = null } = {}) {
  let currentItem = item;
  const inserts = [];
  const updates = [];
  return {
    db: createSupabaseAdminMock({
      tables: {
        social_accounts: ({ calls }) => {
          if (calls.some((c) => c.method === "insert")) return { data: { id: "acc_1", ...calls.find((c) => c.method === "insert").args[0] }, error: null };
          return { data: account, error: null };
        },
        distribution_items: ({ calls }) => {
          if (calls.some((c) => c.method === "insert")) {
            const row = calls.find((c) => c.method === "insert").args[0];
            inserts.push(row);
            return { data: { id: "item_new", title: row.title || "", channel: row.channel, format: row.format, status: "draft" }, error: null };
          }
          if (calls.some((c) => c.method === "update")) {
            const patch = calls.find((c) => c.method === "update").args[0];
            currentItem = { ...currentItem, ...patch };
            updates.push(patch);
            return { data: { id: currentItem.id, title: currentItem.title || "Item", channel: currentItem.channel, format: currentItem.format, status: currentItem.status, scheduled_for: currentItem.scheduled_for }, error: null };
          }
          return { data: currentItem, error: null };
        },
        system_config: () => ({ data: config, error: null }),
        marketing_asset_drafts: ({ calls }) => {
          if (calls.some((c) => c.method === "insert")) return { data: { id: "plan_1", title: calls.find((c) => c.method === "insert").args[0].title, draft_type: "social_plan", status: "draft" }, error: null };
          return { data: null, error: null };
        },
        distribution_item_events: () => ({ data: null, error: null }),
        distribution_publishing_log: ({ calls }) => {
          if (calls.some((c) => c.method === "insert")) return { data: null, error: logClaimError };
          if (calls.some((c) => c.method === "update")) return { data: null, error: null };
          return { data: null, error: null };
        },
        organic_opportunities: () => ({ data: null, error: null }),
      },
    }),
    getItem: () => currentItem,
    inserts,
    updates,
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

describe("prepareSocialAction", () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it("prepares a create_social_post for an exact account and never writes", async () => {
    const { db, inserts } = makeDb();
    const prepared = await prepareSocialAction(db, {
      action_type: "create_social_post",
      platform: "linkedin",
      account_id: "acc_1",
      title: "Virtual holiday parties in one page",
      caption: "Book a hosted virtual party that actually engages your team.",
      target_page: "/virtual-holiday-party",
      evidence: "blog never-having-sister",
    });
    expect(prepared.action).toMatchObject({ type: "create_social_post", platform: "linkedin", account_id: "acc_1", format: "text" });
    expect(prepared.confirmation.title).toBe("Create a social post draft");
    expect(inserts).toHaveLength(0);
  });

  it("refuses a social post without exact evidence", async () => {
    const { db } = makeDb();
    await expect(prepareSocialAction(db, { action_type: "create_social_post", platform: "linkedin", account_id: "acc_1", title: "x", caption: "y", target_page: "/virtual-holiday-party", evidence: "" }))
      .rejects.toMatchObject({ code: "action_details_missing" });
  });

  it("blocks publish_social_item until every gate is ready", async () => {
    const readyItem = itemRow({ status: "approved", approved_fingerprint: socialContentFingerprint(itemRow({ status: "approved" })) });
    const { db } = makeDb({ item: readyItem });
    const blocked = await prepareSocialAction(db, {
      action_type: "publish_social_item",
      target_id: "item_1",
      platform: "linkedin",
      account_id: "acc_1",
    }).then(() => null, (error) => error);
    // config has the gates on, so it should have prepared; run with gates off instead:
    const configOff = { ...config, social_master_enabled: false };
    const dbOff = createSupabaseAdminMock({
      tables: {
        distribution_items: () => ({ data: readyItem, error: null }),
        social_accounts: () => ({ data: account, error: null }),
        system_config: () => ({ data: configOff, error: null }),
      },
    });
    await expect(prepareSocialAction(dbOff, { action_type: "publish_social_item", target_id: "item_1" }))
      .rejects.toMatchObject({ code: "social_publish_not_ready" });
    expect(blocked).toBeNull();
  });
});

describe("runSocialConfirmedAction", () => {
  it("creates a draft item and history for create_social_post", async () => {
    const { db, inserts } = makeDb();
    const result = await runSocialConfirmedAction(db, USER, "receipt_1", {
      type: "create_social_post",
      platform: "linkedin",
      account_id: "acc_1",
      format: "text",
      title: "Virtual holiday parties in one page",
      caption: "Book a hosted virtual party.",
      hook: "",
      cta: "",
      target_page: "/virtual-holiday-party",
      publish_mode: "now",
      evidence: "blog never-having-sister",
      requires_manual_post: false,
    });
    expect(result.record).toMatchObject({ status: "draft" });
    expect(inserts[0]).toMatchObject({ channel: "linkedin", status: "draft" });
    expect(inserts[0].tracked_url).toContain("utm_campaign=social_");
  });

  it("publishes a truly approved post to the provider", async () => {
    const approved = itemRow({ status: "approved", approved_fingerprint: socialContentFingerprint(itemRow({ status: "approved" })) });
    const { db, updates } = makeDb({ item: approved });
    const result = await runSocialConfirmedAction(db, USER, "receipt_1", {
      type: "publish_social_item",
      platform: "linkedin",
      account_id: "acc_1",
      social_item_id: "item_1",
      expected_status: "approved",
      expected_content_fingerprint: approved.approved_fingerprint,
      expected_scheduled_fingerprint: null,
    }, providerFetch());
    expect(result.record).toMatchObject({ status: "published", provider_post_id: "urn:li:share:live_1" });
    expect(updates.some((u) => u.status === "published")).toBe(true);
  });
});