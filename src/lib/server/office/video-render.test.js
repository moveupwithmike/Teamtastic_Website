// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseAdminMock } from "@/test/supabase-admin-mock";

const { getSupabaseAdmin, redirect, revalidatePath } = vi.hoisted(() => ({
  getSupabaseAdmin: vi.fn(),
  redirect: vi.fn((path) => { throw new Error(`REDIRECT:${path}`); }),
  revalidatePath: vi.fn(),
}));
vi.mock("@/lib/server/supabase-admin", () => ({ getSupabaseAdmin: () => getSupabaseAdmin() }));
vi.mock("@/lib/server/office-auth", () => ({ requireOfficeUser: () => Promise.resolve({ email: "owner@example.com" }) }));
vi.mock("next/navigation", () => ({ redirect: (path) => redirect(path) }));
vi.mock("next/cache", () => ({ revalidatePath: (path) => revalidatePath(path) }));
vi.mock("server-only", () => ({}));

import { queueSocialVideoRender, finalizeSocialVideoRender, newRenderJob } from "./video-render";

const VIDEO_ITEM = {
  id: "item_video",
  title: "How we run a 300-person holiday party",
  status: "draft",
  format: "video",
  body_text: "The shot list describes the room.",
  media: [],
  source_evidence: {
    video: {
      script: "Title card. Then the host walks the floor.",
      shot_list: [
        { time: "0:00", shot: "Title card: How we run a 300-person holiday party" },
        { time: "0:05", shot: "Host walk-through of the game show set" },
      ],
    },
  },
};

function formData({ id = "item_video" } = {}) {
  return { get: (key) => (key === "id" ? id : "") };
}

function buildQueueDb({ item = VIDEO_ITEM, jobError = null } = {}) {
  const jobInserts = [];
  const itemUpdates = [];
  const db = createSupabaseAdminMock({
    tables: {
      distribution_items: ({ calls }) => {
        const insert = calls.find((c) => c.method === "insert");
        if (insert) return { data: { id: item.id, title: item.title, channel: item.channel, format: item.format, status: item.status }, error: null };
        const update = calls.find((c) => c.method === "update");
        if (update) { itemUpdates.push(update.args[0]); return { data: { id: item.id }, error: null }; }
        return { data: item, error: null };
      },
      social_video_renders: ({ calls }) => {
        const insert = calls.find((c) => c.method === "insert");
        if (insert) { jobInserts.push(insert.args[0]); return { data: { id: "job_1", item_id: item.id, status: "pending", renderer: insert.args[0].renderer }, error: jobError }; }
        return { data: null, error: null };
      },
      agent_log: () => ({ data: null, error: null }),
    },
  });
  return { db, jobInserts, itemUpdates };
}

describe("queueSocialVideoRender", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSupabaseAdmin.mockReset();
  });

  it("queues a render job derived from the post's video card and never changes content", async () => {
    const { db, jobInserts, itemUpdates } = buildQueueDb();
    getSupabaseAdmin.mockReturnValue(db);

    await expect(queueSocialVideoRender(formData())).rejects.toThrow("REDIRECT:/office/distribution?success=rendered:queued");
    expect(jobInserts).toHaveLength(1);
    expect(jobInserts[0]).toMatchObject({
      item_id: "item_video",
      script: "Title card. Then the host walks the floor.",
      renderer: "none",
      status: "pending",
    });
    expect(jobInserts[0].shot_list).toHaveLength(2);
    expect(itemUpdates[0].source_evidence.video).toMatchObject({ render_job_id: "job_1", render_status: "pending" });
    expect(itemUpdates[0].source_evidence.video.script).toBe("Title card. Then the host walks the floor.");
    expect(revalidatePath).toHaveBeenCalledWith("/office/distribution");
  });

  it("rejects non-video posts", async () => {
    const { db } = buildQueueDb({ item: { ...VIDEO_ITEM, format: "text" } });
    getSupabaseAdmin.mockReturnValue(db);
    await expect(queueSocialVideoRender(formData())).rejects.toThrow("REDIRECT:/office/distribution?error=video_render_format");
  });

  it("fails safely on a missing item", async () => {
    const missingDb = createSupabaseAdminMock({
      tables: {
        distribution_items: () => ({ data: null, error: null }),
        social_video_renders: () => ({ data: null, error: null }),
        agent_log: () => ({ data: null, error: null }),
      },
    });
    getSupabaseAdmin.mockReturnValue(missingDb);
    await expect(queueSocialVideoRender(formData())).rejects.toThrow("REDIRECT:/office/distribution?error=video_render_missing");
  });

  it("fails safely when the job insert errors", async () => {
    const { db } = buildQueueDb({ jobError: { message: "unique violation" } });
    getSupabaseAdmin.mockReturnValue(db);
    await expect(queueSocialVideoRender(formData())).rejects.toThrow("REDIRECT:/office/distribution?error=video_render_failed");
  });
});

describe("newRenderJob", () => {
  it("derives the job script from the video card or falls back to body_text", () => {
    const fromCard = newRenderJob(VIDEO_ITEM);
    expect(fromCard.script).toBe("Title card. Then the host walks the floor.");
    expect(fromCard.shot_list).toHaveLength(2);

    const fallback = newRenderJob({ id: "x", format: "video", body_text: "Plain body", source_evidence: null });
    expect(fallback.script).toBe("Plain body");
    expect(fallback.shot_list).toEqual([]);
  });
});

describe("finalizeSocialVideoRender", () => {
  beforeEach(() => { vi.clearAllMocks(); getSupabaseAdmin.mockReset(); });

  it("attaches the produced file as media, marks the job done, and records a rendered event", async () => {
    const eventRows = [];
    const itemUpdates = [];
    const jobUpdates = [];
    const db = createSupabaseAdminMock({
      tables: {
        distribution_items: ({ calls }) => {
          const update = calls.find((c) => c.method === "update");
          if (update) { itemUpdates.push(update.args[0]); return { data: { id: "item_video", status: "draft" }, error: null }; }
          return { data: VIDEO_ITEM, error: null };
        },
        social_video_renders: ({ calls }) => {
          const update = calls.find((c) => c.method === "update");
          if (update) { jobUpdates.push(update.args[0]); return { data: { id: "job_1" }, error: null }; }
          return { data: { id: "job_1", status: "pending" }, error: null };
        },
        distribution_item_events: ({ calls }) => {
          calls.filter((c) => c.method === "insert").forEach((c) => eventRows.push(c.args[0]));
          return { data: null, error: null };
        },
      },
    });
    getSupabaseAdmin.mockReturnValue(db);

    const output = { path: "video/item_video.mp4", mime: "video/mp4", width: 1920, height: 1080, duration_ms: 15000 };
    const result = await finalizeSocialVideoRender({ itemId: "item_video", renderJobId: "job_1", output });
    expect(result.ok).toBe(true);

    expect(itemUpdates).toHaveLength(1);
    expect(itemUpdates[0].media).toEqual([{ kind: "video", ...output, render_job_id: "job_1" }]);
    expect(itemUpdates[0].source_evidence.video.render_status).toBe("done");

    expect(jobUpdates).toHaveLength(1);
    expect(jobUpdates[0]).toMatchObject({ status: "done" });
    expect(eventRows).toEqual([expect.objectContaining({ action: "rendered" })]);
  });
});
