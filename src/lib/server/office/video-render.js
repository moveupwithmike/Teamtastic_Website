import "server-only";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import { requireOfficeUser } from "@/lib/server/office-auth";
import { audit, clean } from "./shared";
import { recordDistributionEvent } from "./social-events";

const DISTRIBUTION_PATH = "/office/distribution";

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