"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import { requireOfficeUser } from "@/lib/server/office-auth";
import * as growthExperiments from "@/lib/server/office/growth-experiments";
import { audit, clean, money } from "./shared";

export async function refreshGrowthBrief() {
  const user = await requireOfficeUser();
  const result = await growthExperiments.refreshGrowthBrief(user);
  revalidatePath("/office/growth");
  redirect(result.ok ? "/office/growth?success=refreshed" : `/office/growth?error=${result.errorCode}`);
}

export async function saveCampaignAdSpend(formData) {
  const user=await requireOfficeUser();
  const spendDate=clean(formData.get("spend_date"),10),source=clean(formData.get("utm_source"),100).toLowerCase();
  const medium=clean(formData.get("utm_medium"),100).toLowerCase()||"paid";
  const campaign=clean(formData.get("utm_campaign"),200).toLowerCase()||"unattributed";
  const landingPage=clean(formData.get("landing_page"),500)||"all";
  const amount=money(formData.get("amount"));
  if(!/^\d{4}-\d{2}-\d{2}$/.test(spendDate)||!source||amount===null)redirect("/office/roi?error=invalid_spend");
  const db=getSupabaseAdmin();
  const {data:normalized}=await db.rpc("normalize_campaign_value",{p_kind:"source",p_value:source});
  const {data:normalizedMedium}=await db.rpc("normalize_campaign_value",{p_kind:"medium",p_value:medium});
  const {data:normalizedCampaign}=await db.rpc("normalize_campaign_value",{p_kind:"campaign",p_value:campaign});
  const row={spend_date:spendDate,utm_source:normalized||source,utm_medium:normalizedMedium||medium,utm_campaign:normalizedCampaign||campaign,landing_page:landingPage,spend_cents:Math.round(amount*100),currency:"usd",notes:clean(formData.get("notes"),1000)||null,created_by:user.email};
  const {error}=await db.from("campaign_ad_spend").upsert(row,{onConflict:"spend_date,utm_source,utm_medium,utm_campaign,landing_page"});
  await audit("save_campaign_ad_spend",user,{...row,spend_cents:row.spend_cents},null,error?"failed":"completed",error?.message);
  if(error)redirect("/office/roi?error=spend_save_failed");
  revalidatePath("/office/roi"); redirect("/office/roi?success=spend_saved");
}

export async function overrideLeadScore(formData) {
  const user=await requireOfficeUser(),leadId=clean(formData.get("lead_id"),50),mode=clean(formData.get("mode"),20),db=getSupabaseAdmin();
  const reason=clean(formData.get("reason"),1000),score=Number(formData.get("score"));
  if(!leadId||!['set','clear'].includes(mode)||mode==='set'&&(!Number.isInteger(score)||score<0||score>100||!reason))redirect("/office/scoring?error=invalid_override");
  const update=mode==='clear'?{lead_score_override:null,lead_score_override_reason:null,lead_score_overridden_by:null,lead_score_overridden_at:null}:{lead_score_override:score,lead_score_override_reason:reason,lead_score_overridden_by:user.email,lead_score_overridden_at:new Date().toISOString()};
  const {data:lead,error}=await db.from("leads").update(update).eq("id",leadId).select("prospect_id").single();
  const {data:result,error:scoreError}=error?{data:null,error}:await db.rpc("score_event_lead",{p_lead_id:leadId});
  await audit(mode==='clear'?"clear_lead_score_override":"set_lead_score_override",user,{lead_id:leadId,score:mode==='set'?score:null,reason:reason||null,result},lead?.prospect_id,error||scoreError?"failed":"completed",error?.message||scoreError?.message);
  if(error||scoreError)redirect("/office/scoring?error=override_failed");
  revalidatePath("/office/scoring");revalidatePath("/office");redirect(`/office/scoring?success=${mode==='clear'?"override_cleared":"override_saved"}`);
}

export async function refreshLeadScores() {
  const user=await requireOfficeUser(),db=getSupabaseAdmin();const {data,error}=await db.rpc("refresh_event_lead_scores",{p_days:730});
  await audit("refresh_event_lead_scores",user,{result:data},null,error?"failed":"completed",error?.message);
  if(error)redirect("/office/scoring?error=refresh_failed");revalidatePath("/office/scoring");redirect("/office/scoring?success=scores_refreshed");
}

export async function reviewGrowthBrief(formData) {
  const user = await requireOfficeUser();
  const result = await growthExperiments.reviewGrowthBrief(user, formData);
  revalidatePath("/office/growth");
  redirect(result.ok ? "/office/growth?success=reviewed" : `/office/growth?error=${result.errorCode}`);
}

export async function prepareGrowthExperiments() {
  const user = await requireOfficeUser();
  const result = await growthExperiments.prepareGrowthExperiments(user);
  revalidatePath("/office/growth");
  redirect(result.ok ? "/office/growth?success=experiments_prepared" : `/office/growth?error=${result.errorCode}`);
}

export async function updateGrowthExperiment(formData) {
  const user = await requireOfficeUser();
  const result = await growthExperiments.updateGrowthExperiment(user, formData);
  revalidatePath("/office/growth");
  redirect(result.ok ? "/office/growth?success=experiment_updated" : `/office/growth?error=${result.errorCode}`);
}
