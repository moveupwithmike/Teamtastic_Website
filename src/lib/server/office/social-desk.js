"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import { requireOfficeUser } from "@/lib/server/office-auth";
import { audit, clean } from "./shared";
import { EddieError } from "./eddie-error";
import {
  buildTrackedUrl, slugify, SOCIAL_FORMATS, SOCIAL_OBJECTIVES, SOCIAL_PLATFORMS,
  socialContentFingerprint, socialScheduleFingerprint,
} from "./social-shared";
import { platformStatus } from "./social-publishers";
import { formatRequiresMedia, attemptSocialPublish } from "./social-publish";
import { recordDistributionEvent } from "./social-events";

const DISTRIBUTION_PATH = "/office/distribution";
const MEDIA_BUCKET = "distribution-media";

function fail(code) {
  redirect(`${DISTRIBUTION_PATH}?error=${code}`);
}

function extractItemFields(formData) {
  const channel = clean(formData.get("channel"), 20);
  const format = clean(formData.get("format"), 20) || "text";
  const title = clean(formData.get("title"), 200);
  const caption = clean(formData.get("caption"), 3000);
  const hook = clean(formData.get("hook"), 400);
  const cta = clean(formData.get("cta"), 400);
  const objective = SOCIAL_OBJECTIVES.includes(formData.get("content_objective")) ? clean(formData.get("content_objective"), 30) : null;
  const funnelStage = clean(formData.get("funnel_stage"), 100) || null;
  const targetPage = clean(formData.get("target_page"), 300);
  const destination = clean(formData.get("destination"), 200) || null;
  const accountId = clean(formData.get("platform_account_id"), 60) || null;
  const publishMode = formData.get("publish_mode") === "scheduled" ? "scheduled" : "now";
  const scheduledFor = clean(formData.get("scheduled_for"), 100);
  return { channel, format, title, caption, hook, cta, objective, funnelStage, targetPage, destination, accountId, publishMode, scheduledFor };
}

export async function uploadSocialMedia(formData) {
  const user = await requireOfficeUser();
  const db = getSupabaseAdmin();
  const file = formData.get("file");
  if (!file || typeof file.arrayBuffer !== "function") return { ok: false, error: "media_required" };
  if (file.size > 100 * 1024 * 1024) return { ok: false, error: "media_too_large" };
  const mime = String(file.type || "");
  const kind = mime.startsWith("image/") ? "image" : mime.startsWith("video/") ? "video" : "document";
  if (!kind) return { ok: false, error: "media_invalid_type" };
  const extension = (file.name || "").split(".").pop()?.toLowerCase() || (kind === "image" ? "png" : kind === "video" ? "mp4" : "pdf");
  const path = `${user.email.split("@")[0]}/${randomUUID()}.${extension}`;
  const { error } = await db.storage.from(MEDIA_BUCKET).upload(path, Buffer.from(await file.arrayBuffer()), { contentType: mime, upsert: false });
  if (error) return { ok: false, error: "media_upload_failed" };
  return { ok: true, bucket: MEDIA_BUCKET, path, mime, kind };
}

