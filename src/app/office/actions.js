"use server";

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireOfficeUser } from "@/lib/server/office-auth";
import { createHelpfulDraft, organicFingerprint, scoreOrganicIntent } from "@/lib/server/organic-intent";
import { validTimeZone, zonedWallTimeToUtc } from "@/lib/server/booking-time";
import { sendViaResend } from "@/lib/server/email";
import { HTTP_TIMEOUT_MS } from "@/lib/server/http";
import * as growthExperiments from "@/lib/server/office/growth-experiments";
import * as salesResponse from "@/lib/server/office/sales-response";

function clean(value, max = 10000) {
  return String(value || "").trim().slice(0, max);
}

function money(value) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

async function audit(action, user, decision = {}, prospectId = null, outcome = "completed", error = null) {
  const db = getSupabaseAdmin();
  await db.from("agent_log").insert({
    agent_name: "office",
    action,
    outcome,
    prospect_id: prospectId,
    decision: { ...decision, actor: user.email },
    error,
  });
}

export async function requestMagicLink(formData) {
  const requestedEmail = clean(formData.get("email"), 320).toLowerCase();
  const allowedEmail = (process.env.OFFICE_ALLOWED_EMAIL || process.env.INTERNAL_NOTIFICATION_EMAIL || "").trim().toLowerCase();
  if (!allowedEmail || requestedEmail !== allowedEmail) redirect("/office/login?sent=1");

  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL
    || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "https://www.teamtastic.events");
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) redirect("/office/login?error=send_failed");

  const admin = getSupabaseAdmin();
  const { data: claimed, error: claimError } = await admin
    .rpc("try_claim_magic_link_send", { p_email: allowedEmail });
  if (claimError || claimed !== true) redirect("/office/login?sent=1");

  const { data, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: allowedEmail,
  });
  const tokenHash = data?.properties?.hashed_token;
  if (linkError || !tokenHash) {
    await admin.from("agent_log").insert({
      agent_name: "office",
      action: "office_magic_link_sent",
      outcome: "failed",
      error: linkError?.message || "Supabase did not return a token hash",
    });
    redirect("/office/login?error=send_failed");
  }

  const signInUrl = new URL("/auth/callback", configuredOrigin);
  signInUrl.searchParams.set("token_hash", tokenHash);
  signInUrl.searchParams.set("type", "email");
  signInUrl.searchParams.set("next", "/office");
  const safeUrl = signInUrl.toString().replaceAll("&", "&amp;");
  const { reserved, sent, providerMessageId, reason } = await sendViaResend(admin, {
    messageType: "internal_notification",
    recipient: allowedEmail,
    from,
    subject: "Your Teamtastic Office sign-in link",
    html: `<div style="font-family:Arial,sans-serif;color:#172033;line-height:1.6"><h2>Sign in to Teamtastic Office</h2><p>Use the secure button below to open your private sales command center.</p><p><a href="${safeUrl}" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:700">Open Teamtastic Office</a></p><p style="color:#64748b;font-size:13px">This one-time link expires shortly. If you did not request it, you can ignore this email.</p></div>`,
    text: `Sign in to Teamtastic Office:\n\n${signInUrl.toString()}\n\nThis one-time link expires shortly. If you did not request it, you can ignore this email.`,
    idempotencyKey: `office-magic-link/${tokenHash}`,
  });
  if (!reserved) {
    await admin.from("agent_log").insert({
      agent_name: "office",
      action: "office_magic_link_sent",
      outcome: "blocked",
      decision: { reason },
    });
    redirect("/office/login?error=send_failed");
  }
  await admin.from("agent_log").insert({
    agent_name: "office",
    action: "office_magic_link_sent",
    outcome: sent ? "completed" : "failed",
    decision: sent ? { provider_message_id: providerMessageId } : {},
    error: sent ? null : reason,
  });
  if (!sent) redirect("/office/login?error=send_failed");
  redirect("/office/login?sent=1");
}

export async function signOutOffice() {
  await requireOfficeUser();
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/office/login");
}

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

