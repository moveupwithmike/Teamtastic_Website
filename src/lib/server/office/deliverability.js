"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import { requireOfficeUser } from "@/lib/server/office-auth";
import { audit } from "./shared";

export async function resumeOutboundAfterDeliverabilityReview(formData) {
  const user = await requireOfficeUser();
  const db = getSupabaseAdmin();
  const confirmed = ["domains_confirmed", "failures_reviewed", "suppressions_reviewed"].every((key) => formData.get(key) === "on");
  if (!confirmed) redirect("/office/deliverability?error=resume_checklist_required");
  const { data: health, error: healthError } = await db.rpc("check_outbound_deliverability");
  if (healthError || health?.paused) redirect("/office/deliverability?error=threshold_still_exceeded");
  const { error } = await db.from("system_config").update({ outbound_auto_paused: false, updated_at: new Date().toISOString(), updated_by: user.email }).eq("id", true);
  await audit("resume_outbound_after_deliverability_review", user, { health, checklist_confirmed: true }, null, error ? "failed" : "completed", error?.message);
  revalidatePath("/office/deliverability");
  revalidatePath("/office/settings");
  revalidatePath("/office/activation");
  redirect(error ? "/office/deliverability?error=resume_failed" : "/office/deliverability?success=resumed");
}
