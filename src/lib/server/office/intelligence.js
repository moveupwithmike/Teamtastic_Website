"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import { requireOfficeUser } from "@/lib/server/office-auth";
import { audit } from "./shared";

export async function refreshAudienceIntelligence() {
  const user = await requireOfficeUser();
  const db = getSupabaseAdmin();
  const { data, error } = await db.rpc("prepare_audience_snapshot", { p_snapshot_date: new Date().toISOString().slice(0, 10) });
  await audit("refresh_audience_intelligence", user, { result: data, raw_message_text_exposed: false }, null, error ? "failed" : "completed", error?.message);
  revalidatePath("/office/audience");
  redirect(error ? "/office/audience?error=refresh_failed" : "/office/audience?success=refreshed");
}

export async function refreshDailyGrowthAgenda() {
  const user = await requireOfficeUser();
  const db = getSupabaseAdmin();
  const { data, error } = await db.rpc("prepare_daily_growth_agenda", { p_agenda_date: new Date().toISOString().slice(0, 10) });
  await audit("refresh_daily_growth_agenda", user, { result: data, automatic_external_actions: false }, null, error ? "failed" : "completed", error?.message);
  revalidatePath("/office/roadmap");
  redirect(error ? "/office/roadmap?error=refresh_failed" : "/office/roadmap?success=refreshed");
}