export async function transitionB2bLaunch(formData){
  const user=await requireOfficeUser(),db=getSupabaseAdmin();
  const action=clean(formData.get("launch_action"),30),reason=clean(formData.get("reason"),1000)||null,rawCap=Number(formData.get("daily_cap"));
  if(!["begin_pilot","enable_proposals","enable_outbound","pause","rollback"].includes(action))redirect("/office/activation?error=invalid_action");
  const dailyCap=Number.isFinite(rawCap)?Math.min(10,Math.max(1,Math.round(rawCap))):5;
  const {data,error}=await db.rpc("transition_b2b_launch",{p_action:action,p_actor:user.email,p_reason:reason,p_daily_cap:dailyCap});
  const failure=error?.message||(!data?.changed?data?.reason:null);
  await audit("transition_b2b_launch",user,{action,reason,daily_cap:dailyCap,result:data},null,failure?"blocked":"completed",failure);
  revalidatePath("/office/activation");revalidatePath("/office/launch");revalidatePath("/office/settings");
  redirect(failure?`/office/activation?error=${encodeURIComponent(failure)}`:`/office/activation?success=${action}`);
}

export async function refreshHolidaySlaEscalations(){const user=await requireOfficeUser(),db=getSupabaseAdmin();const {data,error}=await db.rpc("escalate_holiday_sla");await audit("refresh_holiday_sla_escalations",user,{result:data,external_messages:false},null,error?"failed":"completed",error?.message);revalidatePath("/office/sla");revalidatePath("/office");redirect(error?"/office/sla?error=escalation_failed":"/office/sla?success=escalations_refreshed");}

export async function resolveHolidayEscalation(formData){const user=await requireOfficeUser(),db=getSupabaseAdmin(),id=clean(formData.get("task_id"),50);const {data:task}=await db.from("tasks").select("id,prospect_id,source,status").eq("id",id).single();if(!task||task.source!=="holiday_sla_escalation"||!["open","in_progress"].includes(task.status))redirect("/office/sla?error=escalation_missing");const {error}=await db.from("tasks").update({status:"completed",updated_at:new Date().toISOString()}).eq("id",id).eq("source","holiday_sla_escalation");await audit("resolve_holiday_sla_escalation",user,{task_id:id,manual_resolution:true},task.prospect_id,error?"failed":"completed",error?.message);revalidatePath("/office/sla");redirect(error?"/office/sla?error=resolve_failed":"/office/sla?success=escalation_resolved");}

export async function resumeOutboundAfterDeliverabilityReview(formData){const user=await requireOfficeUser(),db=getSupabaseAdmin();const confirmed=["domains_confirmed","failures_reviewed","suppressions_reviewed"].every(key=>formData.get(key)==="on");if(!confirmed)redirect("/office/deliverability?error=resume_checklist_required");const {data:health,error:healthError}=await db.rpc("check_outbound_deliverability");if(healthError||health?.paused)redirect("/office/deliverability?error=threshold_still_exceeded");const {error}=await db.from("system_config").update({outbound_auto_paused:false,updated_at:new Date().toISOString(),updated_by:user.email}).eq("id",true);await audit("resume_outbound_after_deliverability_review",user,{health,checklist_confirmed:true},null,error?"failed":"completed",error?.message);revalidatePath("/office/deliverability");revalidatePath("/office/settings");revalidatePath("/office/activation");redirect(error?"/office/deliverability?error=resume_failed":"/office/deliverability?success=resumed");}

export async function refreshProductionIncidents(){const user=await requireOfficeUser(),db=getSupabaseAdmin();const {data,error}=await db.rpc("collect_production_incidents");await audit("refresh_production_incidents",user,{result:data,external_actions:false},null,error?"failed":"completed",error?.message);revalidatePath("/office/incidents");revalidatePath("/office/launch");redirect(error?"/office/incidents?error=refresh_failed":"/office/incidents?success=refreshed");}

