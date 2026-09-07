"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import { requireOfficeUser } from "@/lib/server/office-auth";
import { audit, clean } from "./shared";
import { VOICE_KINDS } from "./social-voice";

const VOICE_PATH = "/office/voice";

function fail(code) {
  redirect(`${VOICE_PATH}?error=${code}`);
}

function parseExamples(raw) {
  return raw
    ? raw.split("\n").map((line) => line.trim()).filter(Boolean).slice(0, 8)
    : [];
}

export async function createVoiceEntry(formData) {
  const user = await requireOfficeUser();
  const db = getSupabaseAdmin();
  const kind = clean(formData.get("kind"), 40);
  const body = clean(formData.get("body"), 2000);
  if (!VOICE_KINDS.includes(kind)) fail("voice_kind_invalid");
  if (!body) fail("incomplete");

  const payload = {
    kind,
    body,
    label: clean(formData.get("label"), 120) || null,
    source: clean(formData.get("source"), 200) || "Office voice page",
    source_ref: clean(formData.get("source_ref"), 200) || null,
    examples: parseExamples(formData.get("examples")),
    sort_order: Number.parseInt(formData.get("sort_order") || "0", 10) || 0,
    enabled: formData.get("enabled") === "on",
    approved_by: user.email,
    approved_at: new Date().toISOString(),
  };
  const { data, error } = await db.from("social_voice_entries").insert(payload).select("id,kind,label,enabled").single();
  if (error || !data) fail("voice_entry_failed");
  await audit("create_voice_entry", user, { entry_id: data.id, kind, label: data.label, enabled: data.enabled });
  revalidatePath(VOICE_PATH);
  redirect(`${VOICE_PATH}?success=created`);
}

export async function updateVoiceEntry(formData) {
  const user = await requireOfficeUser();
  const db = getSupabaseAdmin();
  const id = clean(formData.get("id"), 60);
  if (!id) fail("incomplete");
  const { data: entry } = await db.from("social_voice_entries").select("id").eq("id", id).maybeSingle();
  if (!entry) fail("voice_entry_missing");

  const changes = {};
  if (formData.has("body")) changes.body = clean(formData.get("body"), 2000);
  if (formData.has("label")) changes.label = clean(formData.get("label"), 120) || null;
  if (formData.has("examples")) changes.examples = parseExamples(formData.get("examples"));
  if (formData.has("enabled")) changes.enabled = formData.get("enabled") === "on";
  if (formData.has("enabled") && changes.enabled) {
    changes.approved_by = user.email;
    changes.approved_at = new Date().toISOString();
  }
  if (!Object.keys(changes).length) redirect(`${VOICE_PATH}?success=updated`);
  const { error } = await db.from("social_voice_entries").update(changes).eq("id", id);
  if (error) fail("voice_entry_failed");
  await audit("update_voice_entry", user, { entry_id: id, changed: Object.keys(changes) });
  revalidatePath(VOICE_PATH);
  redirect(`${VOICE_PATH}?success=updated`);
}

export async function deleteVoiceEntry(formData) {
  const user = await requireOfficeUser();
  const db = getSupabaseAdmin();
  const id = clean(formData.get("id"), 60);
  if (!id) fail("incomplete");
  const { error } = await db.from("social_voice_entries").delete().eq("id", id);
  if (error) fail("voice_entry_failed");
  await audit("delete_voice_entry", user, { entry_id: id });
  revalidatePath(VOICE_PATH);
  redirect(`${VOICE_PATH}?success=deleted`);
}