"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import { requireOfficeUser } from "@/lib/server/office-auth";
import { audit, clean } from "./shared";

export async function refreshProductionIncidents() {
  const user = await requireOfficeUser();
  const db = getSupabaseAdmin();
  const { data, error } = await db.rpc("collect_production_incidents");
  await audit("refresh_production_incidents", user, { result: data, external_actions: false }, null, error ? "failed" : "completed", error?.message);
  revalidatePath("/office/incidents");
  revalidatePath("/office/launch");
  redirect(error ? "/office/incidents?error=refresh_failed" : "/office/incidents?success=refreshed");
}

export async function updateProductionIncident(formData) {
  const user = await requireOfficeUser();
  const db = getSupabaseAdmin();
  const id = clean(formData.get("incident_id"), 50);
  const status = clean(formData.get("status"), 30);
  const note = clean(formData.get("note"), 4000);
  const owner = clean(formData.get("owner"), 120) || "michael";
  if (!["acknowledged", "monitoring", "resolved"].includes(status) || !note) redirect("/office/incidents?error=update_incomplete");
  const { data: incident } = await db.from("production_incidents").select("id,status,prospect_id").eq("id", id).single();
  if (!incident) redirect("/office/incidents?error=incident_missing");
  const update = { status, owner, updated_at: new Date().toISOString(), acknowledged_at: status === "acknowledged" ? new Date().toISOString() : undefined, resolved_at: status === "resolved" ? new Date().toISOString() : undefined, resolution: status === "resolved" ? note : undefined };
  const { error } = await db.from("production_incidents").update(update).eq("id", id);
  if (!error) await db.from("production_incident_updates").insert({ incident_id: id, update_type: status === "resolved" ? "resolved" : status === "monitoring" ? "monitoring" : incident.status === "open" ? "acknowledged" : "recovery_attempt", note, actor: user.email });
  await audit("update_production_incident", user, { incident_id: id, status, owner, note }, incident.prospect_id, error ? "failed" : "completed", error?.message);
  revalidatePath("/office/incidents");
  revalidatePath("/office/launch");
  redirect(error ? "/office/incidents?error=update_failed" : "/office/incidents?success=updated");
}
