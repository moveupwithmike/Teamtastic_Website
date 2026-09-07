import "server-only";
import { EddieError } from "./eddie-error";
import { socialContentFingerprint, socialScheduleFingerprint } from "./social-shared";
import { publishToPlatform, verifyLinkedInPost } from "./social-publishers";
import { findCompletedPublish, recordDistributionEvent } from "./social-events";

export function formatRequiresMedia(format) {
  return ["image", "multi_image", "video", "reel", "document"].includes(format);
}

export function formatName(format) {
  return {
    text: "text", image: "image", multi_image: "multi-image", document: "document",
    video: "video", reel: "Reel", comment: "comment",
  }[format] || format;
}

// Resolves media rows from Supabase storage into bytes for the provider. Any
// failure is fail-closed; an uncertain or missing asset never reaches a live
// publish.
export async function resolveMediaBytes(item = {}, db) {
  const assets = Array.isArray(item.media) ? item.media : [];
  if (!assets.length) return [];
  const resolved = [];
  for (const asset of assets) {
    const { error, data } = await db.storage.from(asset.bucket || "distribution-media").download(asset.path);
    if (error) throw new EddieError("social_media_missing", 503);
    resolved.push({ ...asset, bytes: Buffer.from(await data.arrayBuffer()) });
  }
  return resolved;
}

// Single publish entry shared by the Social Desk server action and Eddie's
// publish_social_item. Order matters:
//   1. re-verify status + approval/time fingerprints
//   2. reserve a 'started' publishing-log row (one per item, unique per status)
//   3. reconcile a prior live post instead of re-posting when possible
//   4. call the provider
//   5. write provider ids and only then flip the item to published
export async function attemptSocialPublish({ db, item, account, config, trigger = "office", receiptId = null, actor = null, fetchImpl = fetch, resolveMedia = undefined }) {
  const contentFp = socialContentFingerprint(item);

  if (item.approved_fingerprint && contentFp !== item.approved_fingerprint) {
    throw new EddieError("social_content_changed", 409);
  }

  if (item.status === "scheduled") {
    const scheduleFp = socialScheduleFingerprint(contentFp, item.scheduled_for);
    if (!item.scheduled_fingerprint || scheduleFp !== item.scheduled_fingerprint) {
      throw new EddieError("social_time_changed", 409);
    }
    if (new Date(item.scheduled_for).getTime() > Date.now()) {
      throw new EddieError("social_not_yet_due", 409);
    }
  }

  const { error: claimError } = await db.from("distribution_publishing_log").insert({
    distribution_item_id: item.id,
    status: "started",
    trigger,
    attempt: 1,
  });
  if (claimError) {
    if (claimError.code === "23505") throw new EddieError("social_publish_already_started", 409);
    throw new EddieError("social_publish_log_failed", 503);
  }

  const platform = item.channel || item.platform;
  const prior = await findCompletedPublish(db, item.id);

  // If a live provider post is already recorded (e.g. the provider accepted
  // the post but a later database write failed), reconcile instead of posting
  // again. Verified only where the provider exposes a read-back; otherwise we
  // refuse so a duplicate can never be created silently.
  if (prior?.provider_post_id) {
    const token = account?.credentials?.access_token;
    const verified = platform === "linkedin" && token ? await verifyLinkedInPost({ token, providerPostId: prior.provider_post_id, fetchImpl }) : false;
    if (!verified) {
      await recordDistributionEvent(db, item.id, {
        action: "publish_failed", statusBefore: item.status, statusAfter: "publish_failed",
        actor, decision: { duplicate_guard: "prior_publish_unverified", provider_post_id: prior.provider_post_id }, receiptId,
        error: "social_publish_already_completed",
      });
      throw new EddieError("social_publish_already_completed", 409);
    }
    const now = new Date().toISOString();
    const { error: updateError } = await db.from("distribution_items").update({
      status: "published",
      published_at: now,
      published_url: prior.provider_url,
      provider_post_id: prior.provider_post_id,
      published_by: actor || null,
      last_error: null,
    }).eq("id", item.id).eq("status", item.status);
    if (updateError) throw new EddieError("social_publish_record_failed", 503);
    await db.from("distribution_publishing_log").update({ status: "completed", provider_post_id: prior.provider_post_id, provider_url: prior.provider_url, result: { reconciled: true }, completed_at: now }).eq("id", prior.id);
    await recordDistributionEvent(db, item.id, {
      action: "published", statusBefore: item.status, statusAfter: "published",
      actor, decision: { reconciled: true, provider_post_id: prior.provider_post_id, provider_url: prior.provider_url, automatic_publishing: false }, receiptId,
      fingerprint: contentFp,
    });
    return { published: true, reconciled: true, providerPostId: prior.provider_post_id, providerUrl: prior.provider_url };
  }

  let providerResult;
  try {
    const mediaForProvider = resolveMedia ? await resolveMedia(item, db) : await resolveMediaBytes(item, db);
    providerResult = await publishToPlatform({
      item: { ...item, media: mediaForProvider },
      account,
      config,
      fetchImpl,
    });
  } catch (error) {
    const code = error?.code || (error instanceof Error ? error.message : "social_publish_failed");
    await db.from("distribution_publishing_log").update({ status: "failed", error: code, completed_at: new Date().toISOString() }).eq("distribution_item_id", item.id).is("status", "started");
    const { error: itemError } = await db.from("distribution_items").update({
      status: "publish_failed",
      last_error: code,
      updated_at: new Date().toISOString(),
    }).eq("id", item.id).eq("status", item.status);
    await recordDistributionEvent(db, item.id, {
      action: "publish_failed", statusBefore: item.status, statusAfter: "publish_failed",
      actor, receiptId, error: code,
    });
    if (itemError) throw new EddieError("social_publish_record_failed", 503);
    throw new EddieError(code === "social_media_missing" ? "social_media_missing" : "social_publish_failed", 409);
  }

  const now = new Date().toISOString();
  await db.from("distribution_publishing_log").update({
    status: "completed",
    provider_post_id: providerResult.provider_post_id,
    provider_url: providerResult.provider_url,
    result: providerResult,
    completed_at: now,
  }).eq("distribution_item_id", item.id).is("status", "started");

  const { error: updateError } = await db.from("distribution_items").update({
    status: "published",
    published_at: now,
    published_url: providerResult.provider_url,
    provider_post_id: providerResult.provider_post_id,
    published_by: actor || null,
    last_error: null,
  }).eq("id", item.id).eq("status", item.status);
  if (updateError) {
    await recordDistributionEvent(db, item.id, {
      action: "publish_failed", statusBefore: item.status, statusAfter: "publish_failed",
      actor, receiptId, error: "social_publish_record_failed",
    });
    throw new EddieError("social_publish_record_failed", 503);
  }

  await recordDistributionEvent(db, item.id, {
    action: "published", statusBefore: item.status, statusAfter: "published",
    actor, decision: { provider_post_id: providerResult.provider_post_id, provider_url: providerResult.provider_url, automatic_publishing: false }, receiptId,
    fingerprint: contentFp,
  });
  return { published: true, reconciled: false, providerPostId: providerResult.provider_post_id, providerUrl: providerResult.provider_url };
}
