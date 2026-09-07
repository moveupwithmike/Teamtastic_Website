import "server-only";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import { requireOfficeUser } from "@/lib/server/office-auth";
import { audit, clean } from "./shared";
import { recordDistributionEvent } from "./social-events";

const DISTRIBUTION_PATH = "/office/distribution";
const MEDIA_BUCKET = "distribution-media";
const MAX_RENDER_SIZE = 50 * 1024 * 1024;
const RENDER_MIME_TYPES = new Set(["video/mp4", "video/webm"]);

function fail(code) {
  redirect(`${DISTRIBUTION_PATH}?error=${code}`);
}

// Pluggable renderer. "none" means the desk queues real production later —
// the entry point below always leaves the post reviewable and unmodified.
export const RENDERER = process.env.SOCIAL_VIDEO_RENDERER || "none";

// The job row is derived purely from the post's video card (script + shot
// list), so the renderer engine never needs to read business columns.
export function newRenderJob(item) {
  const video = item.source_evidence?.video || {};
  return {
    item_id: item.id,
    script: video.script || item.body_text || "",
    shot_list: video.shot_list || [],
    status: "pending",
    renderer: RENDERER,
  };
}

// Queues a render for a video post and records it on the post's video card.
// Nothing is produced or published here — renders only attach media via
// finalizeSocialVideoRender once the engine produces a real file.
export async function queueSocialVideoRender(formData) {
  const user = await requireOfficeUser();
  const id = clean(formData.get("id"), 60);
  if (!id) fail("video_render_missing");
  const db = getSupabaseAdmin();
  const { data: item, error: itemError } = await db.from("distribution_items")
    .select("id,title,status,format,body_text,source_evidence,media")
    .eq("id", id).maybeSingle();
  if (itemError || !item) fail("video_render_missing");
  if (item.format !== "video") fail("video_render_format");

  const job = newRenderJob(item);
  const { data, error } = await db.from("social_video_renders")
    .insert(job).select("id,item_id,status,renderer").single();
  if (error || !data) fail("video_render_failed");

  const renderedAt = new Date().toISOString();
  await db.from("distribution_items").update({
    source_evidence: {
      ...(item.source_evidence || {}),
      video: {
        ...(item.source_evidence?.video || {}),
        render_job_id: data.id,
        renderer: job.renderer,
        render_status: "pending",
        queued_at: renderedAt,
      },
    },
  }).eq("id", id);

  await audit("queue_social_video_render", user, {
    item_id: id,
    render_job_id: data.id,
    renderer: job.renderer,
    automatic_publishing: false,
  });
  revalidatePath(DISTRIBUTION_PATH);
  return redirect(`${DISTRIBUTION_PATH}?success=rendered:queued`);
}

// Attaches finished render output as the post's media and records the render.
// This is the extension point the renderer engine calls once it has produced a
// real file in the distribution-media bucket. It never touches scheduled time,
// approval, or publication switches.
export async function finalizeSocialVideoRender({ itemId, renderJobId, output }) {
  const db = getSupabaseAdmin();
  const { data: item, error: itemError } = await db.from("distribution_items")
    .select("id,status,media,source_evidence").eq("id", itemId).maybeSingle();
  if (itemError || !item) return { ok: false, error: "missing_item" };
  const { data: renderJob } = await db.from("social_video_renders")
    .select("id,status").eq("id", renderJobId).maybeSingle();
  if (!renderJob || renderJob.status === "canceled") return { ok: false, error: "missing_job" };

  const media = Array.isArray(item.media) ? item.media : [];
  const finished = { kind: "video", path: output.path, mime: output.mime || "video/mp4", width: output.width || null, height: output.height || null, duration_ms: output.duration_ms || null, render_job_id: renderJobId };
  const { error: attachError } = await db.from("distribution_items").update({
    media: [...media, finished],
    source_evidence: {
      ...(item.source_evidence || {}),
      video: {
        ...(item.source_evidence?.video || {}),
        render_status: "done",
        rendered_at: new Date().toISOString(),
      },
    },
  }).eq("id", itemId);
  if (attachError) return { ok: false, error: "attach_failed" };

  await db.from("social_video_renders").update({ status: "done", media: finished, completed_at: new Date().toISOString() }).eq("id", renderJobId);
  await recordDistributionEvent(db, itemId, {
    action: "rendered",
    statusBefore: item.status,
    statusAfter: item.status,
    actor: "video_renderer",
    decision: { render_job_id: renderJobId, renderer: RENDERER },
  });
  return { ok: true };
}