export async function updateProductionIncident(formData){const user=await requireOfficeUser(),db=getSupabaseAdmin(),id=clean(formData.get("incident_id"),50),status=clean(formData.get("status"),30),note=clean(formData.get("note"),4000),owner=clean(formData.get("owner"),120)||"michael";if(!["acknowledged","monitoring","resolved"].includes(status)||!note)redirect("/office/incidents?error=update_incomplete");const {data:incident}=await db.from("production_incidents").select("id,status,prospect_id").eq("id",id).single();if(!incident)redirect("/office/incidents?error=incident_missing");const update={status,owner,updated_at:new Date().toISOString(),acknowledged_at:status==="acknowledged"?new Date().toISOString():undefined,resolved_at:status==="resolved"?new Date().toISOString():undefined,resolution:status==="resolved"?note:undefined};const {error}=await db.from("production_incidents").update(update).eq("id",id);if(!error)await db.from("production_incident_updates").insert({incident_id:id,update_type:status==="resolved"?"resolved":status==="monitoring"?"monitoring":incident.status==="open"?"acknowledged":"recovery_attempt",note,actor:user.email});await audit("update_production_incident",user,{incident_id:id,status,owner,note},incident.prospect_id,error?"failed":"completed",error?.message);revalidatePath("/office/incidents");revalidatePath("/office/launch");redirect(error?"/office/incidents?error=update_failed":"/office/incidents?success=updated");}

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

export async function createOrganicOpportunity(formData) {
  const user = await requireOfficeUser();
  const sourceUrl = clean(formData.get("source_url"), 2000);
  const title = clean(formData.get("title"), 500);
  const excerpt = clean(formData.get("excerpt"), 5000);
  const community = clean(formData.get("community"), 200);
  if (!sourceUrl || !excerpt) redirect("/office/organic?error=incomplete");
  const db = getSupabaseAdmin();
  const [{ data: source }, { data: config }] = await Promise.all([
    db.from("organic_sources").select("id").eq("source_key", "manual").single(),
    db.from("system_config").select("organic_min_draft_score").eq("id", true).single(),
  ]);
  const scored = scoreOrganicIntent(title, excerpt);
  const fingerprint = organicFingerprint(sourceUrl, excerpt);
  const page = /75|[1-9]\d{2,}|large group/i.test(`${title} ${excerpt}`) ? "/virtual-holiday-party-for-large-groups" : /year[- ]end|inclusive|global/i.test(`${title} ${excerpt}`) ? "/virtual-year-end-team-celebration" : "/virtual-holiday-party";
  const { data: opportunity, error } = await db.from("organic_opportunities").upsert({ source_id: source?.id, source_url: sourceUrl, title: title || null, excerpt, community: community || null, intent_score: scored.score, score_reasons: scored.reasons, confidence: scored.confidence, status: "review", recommended_page: page, fingerprint, raw_data: { intake: "office", actor: user.email } }, { onConflict: "fingerprint" }).select("id,tracking_token,intent_score").single();
  if (error || !opportunity) redirect("/office/organic?error=create_failed");
  if (opportunity.intent_score >= (config?.organic_min_draft_score ?? 80)) {
    const draft = createHelpfulDraft({ excerpt, recommendedPage: page, trackingToken: opportunity.tracking_token });
    const draftFingerprint = createHash("sha256").update(`${opportunity.id}|helpful-response-v1`).digest("hex");
    await db.from("organic_response_drafts").upsert({ opportunity_id: opportunity.id, body_text: draft.bodyText, tracked_url: draft.trackedUrl, status: "review", fingerprint: draftFingerprint, decision: { generated_by: "deterministic_template", automatic_publishing: false } }, { onConflict: "fingerprint" });
    await db.from("organic_opportunities").update({ status: "drafted", updated_at: new Date().toISOString() }).eq("id", opportunity.id);
  }
  await audit("create_organic_opportunity", user, { opportunity_id: opportunity.id, score: opportunity.intent_score, automatic_publishing: false });
  revalidatePath("/office/organic");
  redirect("/office/organic?success=created");
}

