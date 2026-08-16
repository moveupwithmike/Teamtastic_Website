"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import { requireOfficeUser } from "@/lib/server/office-auth";
import { audit, clean } from "./shared";


export async function startB2bCertification() {
  const user = await requireOfficeUser();
  const db = getSupabaseAdmin();
  const {data:run,error:runError}=await db.from("b2b_certification_runs").insert({started_by:user.email}).select("id").single();
  if(runError||!run) redirect("/office/certification?error=start_failed");
  const year=new Date().getUTCFullYear();
  const eventDate=`${year}-12-10`;
  const sources=["holiday_party_money_page","year_end_celebration_page","large_holiday_event_page"];
  const rows=sources.map((source,index)=>{const submissionId=randomUUID();return {submission_id:submissionId,name:`Certification Buyer ${index+1}`,email:`cert+${run.id.slice(0,8)}-${index+1}@example.com`,email_normalized:`cert+${run.id.slice(0,8)}-${index+1}@example.com`,company:`Teamtastic Certification ${run.id.slice(0,8)}`,phone:"+1 555 010 0000",team_size:index===2?"150-300":"25-74",vibe:"high-energy",occasion:"Synthetic holiday certification",lead_source:source,status:"new",landing_page:index===0?"/virtual-holiday-party":index===1?"/virtual-year-end-team-celebration":"/virtual-holiday-party-for-large-groups",preferred_event_date:eventDate,alternate_event_date:`${year}-12-11`,event_timezone:"America/New_York",preferred_time:"2:00 PM",budget_range:index===2?"$5,000+":"$2,000-$5,000",package_interest:"Hosted 60-minute experience",decision_timeline:"this-week",context:{synthetic_test:true,certification_run_id:run.id,external_send:false,preferredEventDate:eventDate}};});
  const {data:leads,error}=await db.from("leads").insert(rows).select("id");
  if(error||leads?.length!==3){await db.from("b2b_certification_runs").update({status:"failed",failed_count:1,checkpoints:[{key:"lead_creation",passed:false,detail:error?.message||"Expected three leads"}],completed_at:new Date().toISOString()}).eq("id",run.id);redirect(`/office/certification?run=${run.id}&error=lead_creation_failed`);}
  await db.from("b2b_certification_runs").update({lead_ids:leads.map(x=>x.id)}).eq("id",run.id);
  await audit("start_b2b_certification",user,{run_id:run.id,lead_ids:leads.map(x=>x.id),synthetic_test:true,external_send:false});
  revalidatePath("/office/certification");
  redirect(`/office/certification?run=${run.id}&success=started`);
}

