// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { createSupabaseAdminMock } from "@/test/supabase-admin-mock";
vi.mock("server-only", () => ({}));
import { buildMorningProposals, MAX_DAILY_PROPOSALS } from "./social-generator";

const VOICE = [
  { id: "v-sig", kind: "signature", label: "Tagline", body: "Play. Connect. Celebrate.", source: "voice", sort_order: 1 },
  { id: "v-open", kind: "opener", label: "Direct", body: "A team that plays together stays together.", source: "voice", sort_order: 1 },
  { id: "v-phrase", kind: "phrase", label: "Game show", body: "Every session turns the screen into a game show.", source: "voice", sort_order: 1 },
  { id: "v-fact", kind: "fact", label: "Hosted live", body: "Events are hosted live by a Master Emcee.", source: "voice", sort_order: 1 },
  { id: "v-avoid", kind: "avoid", label: "Buzzword", body: "synergy", source: "voice", sort_order: 1 },
];

const ACCOUNTS = [
  { id: "acc-ld", platform: "linkedin", account_name: "Teamtastic", destination: "Teamtastic", requires_manual_post: false, status: "connected" },
  { id: "acc-reddit", platform: "reddit", account_name: "r/teambuilding", destination: "r/teambuilding", requires_manual_post: true, status: "connected" },
];

function mockDb({ enabled = true, recent = [], voice = VOICE, accounts = ACCOUNTS, failConfig = false, existingRun = null } = {}) {
  const insertBatch = [];
  let eventCount = 0;
  const runUpdates = [];
  const db = createSupabaseAdminMock({
    tables: {
      system_config: () => ({ data: { social_generator_enabled: enabled }, error: failConfig ? { message: "down" } : null }),
      social_generation_runs: ({ calls }) => {
        if (calls[0]?.method === "insert") {
          return existingRun
            ? { data: null, error: { code: "23505", message: "duplicate date" } }
            : { data: { id: "run-1", generation_date: "2026-09-07", status: "running", created_count: 0 }, error: null };
        }
        if (calls[0]?.method === "update") {
          runUpdates.push(calls[0].args[0]);
          return { data: null, error: null };
        }
        if (calls[0]?.method === "delete") return { data: null, error: null };
        return { data: existingRun, error: null };
      },
      social_accounts: () => ({ data: accounts, error: null }),
      social_voice_entries: () => ({ data: voice, error: null }),
      distribution_items: ({ calls }) => {
        if (calls[0]?.method === "insert") {
          const rows = calls[0].args[0] || [];
          insertBatch.push(...rows);
          return { data: rows.map((r, index) => ({ id: `new-${index}-${r.channel}`, title: r.title, channel: r.channel, status: r.status })), error: null };
        }
        return { data: recent, error: null };
      },
      distribution_item_events: ({ calls }) => {
        if (calls[0]?.method === "insert") eventCount += 1;
        return { data: null, error: null };
      },
    },
  });
  return { db, insertBatch, eventCount: () => eventCount, runUpdates };
}

