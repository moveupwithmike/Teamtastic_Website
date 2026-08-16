"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import { requireOfficeUser } from "@/lib/server/office-auth";
import { audit, clean } from "./shared";

export async function transitionB2bLaunch(formData) {
  const user = await requireOfficeUser();
  const db = getSupabaseAdmin();
  const action = clean(formData.get("launch_action"), 30);
  const reason = clean(formData.get("reason"), 1000) || null;
  const rawCap = Number(formData.get("daily_cap"));
  if (!["begin_pilot", "enable_proposals", "enable_outbound", "pause", "rollback"].includes(action)) redirect("/office/activation?error=invalid_action");
  const dailyCap = Number.isFinite(rawCap) ? Math.min(10, Math.max(1, Math.round(rawCap))) : 5;
  const { data, error } = await db.rpc("transition_b2b_launch", { p_action: action, p_actor: user.email, p_reason: reason, p_daily_cap: dailyCap });
  const failure = error?.message || (!data?.changed ? data?.reason : null);
  await audit("transition_b2b_launch", user, { action, reason, daily_cap: dailyCap, result: data }, null, failure ? "blocked" : "completed", failure);
  revalidatePath("/office/activation");
  revalidatePath("/office/launch");
  revalidatePath("/office/settings");
  redirect(failure ? `/office/activation?error=${encodeURIComponent(failure)}` : `/office/activation?success=${action}`);
}