export async function createSocialItem(formData) {
  const user = await requireOfficeUser();
  const db = getSupabaseAdmin();
  const { channel, format, title, caption, hook, cta, objective, funnelStage, targetPage, destination, accountId, publishMode, scheduledFor } = extractItemFields(formData);
  if (!SOCIAL_PLATFORMS.includes(channel) || !SOCIAL_FORMATS.includes(format) || format === "comment") fail("incomplete");
  if (!title || !caption || !targetPage.startsWith("/")) fail("incomplete");

  let account = null;
  if (accountId) {
    const { data } = await db.from("social_accounts").select("id,platform,account_name,destination,requires_manual_post").eq("id", accountId).maybeSingle();
    if (!data || data.platform !== channel) fail("account_missing");
    account = data;
  }

  const campaign = `social_${new Date().toISOString().slice(0, 7).replace("-", "_")}`;
  const trackedUrl = buildTrackedUrl({ channel, targetPage, campaign, content: slugify(title) });
  let media = [];
  const rawMedia = clean(formData.get("media_paths"), 20000);
  if (rawMedia) {
    try { media = JSON.parse(rawMedia); } catch { fail("media_invalid"); }
  }
  if (!Array.isArray(media)) media = [];

  const { data, error } = await db.from("distribution_items").insert({
    title,
    channel,
    audience: "",
    target_page: targetPage,
    body_text: [hook, caption, cta].filter(Boolean).join("\n"),
    utm_source: channel,
    utm_medium: "organic_distribution",
    utm_campaign: campaign,
    utm_content: slugify(title),
    tracked_url: trackedUrl,
    status: "draft",
    format,
    content_objective: objective,
    funnel_stage: funnelStage,
    hook: hook || null,
    caption,
    cta: cta || null,
    media,
    destination: destination || account?.destination || account?.account_name || null,
    platform_account_id: account?.id || null,
    publish_mode: publishMode,
    scheduled_for: scheduledFor ? new Date(scheduledFor).toISOString() : null,
    requires_manual_post: Boolean(account?.requires_manual_post) || channel === "reddit",
    source_evidence: { generated_by: "office", created_by: user.email },
    voice_sources: [],
    fingerprint: `social:${randomUUID()}`,
    decision: { generated_by: "office", automatic_publishing: false },
  }).select("id,title,channel,status").single();
  if (error || !data) fail("create_failed");
  await recordDistributionEvent(db, data.id, { action: "created", statusBefore: null, statusAfter: "draft", actor: user.email, decision: { generated_by: "office" } });
  await audit("create_social_item", user, { item_id: data.id, channel, format });
  revalidatePath(DISTRIBUTION_PATH);
  redirect(`${DISTRIBUTION_PATH}?success=created`);
}

export async function reviseSocialItem(formData) {
  const user = await requireOfficeUser();
  const db = getSupabaseAdmin();
  const id = clean(formData.get("id"), 60);
  const { data: item } = await db.from("distribution_items").select("id,title,status,revision").eq("id", id).maybeSingle();
  if (!item) fail("missing");
  if (item.status !== "draft") fail("transition_invalid");
  const changes = {};
  for (const field of ["caption", "hook", "cta", "funnel_stage"]) {
    const value = clean(formData.get(field), 3000);
    if (value) changes[field] = value;
  }
  const rawMedia = clean(formData.get("media_paths"), 20000);
  if (rawMedia) {
    try {
      const media = JSON.parse(rawMedia);
      if (Array.isArray(media)) changes.media = media;
    } catch { fail("media_invalid"); }
  }
  if (!Object.keys(changes).length) fail("incomplete");
  const { error } = await db.from("distribution_items").update({ ...changes, revision: (item.revision || 0) + 1, last_error: null }).eq("id", id).eq("status", "draft");
  if (error) fail("update_failed");
  await recordDistributionEvent(db, id, { action: "revised", statusBefore: "draft", statusAfter: "draft", actor: user.email, decision: { changed: Object.keys(changes) } });
  await audit("revise_social_item", user, { item_id: id, changed: Object.keys(changes) });
  revalidatePath(DISTRIBUTION_PATH);
  redirect(`${DISTRIBUTION_PATH}?success=updated`);
}

export async function approveSocialItem(formData) {
  const user = await requireOfficeUser();
  const db = getSupabaseAdmin();
  const id = clean(formData.get("id"), 60);
  const { data: item } = await db.from("distribution_items").select("*").eq("id", id).maybeSingle();
  if (!item) fail("missing");
  if (item.status !== "draft") fail("transition_invalid");
  if (formatRequiresMedia(item.format) && (!Array.isArray(item.media) || !item.media.length)) fail("media_required");
  const contentFp = socialContentFingerprint(item);
  const { error } = await db.from("distribution_items").update({ status: "approved", approved_fingerprint: contentFp, approved_by: user.email, approved_at: new Date().toISOString(), last_error: null }).eq("id", id).eq("status", "draft");
  if (error) fail("update_failed");
  await recordDistributionEvent(db, id, { action: "approved", statusBefore: "draft", statusAfter: "approved", actor: user.email, fingerprint: contentFp, decision: { automatic_publishing: false } });
  await audit("approve_social_item", user, { item_id: id });
  revalidatePath(DISTRIBUTION_PATH);
  redirect(`${DISTRIBUTION_PATH}?success=approved`);
}