export async function verifyB2bCertification(formData) {
  const user=await requireOfficeUser(),runId=clean(formData.get("run_id"),50),db=getSupabaseAdmin();
  const {data:run}=await db.from("b2b_certification_runs").select("*").eq("id",runId).single();
  if(!run) redirect("/office/certification?error=run_missing");
  const {data:leads=[]}=await db.from("leads").select("*").in("id",run.lead_ids||[]);
  if(leads.length!==3||leads.some(x=>!x.prospect_id)) redirect(`/office/certification?run=${runId}&error=crm_sync_pending`);
  let stripeEventId=run.stripe_event_id;
  if(!stripeEventId){const lead=leads[0],token=runId.replaceAll("-","");const {data:payment,error}=await db.from("stripe_events").insert({stripe_event_id:`evt_cert_${token}`,stripe_session_id:`cs_test_cert_${token}`,lead_id:lead.id,submission_id:lead.submission_id,customer_email:lead.email,amount_total:20000,currency:"usd",payment_status:"paid",checkout_mode:"payment",product_key:"hosted_event_deposit",paid_at:new Date().toISOString(),matched:true,alert_status:"sent"}).select("id").single();if(error||!payment)redirect(`/office/certification?run=${runId}&error=deposit_failed`);stripeEventId=payment.id;await db.from("b2b_certification_runs").update({stripe_event_id:stripeEventId}).eq("id",runId);const {error:conversionError}=await db.rpc("process_synthetic_paid_conversion",{p_stripe_event_id:stripeEventId});if(conversionError)redirect(`/office/certification?run=${runId}&error=conversion_failed`);}
  const prospectIds=leads.map(x=>x.prospect_id),leadIds=leads.map(x=>x.id);
  const [notifications,tasks,deals,payments,conversions,messages]=await Promise.all([
    db.from("notification_deliveries").select("id,status").in("lead_id",leadIds),
    db.from("tasks").select("id,source,fingerprint,title").in("prospect_id",prospectIds),
    db.from("deals").select("id,prospect_id,next_action,next_action_due_at,stage,outcome,client_id,event_id").in("prospect_id",prospectIds),
    db.from("deal_payments").select("id").eq("stripe_event_id",stripeEventId),
    db.from("client_conversions").select("id,status,client_id,event_id").eq("stripe_event_id",stripeEventId),
    db.from("messages").select("id").in("prospect_id",prospectIds).not("provider_message_id","is",null)
  ]);
  const taskRows=tasks.data||[],dealRows=deals.data||[],conversion=conversions.data?.[0];
  const checkpoints=[
    {key:"three_capture_pages",label:"All three holiday capture paths",passed:leads.length===3,detail:`${leads.length}/3 synthetic leads persisted`},
    {key:"qualification_fields",label:"Qualification fields",passed:leads.every(x=>x.preferred_event_date&&x.event_timezone&&x.preferred_time&&x.budget_range&&x.decision_timeline),detail:"Date, time zone, time, budget, and decision timing retained"},
    {key:"crm_sync",label:"CRM prospect synchronization",passed:leads.every(x=>x.prospect_id),detail:`${prospectIds.length}/3 prospects linked`},
    {key:"deal_creation",label:"Deal creation and next actions",passed:dealRows.length===3&&dealRows.every(x=>x.next_action&&x.next_action_due_at),detail:`${dealRows.length}/3 deals with next actions`},
    {key:"notifications",label:"Notification workflow without external sends",passed:(notifications.data||[]).length===6&&(notifications.data||[]).every(x=>x.status==="test_suppressed"),detail:`${(notifications.data||[]).length}/6 notification records safely suppressed`},
    {key:"response_tasks",label:"15-minute response tasks",passed:taskRows.filter(x=>x.fingerprint?.startsWith("holiday:speed-to-lead:")).length===3,detail:"One speed-to-lead task per capture path"},
    {key:"followups",label:"Day 1, 3, and 7 follow-ups",passed:taskRows.filter(x=>x.fingerprint?.startsWith("holiday:followup:")).length===9,detail:`${taskRows.filter(x=>x.fingerprint?.startsWith("holiday:followup:")).length}/9 follow-ups created`},
    {key:"december_risk",label:"December capacity warnings",passed:taskRows.filter(x=>x.fingerprint?.startsWith("holiday:december-risk:")).length===3,detail:"All December requests flagged"},
    {key:"deposit_attribution",label:"Deposit attribution and deal progression",passed:(payments.data||[]).length===1&&dealRows.some(x=>["deposit_paid","event_scheduled"].includes(x.stage)),detail:"Synthetic $200 deposit linked idempotently"},
    {key:"portal_handoff",label:"Client portal handoff",passed:Boolean(conversion?.client_id&&conversion?.event_id),detail:conversion?`Conversion status: ${conversion.status}`:"No client conversion found"},
    {key:"duplicate_safety",label:"Duplicate protection",passed:new Set(leads.map(x=>x.submission_id)).size===3&&(payments.data||[]).length===1,detail:"Unique submissions and one payment attribution"},
    {key:"zero_external_messages",label:"Zero external messages",passed:(messages.data||[]).length===0,detail:`${(messages.data||[]).length} provider messages created`},
  ];
  const failed=checkpoints.filter(x=>!x.passed).length,passed=checkpoints.length-failed;
  await db.from("b2b_certification_runs").update({status:failed?"failed":"passed",checkpoints,passed_count:passed,failed_count:failed,external_messages_sent:0,completed_at:new Date().toISOString()}).eq("id",runId);
  await audit("verify_b2b_certification",user,{run_id:runId,passed,failed,external_send:false});
  revalidatePath("/office/certification");revalidatePath("/office/launch");
  redirect(`/office/certification?run=${runId}&${failed?"error=checks_failed":"success=passed"}`);
}

export async function refreshFinalCertification(formData){const user=await requireOfficeUser(),db=getSupabaseAdmin(),id=clean(formData.get("id"),50);const {data,error}=await db.rpc("observe_final_production_certifications");await audit("refresh_final_certification",user,{certification_id:id,result:data},null,error?"failed":"completed",error?.message);revalidatePath("/office/final-certification");redirect(error?"/office/final-certification?error=refresh_failed":"/office/final-certification?success=refreshed");}

export async function signOffFinalCertification(formData){const user=await requireOfficeUser(),db=getSupabaseAdmin(),id=clean(formData.get("id"),50);const {data,error}=await db.rpc("sign_off_final_production_certification",{p_certification_id:id,p_actor:user.email});await audit("sign_off_final_certification",user,{certification_id:id,result:data},null,error?"failed":"completed",error?.message);revalidatePath("/office/final-certification");redirect(error?"/office/final-certification?error=signoff_blocked":"/office/final-certification?success=signed_off");}

export async function recordFinalCertificationAttestation(formData){const user=await requireOfficeUser(),db=getSupabaseAdmin(),id=clean(formData.get("id"),50),key=clean(formData.get("evidence_key"),80),notes=clean(formData.get("notes"),2000),passed=formData.get("passed")==="on";const {data,error}=await db.rpc("record_final_certification_attestation",{p_certification_id:id,p_evidence_key:key,p_passed:passed,p_notes:notes,p_actor:user.email});await audit("record_final_certification_attestation",user,{certification_id:id,evidence_key:key,passed,result:data},null,error?"failed":"completed",error?.message);revalidatePath("/office/final-certification");redirect(error?"/office/final-certification?error=attestation_failed":"/office/final-certification?success=attestation_recorded");}