export async function reviewOrganicOpportunity(formData) {
  const user = await requireOfficeUser();
  const opportunityId = clean(formData.get("opportunity_id"), 50);
  const draftId = clean(formData.get("draft_id"), 50);
  const decision = clean(formData.get("decision"), 20);
  const db = getSupabaseAdmin();
  if (decision === "dismiss") {
    await db.from("organic_opportunities").update({ status: "dismissed", updated_at: new Date().toISOString() }).eq("id", opportunityId);
    if (draftId) await db.from("organic_response_drafts").update({ status: "rejected", reviewed_at: new Date().toISOString(), reviewed_by: user.email }).eq("id", draftId);
  } else if (decision === "approve" && draftId) {
    await db.from("organic_response_drafts").update({ body_text: clean(formData.get("body_text"), 10000), status: "approved", reviewed_at: new Date().toISOString(), reviewed_by: user.email }).eq("id", draftId).eq("opportunity_id", opportunityId);
    await db.from("organic_opportunities").update({ status: "approved", updated_at: new Date().toISOString() }).eq("id", opportunityId);
  } else if (decision === "copied" && draftId) {
    await db.from("organic_response_drafts").update({ status: "copied", reviewed_at: new Date().toISOString(), reviewed_by: user.email }).eq("id", draftId).eq("opportunity_id", opportunityId).in("status", ["approved", "copied"]);
  } else if (decision === "posted" && draftId) {
    const postedUrl = clean(formData.get("posted_url"), 2000);
    if (!postedUrl) redirect("/office/organic?error=posted_url_required");
    await db.from("organic_response_drafts").update({ status: "posted", posted_url: postedUrl, posted_at: new Date().toISOString(), reviewed_by: user.email }).eq("id", draftId).eq("opportunity_id", opportunityId).in("status", ["approved", "copied"]);
    await db.from("organic_opportunities").update({ status: "posted", updated_at: new Date().toISOString() }).eq("id", opportunityId);
  }
  await audit("review_organic_opportunity", user, { opportunity_id: opportunityId, decision, automatic_publishing: false });
  revalidatePath("/office/organic");
}

function lines(value, limit = 20) {
  return clean(value, 5000).split("\n").map((item) => item.trim()).filter(Boolean).slice(0, limit);
}

export async function updateOrganicSourceConfig(formData) {
  const user = await requireOfficeUser();
  const minimumScore = Number(formData.get("minimum_capture_score"));
  const maximumAge = Number(formData.get("maximum_post_age_days"));
  const config = {
    queries: lines(formData.get("queries"), 5),
    excluded_terms: lines(formData.get("excluded_terms"), 30).map((v) => v.toLowerCase()),
    blocked_communities: lines(formData.get("blocked_communities"), 50).map((v) => v.toLowerCase()),
    minimum_capture_score: Number.isFinite(minimumScore) ? Math.min(100, Math.max(0, Math.round(minimumScore))) : 45,
    maximum_post_age_days: Number.isFinite(maximumAge) ? Math.min(90, Math.max(1, Math.round(maximumAge))) : 30,
  };
  if (!config.queries.length) redirect("/office/organic?error=queries_required");
  const db = getSupabaseAdmin();
  const { error } = await db.from("organic_sources").update({ config, updated_at: new Date().toISOString() }).eq("source_key", "reddit-approved-api");
  await audit("update_organic_source_config", user, { ...config, automatic_publishing: false }, null, error ? "failed" : "completed", error?.message);
  if (error) redirect("/office/organic?error=source_config_failed");
  revalidatePath("/office/organic");
  redirect("/office/organic?success=source_config_saved");
}

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

export async function refreshFinalCertification(formData){const user=await requireOfficeUser(),db=getSupabaseAdmin(),id=clean(formData.get("id"),50);const {data,error}=await db.rpc("observe_final_production_certifications");await audit("refresh_final_certification",user,{certification_id:id,result:data},null,error?"failed":"completed",error?.message);revalidatePath("/office/final-certification");redirect(error?"/office/final-certification?error=refresh_failed":"/office/final-certification?success=refreshed");}

export async function signOffFinalCertification(formData){const user=await requireOfficeUser(),db=getSupabaseAdmin(),id=clean(formData.get("id"),50);const {data,error}=await db.rpc("sign_off_final_production_certification",{p_certification_id:id,p_actor:user.email});await audit("sign_off_final_certification",user,{certification_id:id,result:data},null,error?"failed":"completed",error?.message);revalidatePath("/office/final-certification");redirect(error?"/office/final-certification?error=signoff_blocked":"/office/final-certification?success=signed_off");}

