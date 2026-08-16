"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOfficeUser } from "@/lib/server/office-auth";
import * as salesResponse from "@/lib/server/office/sales-response";


export async function createSalesResponseDraft(formData) {
  const user = await requireOfficeUser();
  const result = await salesResponse.createSalesResponseDraft(user, formData);
  if (!result.ok) redirect(`/office/respond?error=${result.errorCode}`);
  revalidatePath("/office/respond");
  redirect("/office/respond?success=draft_created");
}

export async function approveAndSendSalesResponse(formData) {
  const user = await requireOfficeUser();
  const result = await salesResponse.approveAndSendSalesResponse(user, formData);
  if (!result.ok) redirect(`/office/respond?error=${result.errorCode}`);
  revalidatePath("/office/respond");
  revalidatePath("/office");
  redirect("/office/respond?success=response_sent");
}
