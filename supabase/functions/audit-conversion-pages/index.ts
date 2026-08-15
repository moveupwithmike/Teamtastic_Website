import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {authorizeWebhook,errorText,functionError,serviceClient} from "../_shared/runtime.ts";

const pages=[
  {path:"/virtual-holiday-party",markers:["Preferred event date","Event time zone","December prime-time dates are limited","60-minute"]},
  {path:"/virtual-year-end-team-celebration",markers:["Preferred event date","Event time zone","December prime-time dates are limited","60-minute"]},
  {path:"/virtual-holiday-party-for-large-groups",markers:["Preferred event date","Event time zone","December prime-time dates are limited","60-minute"]},
];

Deno.serve(async(request)=>{
  const unauthorized=authorizeWebhook(request,"ORGANIC_RESEARCH_WEBHOOK_SECRET");if(unauthorized)return unauthorized;
  const db=serviceClient();const {data:run,error:runError}=await db.from("conversion_health_runs").insert({status:"running"}).select("id").single();if(runError||!run)return functionError("run_creation_failed");
  try{
    const results=[];let passed=0,failed=0;
    for(const page of pages){
      const started=Date.now();let status=0;let body="";let requestError=null;
      try{const response=await fetch(`https://www.teamtastic.events${page.path}`,{redirect:"follow",signal:AbortSignal.timeout(15000),headers:{"User-Agent":"TeamtasticConversionHealth/1.0"}});status=response.status;body=await response.text();}catch(error){requestError=errorText(error);}
      const checks=[{key:"http_200",passed:status===200},...page.markers.map(marker=>({key:`contains:${marker}`,passed:body.toLowerCase().includes(marker.toLowerCase())}))];
      passed+=checks.filter(x=>x.passed).length;failed+=checks.filter(x=>!x.passed).length;
      results.push({path:page.path,http_status:status,duration_ms:Date.now()-started,checks,error:requestError});
    }
    const overall=failed===0?"healthy":passed>0?"degraded":"failed";const completedAt=new Date().toISOString();
    await db.from("conversion_health_runs").update({status:overall,pages:results,checks_passed:passed,checks_failed:failed,completed_at:completedAt}).eq("id",run.id);
    if(failed>0)await db.from("tasks").upsert({title:"Review holiday conversion-page health",description:`The automated audit found ${failed} failed checks. Open Office → Health for details.`,priority:"urgent",due_at:completedAt,source:"conversion_health",fingerprint:`conversion-health:${completedAt.slice(0,10)}`},{onConflict:"fingerprint",ignoreDuplicates:true});
    return Response.json({status:overall,checks_passed:passed,checks_failed:failed,pages:results.map(x=>x.path)});
  }catch(error){const message=errorText(error).slice(0,1000);await db.from("conversion_health_runs").update({status:"failed",error:message,completed_at:new Date().toISOString()}).eq("id",run.id);return functionError("conversion_health_failed");}
});