export async function rejectSocialItem(formData) {
  const user = await requireOfficeUser();
  const db = getSupabaseAdmin();
  const id = clean(formData.get("id"), 60);
  const { data: item } = await db.from("distribution_items").select("id,status").eq("id", id).maybeSingle();
  if (!item || item.status !== "draft") fail("transition_invalid");
  const { error } = await db.from("distribution_items").update({ status: "rejected" }).eq("id", id).eq("status", "draft");
  if (error) fail("update_failed");
  await recordDistributionEvent(db, id, { action: "rejected", statusBefore: "draft", statusAfter: "rejected", actor: user.email, decision: { automatic_publishing: false } });
  await audit("reject_social_item", user, { item_id: id });
  revalidatePath(DISTRIBUTION_PATH);
  redirect(`${DISTRIBUTION_PATH}?success=updated`);
}

function futureTime(value) {
  try { return new Date(value); } catch { return null; }
}

export async function scheduleSocialItem(formData) {
  const user = await requireOfficeUser();
  const db = getSupabaseAdmin();
  const id = clean(formData.get("id"), 60);
  const when = clean(formData.get("scheduled_for"), 40);
  if (!when) fail("schedule_required");
  const date = futureTime(when);
  if (!date || !Number.isFinite(date.getTime()) || date.getTime() <= Date.now()) fail("schedule_required");
  const { data: item } = await db.from("distribution_items").select("id,status,title").eq("id", id).maybeSingle();
  if (!item) fail("missing");
  if (item.status !== "approved") fail("transition_invalid");
  const contentFp = socialContentFingerprint((await db.from("distribution_items").select("*").eq("id", id).single()).data);
  const scheduledFp = socialScheduleFingerprint(contentFp, date.toISOString());
  const { error } = await db.from("distribution_items").update({ status: "scheduled", scheduled_for: date.toISOString(), scheduled_fingerprint: scheduledFp, last_error: null }).eq("id", id).eq("status", "approved");
  if (error) fail("update_failed");
  await recordDistributionEvent(db, id, { action: "scheduled", statusBefore: "approved", statusAfter: "scheduled", actor: user.email, fingerprint: scheduledFp, decision: { scheduled_for: date.toISOString(), automatic_publishing: false } });
  await audit("schedule_social_item", user, { item_id: id, scheduled_for: date.toISOString() });
  revalidatePath(DISTRIBUTION_PATH);
  redirect(`${DISTRIBUTION_PATH}?success=scheduled`);
}

export async function rescheduleSocialItem(formData) {
  const user = await requireOfficeUser();
  const db = getSupabaseAdmin();
  const id = clean(formData.get("id"), 60);
  const when = clean(formData.get("scheduled_for"), 40);
  if (!when) fail("schedule_required");
  const date = futureTime(when);
  if (!date || !Number.isFinite(date.getTime()) || date.getTime() <= Date.now()) fail("schedule_required");
  const { data: item } = await db.from("distribution_items").select("id,status").eq("id", id).maybeSingle();
  if (!item || !["scheduled", "paused"].includes(item.status)) fail("transition_invalid");
  const contentFp = socialContentFingerprint((await db.from("distribution_items").select("*").eq("id", id).single()).data);
  const scheduledFp = socialScheduleFingerprint(contentFp, date.toISOString());
  const { error } = await db.from("distribution_items").update({ status: "scheduled", scheduled_for: date.toISOString(), scheduled_fingerprint: scheduledFp, last_error: null }).eq("id", id).in("status", ["scheduled", "paused"]);
  if (error) fail("update_failed");
  await recordDistributionEvent(db, id, { action: "rescheduled", statusBefore: item.status, statusAfter: "scheduled", actor: user.email, fingerprint: scheduledFp, decision: { scheduled_for: date.toISOString(), automatic_publishing: false } });
  await audit("reschedule_social_item", user, { item_id: id, scheduled_for: date.toISOString() });
  revalidatePath(DISTRIBUTION_PATH);
  redirect(`${DISTRIBUTION_PATH}?success=scheduled`);
}

