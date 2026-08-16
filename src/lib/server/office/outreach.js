"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import { requireOfficeUser } from "@/lib/server/office-auth";
import { audit, clean } from "./shared";


export async function reviewOutreachDraft(formData) {
  const user = await requireOfficeUser();
  const id = clean(formData.get("id"), 50);
  const decision = clean(formData.get("decision"), 20);
  if (!id || !["approve", "reject"].includes(decision)) return;

  const db = getSupabaseAdmin();
  const { data: existing, error: readError } = await db.from("outreach_drafts").select("id,prospect_id,status").eq("id", id).single();
  if (readError || !existing || !["draft", "review"].includes(existing.status)) return;

  const update = decision === "approve" ? {
    subject: clean(formData.get("subject"), 300),
    body_text: clean(formData.get("body_text"), 10000),
    status: "approved",
    approved_at: new Date().toISOString(),
    approved_by: user.email,
    approval_notes: clean(formData.get("notes"), 1000) || null,
  } : {
    status: "rejected",
    approval_notes: clean(formData.get("notes"), 1000) || "Rejected in Office",
  };
  const { error } = await db.from("outreach_drafts").update(update).eq("id", id);
  await audit("review_outreach_draft", user, { draft_id: id, decision }, existing.prospect_id, error ? "failed" : "completed", error?.message);
  revalidatePath("/office");
}
