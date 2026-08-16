"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import { requireOfficeUser } from "@/lib/server/office-auth";
import { audit, clean } from "./shared";


export async function configureWarmRelationshipSignals(formData){
  const user=await requireOfficeUser(),db=getSupabaseAdmin(),enabled=formData.get("enabled")==="on",days=Number(formData.get("reactivation_days"));
  if(!Number.isInteger(days)||days<14||days>730)redirect("/office/warm-signals?error=invalid_settings");
  const {error}=await db.from("system_config").update({warm_relationship_signals_enabled:enabled,closed_lost_reactivation_days:days,updated_at:new Date().toISOString(),updated_by:user.email}).eq("id",true);
  await audit("configure_warm_relationship_signals",user,{enabled,reactivation_days:days,automatic_sending:false},null,error?"failed":"completed",error?.message);
  if(!error&&enabled)await db.rpc("queue_closed_lost_reactivations");
  revalidatePath("/office/warm-signals");redirect(error?"/office/warm-signals?error=settings_failed":"/office/warm-signals?success=settings_saved");
}

export async function recordWarmRelationshipSignal(formData){
  const user=await requireOfficeUser(),db=getSupabaseAdmin(),prospectId=clean(formData.get("prospect_id"),50),type=clean(formData.get("signal_type"),50),evidence=clean(formData.get("evidence"),2000),sourceUrl=clean(formData.get("source_url"),2000),observed=clean(formData.get("observed_at"),40);
  const allowed=["job_change","new_people_ops_hire","promotion","closed_lost_reactivation","past_champion"];
  if(!prospectId||!allowed.includes(type)||evidence.length<5)redirect("/office/warm-signals?error=invalid_signal");
  const {data,error}=await db.rpc("record_warm_relationship_signal",{p_prospect_id:prospectId,p_signal_type:type,p_evidence:evidence,p_source:"office_manual",p_observed_at:observed?new Date(observed).toISOString():new Date().toISOString(),p_source_url:sourceUrl||null,p_strength:type==="closed_lost_reactivation"?0.7:0.85,p_metadata:{recorded_by:user.email}});
  await audit("record_warm_relationship_signal",user,{signal_type:type,result:data,automatic_sending:false},prospectId,error?"failed":data?.recorded?"completed":"blocked",error?.message||data?.reason);
  revalidatePath("/office/warm-signals");revalidatePath(`/office/prospects/${prospectId}`);redirect(error||!data?.recorded?`/office/warm-signals?error=${encodeURIComponent(error?.message||data?.reason||"signal_failed")}`:"/office/warm-signals?success=signal_recorded");
}

export async function reviewWarmRelationshipSignal(formData){
  const user=await requireOfficeUser(),db=getSupabaseAdmin(),id=clean(formData.get("id"),50),status=clean(formData.get("status"),20);
  if(!id||!["reviewed","actioned","dismissed"].includes(status))redirect("/office/warm-signals?error=invalid_review");
  const {data:signal,error}=await db.from("warm_relationship_signals").update({status,metadata:{reviewed_by:user.email,reviewed_at:new Date().toISOString()}}).eq("id",id).select("prospect_id").single();
  if(!error&&status!=="reviewed")await db.from("tasks").update({status:status==="actioned"?"completed":"cancelled"}).eq("source",`warm_relationship:${id}`).in("status",["open","in_progress"]);
  await audit("review_warm_relationship_signal",user,{signal_id:id,status},signal?.prospect_id,error?"failed":"completed",error?.message);
  revalidatePath("/office/warm-signals");redirect(error?"/office/warm-signals?error=review_failed":"/office/warm-signals?success=review_saved");
}
