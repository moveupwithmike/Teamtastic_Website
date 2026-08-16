"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import { requireOfficeUser } from "@/lib/server/office-auth";
import { audit, clean } from "./shared";


export async function prepareDistributionQueue() {
  const user=await requireOfficeUser();const db=getSupabaseAdmin();const month=new Date().toISOString().slice(0,7)+"-01";
  const {data,error}=await db.rpc("prepare_distribution_queue",{p_month:month});
  await audit("prepare_distribution_queue",user,{result:data,automatic_publishing:false},null,error?"failed":"completed",error?.message);
  revalidatePath("/office/distribution");redirect(error?"/office/distribution?error=prepare_failed":"/office/distribution?success=prepared");
}

export async function reviewDistributionItem(formData) {
  const user=await requireOfficeUser();const db=getSupabaseAdmin();const id=clean(formData.get("id"),50);const decision=clean(formData.get("decision"),20);
  const {data:item}=await db.from("distribution_items").select("id,status").eq("id",id).single();if(!item)redirect("/office/distribution?error=missing");
  let update;if(decision==="approve"&&item.status==="draft")update={status:"approved",body_text:clean(formData.get("body_text"),10000),decision:{approved_by:user.email,automatic_publishing:false}};
  else if(decision==="reject"&&item.status==="draft")update={status:"rejected",decision:{rejected_by:user.email}};
  else if(decision==="schedule"&&item.status==="approved"){const when=clean(formData.get("scheduled_for"),40);if(!when)redirect("/office/distribution?error=schedule_required");update={status:"scheduled",scheduled_for:new Date(when).toISOString()};}
  else if(decision==="published"&&["approved","scheduled"].includes(item.status)){const url=clean(formData.get("published_url"),2000);if(!url)redirect("/office/distribution?error=published_url_required");update={status:"published",published_at:new Date().toISOString(),published_url:url};}
  else redirect("/office/distribution?error=transition_invalid");
  const {error}=await db.from("distribution_items").update(update).eq("id",id).eq("status",item.status);await audit("review_distribution_item",user,{item_id:id,decision,automatic_publishing:false},null,error?"failed":"completed",error?.message);
  revalidatePath("/office/distribution");redirect(error?"/office/distribution?error=update_failed":"/office/distribution?success=updated");
}