describe("morning generator", () => {
  it("is disabled when the generator switch is off", async () => {
    const { db, insertBatch } = mockDb({ enabled: false });
    const result = await buildMorningProposals({ db });
    expect(result.enabled).toBe(false);
    expect(result.reason).toBe("generator_off");
    expect(insertBatch.length).toBe(0);
  });

  it("returns disabled instead of writing when the config query fails", async () => {
    const { db } = mockDb({ failConfig: true });
    const result = await buildMorningProposals({ db });
    expect(result.enabled).toBe(false);
  });

  it("creates no extra drafts when today's run already exists", async () => {
    const { db, insertBatch } = mockDb({ existingRun: { id: "existing", status: "completed", created_count: 3, batch_id: "batch-1" } });
    const result = await buildMorningProposals({ db, now: new Date("2026-09-07T12:10:00Z"), trigger: "vercel_cron" });
    expect(result).toMatchObject({ enabled: true, created: 0, already_generated: true, previous_created: 3 });
    expect(insertBatch).toHaveLength(0);
  });

  it("proposes review-only drafts per account with tracked urls and manual flags", async () => {
    const { db, insertBatch } = mockDb();
    const result = await buildMorningProposals({ db });
    expect(result.enabled).toBe(true);
    expect(result.created).toBe(insertBatch.length);
    expect(insertBatch.length).toBeGreaterThan(0);

    const platforms = new Set(insertBatch.map((row) => row.channel));
    expect(platforms.has("linkedin")).toBe(true);
    expect(platforms.has("reddit")).toBe(true);

    for (const row of insertBatch) {
      expect(row.status).toBe("draft");
      expect(row.format).toBe("text");
      expect(row.tracked_url).toContain("utm_source=");
      expect(row.tracked_url).toContain("teamtastic.events");
      expect(row.decision).toMatchObject({ automatic_publishing: false });
      expect(row.source_evidence.generated_by).toBe("morning_generator");
      expect(row.source_evidence.generator_hash).toBeTruthy();
      expect(row.source_evidence.generator_voice.length).toBeGreaterThan(0);
    }

    const redditRow = insertBatch.find((row) => row.channel === "reddit");
    expect(redditRow.requires_manual_post).toBe(true);
    const linkedinRow = insertBatch.find((row) => row.channel === "linkedin");
    expect(linkedinRow.requires_manual_post).toBe(false);
  });

  it("records a created event for every generated draft", async () => {
    const { db, eventCount } = mockDb();
    const result = await buildMorningProposals({ db });
    expect(eventCount()).toBe(result.created);
    expect(result.created).toBeGreaterThan(0);
  });

  it("records the completed daily run for Eddie's morning report", async () => {
    const { db, runUpdates } = mockDb();
    const result = await buildMorningProposals({ db });
    expect(runUpdates.at(-1)).toMatchObject({ status: "completed", created_count: result.created, error: null });
  });

  it("deduplicates against items already proposed in the lookback window", async () => {
    const first = mockDb();
    const firstResult = await buildMorningProposals({ db: first.db });
    expect(firstResult.created).toBeGreaterThan(0);
    const hash = first.insertBatch[0].source_evidence.generator_hash;

    const second = mockDb({ recent: [
      { id: "old-1", channel: first.insertBatch[0].channel, status: "draft", caption: first.insertBatch[0].caption, body_text: null, source_evidence: { generator_hash: hash } },
    ] });
    await buildMorningProposals({ db: second.db });
    expect(second.insertBatch.some((row) => row.source_evidence.generator_hash === hash)).toBe(false);
  });

  it("never auto-approves, auto-schedules, or touches publish gates", async () => {
    const { db, insertBatch } = mockDb();
    await buildMorningProposals({ db });
    expect(db.from("system_config").update).not.toHaveBeenCalled();
    expect(insertBatch.length).toBeGreaterThan(0);
    for (const row of insertBatch) {
      expect(["draft", "proposed"]).toContain(row.status);
      expect(row.decision.automatic_publishing).toBe(false);
    }
  });

  it("caps the whole batch to a small daily plan even with many connected accounts", async () => {
    const manyAccounts = ["linkedin", "instagram", "facebook", "x", "reddit"].map((platform) => ({
      id: `acc-${platform}`, platform, account_name: platform, destination: platform,
      requires_manual_post: platform === "reddit", status: "connected",
    }));
    const { db, insertBatch } = mockDb({ accounts: manyAccounts });
    const result = await buildMorningProposals({ db });
    expect(result.created).toBeLessThanOrEqual(MAX_DAILY_PROPOSALS);
    expect(insertBatch.length).toBeLessThanOrEqual(MAX_DAILY_PROPOSALS);
  });

  it("caps proposals per account", async () => {
    const { db, insertBatch } = mockDb();
    await buildMorningProposals({ db });
    const perAccount = {};
    for (const row of insertBatch) perAccount[row.platform_account_id] = (perAccount[row.platform_account_id] || 0) + 1;
    for (const count of Object.values(perAccount)) {
      expect(count).toBeLessThanOrEqual(2);
    }
  });
});