export async function recordFinalCertificationAttestation(formData){const user=await requireOfficeUser(),db=getSupabaseAdmin(),id=clean(formData.get("id"),50),key=clean(formData.get("evidence_key"),80),notes=clean(formData.get("notes"),2000),passed=formData.get("passed")==="on";const {data,error}=await db.rpc("record_final_certification_attestation",{p_certification_id:id,p_evidence_key:key,p_passed:passed,p_notes:notes,p_actor:user.email});await audit("record_final_certification_attestation",user,{certification_id:id,evidence_key:key,passed,result:data},null,error?"failed":"completed",error?.message);revalidatePath("/office/final-certification");redirect(error?"/office/final-certification?error=attestation_failed":"/office/final-certification?success=attestation_recorded");}

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

export async function refreshAudienceIntelligence(){const user=await requireOfficeUser();const db=getSupabaseAdmin();const {data,error}=await db.rpc("prepare_audience_snapshot",{p_snapshot_date:new Date().toISOString().slice(0,10)});await audit("refresh_audience_intelligence",user,{result:data,raw_message_text_exposed:false},null,error?"failed":"completed",error?.message);revalidatePath("/office/audience");redirect(error?"/office/audience?error=refresh_failed":"/office/audience?success=refreshed");}

export async function refreshDailyGrowthAgenda(){const user=await requireOfficeUser();const db=getSupabaseAdmin();const {data,error}=await db.rpc("prepare_daily_growth_agenda",{p_agenda_date:new Date().toISOString().slice(0,10)});await audit("refresh_daily_growth_agenda",user,{result:data,automatic_external_actions:false},null,error?"failed":"completed",error?.message);revalidatePath("/office/roadmap");redirect(error?"/office/roadmap?error=refresh_failed":"/office/roadmap?success=refreshed");}

export async function updateSystemConfig(formData) {
  const user = await requireOfficeUser();
  const db = getSupabaseAdmin();

  const dailyCapRaw = Number(formData.get("daily_prospecting_cap"));
  const proposalCapRaw = Number(formData.get("daily_proposal_cap"));
  const organicCapRaw = Number(formData.get("organic_daily_opportunity_cap"));
  const organicScoreRaw = Number(formData.get("organic_min_draft_score"));
  const scope = clean(formData.get("settings_scope"), 30);
  const update = scope === "organic" ? {
    organic_reddit_commercial_approval_confirmed: formData.get("organic_reddit_commercial_approval_confirmed") === "on",
    organic_research_enabled: formData.get("organic_reddit_commercial_approval_confirmed") === "on" && formData.get("organic_research_enabled") === "on",
    organic_scoring_enabled: formData.get("organic_scoring_enabled") === "on",
    organic_drafting_enabled: formData.get("organic_drafting_enabled") === "on",
    organic_attribution_enabled: formData.get("organic_attribution_enabled") === "on",
    organic_daily_opportunity_cap: Number.isFinite(organicCapRaw) ? Math.min(250, Math.max(0, Math.round(organicCapRaw))) : 25,
    organic_min_draft_score: Number.isFinite(organicScoreRaw) ? Math.min(100, Math.max(0, Math.round(organicScoreRaw))) : 80,
    updated_by: user.email,
  } : scope === "proposal" ? {
    proposal_email_enabled: formData.get("proposal_email_enabled") === "on",
    daily_proposal_cap: Number.isFinite(proposalCapRaw) ? Math.min(50, Math.max(0, Math.round(proposalCapRaw))) : 10,
    updated_by: user.email,
  } : {
    prospecting_from_email: clean(formData.get("prospecting_from_email"), 320) || null,
    prospecting_enabled: formData.get("prospecting_enabled") === "on",
    daily_prospecting_cap: Number.isFinite(dailyCapRaw) ? Math.min(500, Math.max(0, Math.round(dailyCapRaw))) : 5,
    sequence_followups_enabled: formData.get("sequence_followups_enabled") === "on",
    updated_by: user.email,
  };
  if (scope === "prospecting" && formData.get("resume_sending") === "on") update.outbound_auto_paused = false;

  const { error } = await db.from("system_config").update(update).eq("id", true);
  let sourceError = null;
  if (!error && scope === "organic") {
    const sourceUpdate = await db.from("organic_sources").update({
      enabled: update.organic_reddit_commercial_approval_confirmed && update.organic_research_enabled,
      updated_at: new Date().toISOString(),
    }).eq("source_key", "reddit-approved-api");
    sourceError = sourceUpdate.error;
  }
  await audit("update_system_config", user, update, null, error || sourceError ? "failed" : "completed", error?.message || sourceError?.message);
  if (error || sourceError) redirect("/office/settings?error=settings_save_failed");
  revalidatePath("/office/settings");
  redirect("/office/settings?success=1");
}

