"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import { requireOfficeUser } from "@/lib/server/office-auth";
import { validTimeZone, zonedWallTimeToUtc } from "@/lib/server/booking-time";
import { audit, clean } from "./shared";


export async function createEventCapacityHold(formData) {
  const user = await requireOfficeUser();
  const leadId = clean(formData.get("lead_id"), 50);
  const date = clean(formData.get("date"), 10);
  const time = clean(formData.get("time"), 5);
  const timezone = clean(formData.get("timezone"), 100);
  const duration = Number(formData.get("duration_minutes") || 60);
  const holdHours = Number(formData.get("hold_hours") || 48);
  if (!leadId || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time) || !validTimeZone(timezone) || duration < 30 || duration > 240 || holdHours < 1 || holdHours > 168) redirect("/office/capacity?error=invalid_hold");
  const db = getSupabaseAdmin();
  const { data: lead } = await db.from("leads").select("id,prospect_id,name,company").eq("id", leadId).single();
  if (!lead?.prospect_id) redirect("/office/capacity?error=lead_not_linked");
  const { data: deal } = await db.from("deals").select("id").eq("prospect_id", lead.prospect_id).eq("outcome", "open").order("created_at", { ascending: false }).limit(1).maybeSingle();
  const startsAt = zonedWallTimeToUtc(date, time, timezone);
  const endsAt = new Date(startsAt.getTime() + duration * 60000);
  const { data: capacity, error: capacityError } = await db.rpc("check_event_capacity", { p_starts_at: startsAt.toISOString(), p_ends_at: endsAt.toISOString() });
  if (capacityError || !capacity?.available) redirect(`/office/capacity?error=${encodeURIComponent(capacity?.reason || "capacity_check_failed")}`);
  const { error } = await db.from("event_capacity_holds").insert({ host_id: capacity.host_id, lead_id: lead.id, prospect_id: lead.prospect_id, deal_id: deal?.id || null, starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(), expires_at: new Date(Date.now() + holdHours * 3600000).toISOString(), note: clean(formData.get("note"), 1000) || `${lead.company || lead.name} holiday request`, created_by: user.email });
  await audit("create_event_capacity_hold", user, { lead_id: leadId, deal_id: deal?.id, starts_at: startsAt.toISOString(), available: capacity?.available }, lead.prospect_id, error ? "failed" : "completed", error?.message);
  if (error) redirect("/office/capacity?error=hold_create_failed");
  revalidatePath("/office/capacity"); revalidatePath("/office");
  redirect("/office/capacity?success=hold_created");
}

export async function releaseEventCapacityHold(formData) {
  const user = await requireOfficeUser();
  const id = clean(formData.get("id"), 50);
  const db = getSupabaseAdmin();
  const { data, error } = await db.from("event_capacity_holds").update({ status: "released", updated_at: new Date().toISOString() }).eq("id", id).in("status", ["tentative", "confirmed"]).select("prospect_id").maybeSingle();
  await audit("release_event_capacity_hold", user, { hold_id: id }, data?.prospect_id, error || !data ? "failed" : "completed", error?.message);
  if (error || !data) redirect("/office/capacity?error=hold_release_failed");
  revalidatePath("/office/capacity"); redirect("/office/capacity?success=hold_released");
}

export async function updateEventCapacityHost(formData) {
  const user = await requireOfficeUser();
  const id = clean(formData.get("id"), 50);
  const maximum = Number(formData.get("max_concurrent_events"));
  const timezone = clean(formData.get("timezone"), 100);
  const blockedDates = clean(formData.get("blocked_dates"), 500).split(",").map(x => x.trim()).filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x));
  if (!id || maximum < 1 || maximum > 20 || !validTimeZone(timezone)) redirect("/office/capacity?error=invalid_host_settings");
  const db = getSupabaseAdmin();
  const { error } = await db.from("event_capacity_hosts").update({ max_concurrent_events: maximum, timezone, blocked_dates: blockedDates, updated_at: new Date().toISOString() }).eq("id", id);
  await audit("update_event_capacity_host", user, { host_id: id, max_concurrent_events: maximum, timezone, blocked_dates: blockedDates }, null, error ? "failed" : "completed", error?.message);
  if (error) redirect("/office/capacity?error=host_update_failed");
  revalidatePath("/office/capacity"); redirect("/office/capacity?success=host_updated");
}
