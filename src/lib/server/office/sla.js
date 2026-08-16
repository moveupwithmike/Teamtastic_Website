"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import { requireOfficeUser } from "@/lib/server/office-auth";
import { audit, clean } from "./shared";

export async function refreshHolidaySlaEscalations() {
  const user = await requireOfficeUser();
  const db = getSupabaseAdmin();
  const { data, error } = await db.rpc("escalate_holiday_sla");
  await audit("refresh_holiday_sla_escalations", user, { result: data, external_messages: false }, null, error ? "failed" : "completed", error?.message);
  revalidatePath("/office/sla");
  revalidatePath("/office");
  redirect(error ? "/office/sla?error=escalation_failed" : "/office/sla?success=escalations_refreshed");
}

export async function resolveHolidayEscalation(formData) {
  const user = await requireOfficeUser();
  const db = getSupabaseAdmin();
  const id = clean(formData.get("task_id"), 50);
  const { data: task } = await db.from("tasks").select("id,prospect_id,source,status").eq("id", id).single();
  if (!task || task.source !== "holiday_sla_escalation" || !["open", "in_progress"].includes(task.status)) redirect("/office/sla?error=escalation_missing");
  const { error } = await db.from("tasks").update({ status: "completed", updated_at: new Date().toISOString() }).eq("id", id).eq("source", "holiday_sla_escalation");
  await audit("resolve_holiday_sla_escalation", user, { task_id: id, manual_resolution: true }, task.prospect_id, error ? "failed" : "completed", error?.message);
  revalidatePath("/office/sla");
  redirect(error ? "/office/sla?error=resolve_failed" : "/office/sla?success=escalation_resolved");
}