export async function pauseScheduledSocialItem(formData) {
  const user = await requireOfficeUser();
  const db = getSupabaseAdmin();
  const id = clean(formData.get("id"), 60);
  const { data: item } = await db.from("distribution_items").select("id,status,scheduled_for").eq("id", id).maybeSingle();
  if (!item || item.status !== "scheduled") fail("transition_invalid");
  const { error } = await db.from("distribution_items").update({ status: "paused", last_error: null }).eq("id", id).eq("status", "scheduled");
  if (error) fail("update_failed");
  await recordDistributionEvent(db, id, { action: "paused", statusBefore: "scheduled", statusAfter: "paused", actor: user.email, decision: { scheduled_for: item.scheduled_for, automatic_publishing: false } });
  await audit("pause_scheduled_social_item", user, { item_id: id });
  revalidatePath(DISTRIBUTION_PATH);
  redirect(`${DISTRIBUTION_PATH}?success=paused`);
}

export async function publishSocialItem(formData) {
  const user = await requireOfficeUser();
  const db = getSupabaseAdmin();
  const id = clean(formData.get("id"), 60);
  const { data: item } = await db.from("distribution_items").select("*").eq("id", id).maybeSingle();
  if (!item) fail("missing");
  if (!["approved", "scheduled", "publish_failed"].includes(item.status)) fail("transition_invalid");

  const contentFp = socialContentFingerprint(item);
  if (item.approved_fingerprint && contentFp !== item.approved_fingerprint) fail("content_changed");
  if (item.status === "scheduled") {
    const scheduledFp = socialScheduleFingerprint(contentFp, item.scheduled_for);
    if (!item.scheduled_fingerprint || scheduledFp !== item.scheduled_fingerprint) fail("time_changed");
    if (new Date(item.scheduled_for).getTime() > Date.now()) fail("not_yet_due");
  }

  const account = item.platform_account_id
    ? (await db.from("social_accounts").select("*").eq("id", item.platform_account_id).maybeSingle()).data
    : null;
  const config = (await db.from("system_config").select("social_master_enabled,linkedin_write_enabled,instagram_write_enabled,facebook_write_enabled,x_write_enabled").eq("id", true).maybeSingle()).data || {};
  const readiness = platformStatus({ platform: item.channel, account, config });

  if (readiness.ready && !item.requires_manual_post) {
    try {
      const result = await attemptSocialPublish({ db, item, account, config, trigger: "office", actor: user.email });
      await audit("publish_social_item", user, { item_id: id, provider_post_id: result.providerPostId, provider_url: result.providerUrl, reconciled: result.reconciled, automatic_publishing: false });
      revalidatePath(DISTRIBUTION_PATH);
      redirect(`${DISTRIBUTION_PATH}?success=published`);
    } catch (error) {
      const code = error instanceof EddieError ? error.code : "publish_failed";
      await audit("publish_social_item", user, { item_id: id }, null, "failed", code);
      fail(code === "social_content_changed" || code === "social_time_changed" || code === "social_not_yet_due" ? code.replace("social_", "") : "publish_failed");
    }
  }

  // Manual copy-and-post path: the owner posts the copy themselves and records
  // the published URL here. Nothing hits a provider.
  const publishedUrl = clean(formData.get("published_url"), 2000);
  if (!publishedUrl) fail("published_url_required");
  const { error } = await db.from("distribution_items").update({
    status: "published",
    published_url: publishedUrl,
    published_at: new Date().toISOString(),
    published_by: user.email,
    last_error: null,
  }).eq("id", id).eq("status", item.status);
  if (error) fail("update_failed");
  await recordDistributionEvent(db, id, { action: "published", statusBefore: item.status, statusAfter: "published", actor: user.email, fingerprint: contentFp, decision: { published_url: publishedUrl, manual_copy_post: true, automatic_publishing: false } });
  await audit("publish_social_item", user, { item_id: id, published_url: publishedUrl, manual: true, automatic_publishing: false });
  revalidatePath(DISTRIBUTION_PATH);
  redirect(`${DISTRIBUTION_PATH}?success=published`);
}

export async function retrySocialPublish(formData) {
  return publishSocialItem(formData);
}