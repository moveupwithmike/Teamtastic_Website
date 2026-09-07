import "server-only";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import { requireOfficeUser } from "@/lib/server/office-auth";
import { audit } from "./shared";

const DISTRIBUTION_PATH = "/office/distribution";
const EASTERN_TZ = "America/New_York";

function easternDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: EASTERN_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// Rolls the latest day of first-party funnel events into each post's lifetime
// counters using the tracked link the post carries (utm_content attribution).
// Core keeps the idempotent, auth-free step callable from the autopilot loop.
export async function rollSocialMeasurementSnapshot({ db, date = null }) {
  const snapshotDate = date || easternDate();
  const { data, error } = await db.rpc("refresh_social_measurement", { p_date: snapshotDate });
  return {
    ok: !error,
    error: error?.message || null,
    date: snapshotDate,
    snapshots: Number(data?.snapshots ?? 0),
    items_updated: Number(data?.items_updated ?? 0),
  };
}

export async function refreshSocialMeasurement() {
  const user = await requireOfficeUser();
  const db = getSupabaseAdmin();
  const rolled = await rollSocialMeasurementSnapshot({ db });
  await audit("refresh_social_measurement", user, {
    snapshot_date: rolled.date,
    snapshots: rolled.snapshots,
    items_updated: rolled.items_updated,
  }, null, rolled.ok ? "completed" : "failed", rolled.ok ? null : "measurement_failed");
  revalidatePath(DISTRIBUTION_PATH);
  return redirect(rolled.ok
    ? `${DISTRIBUTION_PATH}?success=measured`
    : `${DISTRIBUTION_PATH}?error=measurement_failed`);
}