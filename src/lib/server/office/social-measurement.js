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
export async function refreshSocialMeasurement() {
  const user = await requireOfficeUser();
  const db = getSupabaseAdmin();
  const snapshotDate = easternDate();
  const { data, error } = await db.rpc("refresh_social_measurement", { p_date: snapshotDate });
  await audit("refresh_social_measurement", user, {
    snapshot_date: snapshotDate,
    snapshots: data?.snapshots ?? 0,
    items_updated: data?.items_updated ?? 0,
  }, null, error ? "failed" : "completed", error ? "measurement_failed" : null);
  revalidatePath(DISTRIBUTION_PATH);
  return redirect(error
    ? `${DISTRIBUTION_PATH}?error=measurement_failed`
    : `${DISTRIBUTION_PATH}?success=measured`);
}