import "server-only";

// Immutable history rows + the completed-publish lookup used by retries to
// reconcile a live post instead of duplicating it.

export async function recordDistributionEvent(db, itemId, { action = null, statusBefore = null, statusAfter = null, actor = null, decision = {}, fingerprint = null, receiptId = null, error = null }) {
  const { error: writeError } = await db.from("distribution_item_events").insert({
    distribution_item_id: itemId,
    action,
    status_before: statusBefore,
    status_after: statusAfter,
    actor: actor || null,
    decision,
    fingerprint: fingerprint || null,
    receipt_id: receiptId || null,
    error: error || null,
  });
  return writeError;
}

export async function findCompletedPublish(db, itemId) {
  const { data, error } = await db.from("distribution_publishing_log")
    .select("id,distribution_item_id,status,provider_post_id,provider_url,created_at,completed_at")
    .eq("distribution_item_id", itemId)
    .eq("status", "completed")
    .not("provider_post_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

export async function latestPublishingRun(db, itemId) {
  const { data, error } = await db.from("distribution_publishing_log")
    .select("*")
    .eq("distribution_item_id", itemId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}