function renderPath(itemId, renderJobId, mime) {
  return `video/${itemId}/${renderJobId}.${mime === "video/webm" ? "webm" : "mp4"}`;
}

async function loadPendingRender(db, itemId, renderJobId) {
  const [{ data: item, error: itemError }, { data: job, error: jobError }] = await Promise.all([
    db.from("distribution_items").select("id,status").eq("id", itemId).maybeSingle(),
    db.from("social_video_renders").select("id,item_id,status,renderer").eq("id", renderJobId).maybeSingle(),
  ]);
  if (itemError || !item || jobError || !job || job.item_id !== itemId || !["pending", "rendering"].includes(job.status)) return null;
  return { item, job };
}

// Creates a two-hour, path-scoped Supabase upload token. The browser uploads
// the large video directly to the private bucket instead of sending it through
// Next.js Server Actions (whose body limit is intentionally small).
export async function prepareSocialVideoUpload(formData) {
  const user = await requireOfficeUser();
  const db = getSupabaseAdmin();
  const itemId = clean(formData.get("item_id"), 60);
  const renderJobId = clean(formData.get("render_job_id"), 60);
  const mime = clean(formData.get("mime"), 80).toLowerCase();
  if (!itemId || !renderJobId) fail("video_render_missing");
  if (!RENDER_MIME_TYPES.has(mime)) fail("video_render_failed");

  const render = await loadPendingRender(db, itemId, renderJobId);
  if (!render) fail("video_render_missing");
  const path = renderPath(itemId, renderJobId, mime);
  const { data, error } = await db.storage.from(MEDIA_BUCKET).createSignedUploadUrl(path, { upsert: true });
  if (error || !data?.token) fail("video_render_failed");
  const { error: updateError } = await db.from("social_video_renders").update({ status: "rendering", error: null }).eq("id", renderJobId);
  if (updateError) fail("video_render_failed");
  await audit("prepare_social_video_upload", user, { item_id: itemId, render_job_id: renderJobId, path, mime });
  return { success: true, path, token: data.token };
}

// Verifies the directly uploaded object and attaches it to the review-only post.
export async function finishSocialVideoRender(formData) {
  const user = await requireOfficeUser();
  const db = getSupabaseAdmin();
  const itemId = clean(formData.get("item_id"), 60);
  const renderJobId = clean(formData.get("render_job_id"), 60);
  const mime = clean(formData.get("mime"), 80).toLowerCase();
  if (!itemId || !renderJobId) fail("video_render_missing");
  if (!RENDER_MIME_TYPES.has(mime)) fail("video_render_failed");
  const render = await loadPendingRender(db, itemId, renderJobId);
  if (!render) fail("video_render_missing");
  const { item, job } = render;
  const path = renderPath(itemId, renderJobId, mime);
  const { data: stored, error: storedError } = await db.storage.from(MEDIA_BUCKET).info(path);
  const storedType = String(stored?.contentType || stored?.metadata?.mimetype || "").toLowerCase();
  const storedSize = Number(stored?.size || stored?.metadata?.size || 0);
  if (storedError || !stored || storedSize <= 0 || storedSize > MAX_RENDER_SIZE || !RENDER_MIME_TYPES.has(storedType)) {
    await db.from("social_video_renders").update({ status: "failed", error: "invalid_uploaded_media" }).eq("id", renderJobId);
    fail("video_render_failed");
  }

  const clamp = (value, min, max, fallback) => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
  };
  const width = clamp(formData.get("width"), 0, 8192, 1080);
  const height = clamp(formData.get("height"), 0, 8192, 1920);
  const durationMs = clamp(formData.get("duration_ms"), 0, 3600000, 0);

  const outcome = await finalizeSocialVideoRender({ itemId, renderJobId, output: { path, mime, width, height, duration_ms: durationMs } });
  if (!outcome.ok) {
    await db.from("social_video_renders").update({ status: "failed", error: outcome.error }).eq("id", renderJobId);
    await recordDistributionEvent(db, itemId, {
      action: "render_failed",
      statusBefore: item.status,
      statusAfter: item.status,
      actor: "video_renderer",
      decision: { error: outcome.error, renderer: job.renderer },
    });
    fail("video_render_failed");
  }

  await audit("finish_social_video_render", user, { item_id: itemId, render_job_id: renderJobId, path, mime, width, height, duration_ms: durationMs, renderer: job.renderer });
  revalidatePath(DISTRIBUTION_PATH);
  return { success: true };
}