export async function recordCallOutcome(formData) {
  const user = await requireOfficeUser();
  const bookingId = clean(formData.get("booking_id"), 50);
  const outcome = clean(formData.get("outcome"), 30);
  const budget = clean(formData.get("budget"), 30);
  const db = getSupabaseAdmin();
  const { data, error } = await db.rpc("apply_post_call_outcome", {
    p_booking_id: bookingId,
    p_outcome: outcome,
    p_package_name: clean(formData.get("package_name"), 200) || null,
    p_budget_amount: budget ? money(budget) : null,
    p_next_step: clean(formData.get("next_step"), 1000) || null,
    p_notes: clean(formData.get("notes"), 5000) || null,
    p_actor: user.email,
  });
  await audit(
    "record_post_call_outcome",
    user,
    { booking_id: bookingId, call_outcome: outcome, reason: data?.reason },
    null,
    error || !data?.updated ? "failed" : "completed",
    error?.message || null,
  );
  if (error || !data?.updated) redirect("/office?error=call_outcome_failed");
  revalidatePath("/office");
  redirect(`/office?success=outcome_saved`);
}

export async function createProposal(formData) {
  const user = await requireOfficeUser();
  const dealId = clean(formData.get("deal_id"), 50);
  const db = getSupabaseAdmin();
  const { data: deal } = await db.from("deals").select("id,prospect_id,prospects(email,full_name)").eq("id", dealId).single();
  const prospect = Array.isArray(deal?.prospects) ? deal.prospects[0] : deal?.prospects;
  if (!prospect?.email) redirect("/office?error=proposal_missing_recipient");
  const [{ data: holidayLead }, { data: capacityHold }] = await Promise.all([
    db.from("leads").select("id,preferred_event_date").eq("prospect_id", deal.prospect_id).not("preferred_event_date", "is", null).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("event_capacity_holds").select("id").eq("deal_id", dealId).in("status", ["tentative", "confirmed"]).or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`).limit(1).maybeSingle(),
  ]);
  if (holidayLead?.preferred_event_date && !capacityHold) redirect("/office/capacity?error=capacity_hold_required");

  const packageName = clean(formData.get("package_name"), 200);
  const price = money(formData.get("price"));
  const expiresOn = clean(formData.get("expires_on"), 20);
  if (!packageName || price === null || price <= 0 || !expiresOn) redirect("/office?error=proposal_incomplete");
  const paymentToken = randomBytes(32).toString("base64url");
  const paymentTokenHash = createHash("sha256").update(paymentToken).digest("hex");
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.teamtastic.events").replace(/\/$/, "");
  const paymentUrl = `${siteUrl}/api/stripe/proposal-checkout?token=${encodeURIComponent(paymentToken)}`;

  const name = prospect.full_name?.split(" ")[0] || "there";
  const subject = clean(formData.get("subject"), 300) || `Your Teamtastic ${packageName} proposal`;
  const suppliedBody = clean(formData.get("body_text"), 10000);
  const bodyText = suppliedBody || [
    `Hi ${name},`,
    "",
    `I’d love to bring ${packageName} to your team. The investment is $${price.toLocaleString("en-US", { minimumFractionDigits: 2 })}.`,
    "",
    "Teamtastic handles the experience from start to finish, so you can join your team, laugh, and enjoy the game instead of running it.",
    "",
    `This proposal is open through ${expiresOn}. When you’re ready, pay the quoted total securely here: ${paymentUrl}`,
    "",
    "Michael",
    "Teamtastic",
  ].join("\n");

  const { data: proposal, error } = await db.from("proposals").insert({
    deal_id: dealId,
    prospect_id: deal.prospect_id,
    recipient_email: prospect.email,
    package_name: packageName,
    price,
    expires_on: expiresOn,
    deposit_url: paymentUrl,
    subject,
    body_text: bodyText,
    metadata: {
      generator: "office",
      template_version: suppliedBody ? "office-custom-v1" : "office-default-v1",
      pricing_version: "office-proposal-v1",
      payment_kind: "full_payment",
    },
  }).select("id").single();
  if (!error && proposal) {
    const amountCents = Math.round(price * 100);
    const { error: paymentError } = await db.from("payment_requests").insert({
      deal_id: dealId,
      proposal_id: proposal.id,
      source: "office_proposal",
      payment_kind: "full_payment",
      quoted_total_cents: amountCents,
      amount_due_now_cents: amountCents,
      currency: "usd",
      pricing_version: "office-proposal-v1",
      pricing_inputs: { package_name: packageName },
      public_token_hash: paymentTokenHash,
      fingerprint: createHash("sha256").update(`proposal:${proposal.id}:${amountCents}`).digest("hex"),
      status: "active",
      expires_at: new Date(`${expiresOn}T23:59:59.999Z`).toISOString(),
    });
    if (paymentError) {
      await db.from("proposals").delete().eq("id", proposal.id);
      await audit("create_proposal", user, { deal_id: dealId, proposal_id: proposal.id }, deal.prospect_id, "failed", paymentError.message);
      redirect("/office?error=proposal_payment_request_failed");
    }
  }
  await audit("create_proposal", user, { deal_id: dealId, proposal_id: proposal?.id }, deal.prospect_id, error ? "failed" : "completed", error?.message);
  if (error) redirect("/office?error=proposal_create_failed");
  revalidatePath("/office");
  redirect("/office?success=proposal_drafted");
}

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

export async function approveAndSendProposal(formData) {
  const user = await requireOfficeUser();
  const id = clean(formData.get("id"), 50);
  const db = getSupabaseAdmin();
  const { data: proposal, error: readError } = await db.from("proposals").select("*").eq("id", id).single();
  if (readError || !proposal || !["draft", "failed", "send_failed"].includes(proposal.status)) redirect("/office?error=proposal_not_available");

  const subject = clean(formData.get("subject"), 300);
  const bodyText = clean(formData.get("body_text"), 10000);
  if (!subject || !bodyText) redirect("/office?error=proposal_content_required");

  const approvedAt = new Date().toISOString();
  const { data: claimedProposal, error: approvalError } = await db.from("proposals").update({
    subject,
    body_text: bodyText,
    status: "sending",
    approved_at: approvedAt,
    approved_by: user.email,
    send_attempted_at: approvedAt,
    last_error: null,
  }).eq("id", id).in("status", ["draft", "failed", "send_failed"]).select("id").maybeSingle();
  if (approvalError) {
    await audit("send_proposal", user, { proposal_id: id }, proposal.prospect_id, "failed", approvalError.message);
    redirect("/office?error=proposal_claim_failed");
  }
  if (!claimedProposal) redirect("/office?error=proposal_already_being_sent");

  // Not using sendViaResend here: this flow needs its own "blocked" vs. "not
  // configured" branches with distinct proposal-status writes and audit
  // outcomes ahead of the actual send, which doesn't fit the helper's single
  // reserve+send+record contract without either double-reserving or losing
  // that distinction. See src/lib/server/email.js.
  const { data: reservation, error: reservationError } = await db.rpc("reserve_email_send", {
    p_message_type: "proposal",
    p_recipient: proposal.recipient_email,
  });
  if (reservationError || !reservation?.allowed) {
    const reason = reservationError?.message || reservation?.reason || "send_not_reserved";
    await db.from("proposals").update({ status: "draft", last_error: reason }).eq("id", id);
    await audit("send_proposal", user, { proposal_id: id, reason }, proposal.prospect_id, "blocked");
    redirect("/office?error=proposal_send_blocked");
  }

  const apiKey = process.env.RESEND_API_KEY;
  // Deliberately not prospecting_from_email — proposals go to warm leads who already had
  // a call, so they use the trusted transactional identity, not the cold-outreach one.
  const from = process.env.INTERNAL_NOTIFICATION_EMAIL ? `Teamtastic <${process.env.INTERNAL_NOTIFICATION_EMAIL}>` : process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    await db.rpc("record_email_send_result", { p_message_type: "proposal", p_sent: false });
    await db.from("proposals").update({ status: "send_failed", last_error: "Proposal email provider is not configured" }).eq("id", id);
    await audit("send_proposal", user, { proposal_id: id }, proposal.prospect_id, "failed", "Email provider not configured");
    redirect("/office?error=proposal_email_not_configured");
  }

  let providerMessageId = proposal.provider_message_id || null;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `proposal/${id}`,
      },
      body: JSON.stringify({ from, to: [proposal.recipient_email], subject, text: bodyText }),
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS.slow),
    });
    const result = await response.json();
    await db.rpc("record_email_send_result", {
      p_message_type: "proposal",
      p_sent: response.ok && Boolean(result.id),
    });
    if (!response.ok || !result.id) throw new Error(result.message || `Email provider returned ${response.status}`);
    providerMessageId = result.id;
    const sentAt = new Date().toISOString();
    const { data: finalized, error: finalizeError } = await db.rpc("finalize_proposal_send", {
      p_proposal_id: id,
      p_provider_message_id: providerMessageId,
      p_from_address: from,
      p_subject: subject,
      p_body_text: bodyText,
      p_sent_at: sentAt,
      p_actor: user.email,
    });
    if (finalizeError || !finalized?.finalized) throw new Error(finalizeError?.message || finalized?.reason || "proposal_finalize_failed");
  } catch (error) {
    const status = providerMessageId ? "reconcile_required" : "send_failed";
    await db.from("proposals").update({
      status,
      provider_message_id: providerMessageId,
      last_error: status === "reconcile_required" ? "CRM reconciliation required" : "Email provider request failed",
    }).eq("id", id);
    if (providerMessageId) {
      await db.from("tasks").upsert({
        prospect_id: proposal.prospect_id,
        title: "Reconcile sent proposal",
        description: `Resend accepted proposal ${id}, but CRM finalization failed. Provider message: ${providerMessageId}.`,
        priority: "urgent",
        due_at: new Date().toISOString(),
        source: "proposal_reconciliation",
        fingerprint: `proposal:reconcile:${id}`,
      }, { onConflict: "fingerprint", ignoreDuplicates: true });
    }
    await audit("send_proposal", user, { proposal_id: id, provider_message_id: providerMessageId }, proposal.prospect_id, status, clean(error.message, 1000));
    redirect("/office?error=proposal_send_failed");
  }
  revalidatePath("/office");
  redirect("/office?success=proposal_sent");
}

export async function reconcileProposalSend(formData) {
  const user = await requireOfficeUser();
  const id = clean(formData.get("id"), 50);
  const db = getSupabaseAdmin();
  const { data: proposal, error: readError } = await db.from("proposals")
    .select("id,prospect_id,status,provider_message_id,subject,body_text,send_attempted_at")
    .eq("id", id)
    .single();
  if (readError || !proposal || proposal.status !== "reconcile_required" || !proposal.provider_message_id) {
    redirect("/office?error=proposal_not_reconcilable");
  }

  const from = process.env.INTERNAL_NOTIFICATION_EMAIL
    ? `Teamtastic <${process.env.INTERNAL_NOTIFICATION_EMAIL}>`
    : process.env.RESEND_FROM_EMAIL;
  if (!from) redirect("/office?error=proposal_email_not_configured");

  const { data: finalized, error } = await db.rpc("finalize_proposal_send", {
    p_proposal_id: id,
    p_provider_message_id: proposal.provider_message_id,
    p_from_address: from,
    p_subject: proposal.subject,
    p_body_text: proposal.body_text,
    p_sent_at: proposal.send_attempted_at || new Date().toISOString(),
    p_actor: user.email,
  });
  await audit(
    "reconcile_proposal_send",
    user,
    { proposal_id: id, provider_message_id: proposal.provider_message_id },
    proposal.prospect_id,
    error || !finalized?.finalized ? "failed" : "completed",
    error?.message || (!finalized?.finalized ? finalized?.reason : null),
  );
  if (error || !finalized?.finalized) {
    redirect("/office?error=proposal_reconcile_failed");
  }
  revalidatePath("/office");
  redirect("/office?success=proposal_reconciled");
}
