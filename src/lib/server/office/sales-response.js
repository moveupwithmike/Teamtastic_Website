import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import { sendViaResend } from "@/lib/server/email";
import { HTTP_TIMEOUT_MS } from "@/lib/server/http";
import { audit, clean } from "./shared";

function recommendedPackage(lead) {
  if (lead.package_interest === "large-event-production" || /150|200|300/.test(lead.team_size || "")) return "Large-Group Holiday Production";
  if (lead.package_interest === "custom-year-in-review") return "Custom Year-in-Review Show";
  return "Hosted Teamtastic Holiday Game Show";
}

export async function createSalesResponseDraft(user, formData) {
  const leadId = clean(formData.get("lead_id"), 50);
  const type = clean(formData.get("response_type"), 30);
  if (!leadId || !["availability", "discovery_call", "proposal", "deposit_request"].includes(type)) {
    return { ok: false, errorCode: "invalid_draft" };
  }

  const db = getSupabaseAdmin();
  const { data: lead } = await db.from("leads").select("*").eq("id", leadId).single();
  if (!lead?.email) return { ok: false, errorCode: "lead_missing" };

  const [{ data: deal }, { data: hold }] = await Promise.all([
    db.from("deals").select("id,title,package_name,expected_value").eq("prospect_id", lead.prospect_id).eq("outcome", "open").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("event_capacity_holds").select("id,status,starts_at,ends_at,expires_at").eq("lead_id", lead.id).in("status", ["tentative", "confirmed"]).or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`).limit(1).maybeSingle(),
  ]);
  const { data: proposal } = deal
    ? await db.from("proposals").select("deposit_url,package_name,price").eq("deal_id", deal.id).order("created_at", { ascending: false }).limit(1).maybeSingle()
    : { data: null };

  const pkg = deal?.package_name || recommendedPackage(lead);
  const first = lead.name?.split(" ")[0] || "there";
  const site = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.teamtastic.events").replace(/\/$/, "");
  const schedule = [lead.preferred_event_date, lead.preferred_time, lead.event_timezone].filter(Boolean).join(" · ");
  const capacity = hold
    ? `We have placed a ${hold.status} hold for ${schedule || "your requested time"}.`
    : `Your requested timing is ${schedule || "not fully confirmed yet"}; I will confirm production capacity before promising the date.`;

  const extras = {
    availability: ["Your Teamtastic holiday event request", `${capacity}\n\nBased on your ${lead.team_size || "team"} group and preferences, I recommend the ${pkg}.`],
    discovery_call: ["Choose a time for your Teamtastic planning call", `The quickest next step is a 15-minute planning call. Choose a time here: ${site}/book?name=${encodeURIComponent(lead.name)}&email=${encodeURIComponent(lead.email)}&company=${encodeURIComponent(lead.company || "")}\n\n${capacity}`],
    proposal: [`Next steps for your ${pkg}`, `${capacity}\n\nThe ${pkg} is the strongest fit for your team. I can prepare exact scope and pricing once we confirm the final attendee count and customization.`],
    deposit_request: ["Reserve your Teamtastic event date", proposal?.deposit_url ? `${capacity}\n\nYou can secure the event using this private payment link: ${proposal.deposit_url}` : `${capacity}\n\nReply that you are ready to reserve the date and I will send the secure deposit link after the availability hold is confirmed.`],
  };
  const [subject, core] = extras[type];
  const body = `Hi ${first},\n\n${core}\n\nMichael\nTeamtastic`;
  const snapshot = { hold_id: hold?.id || null, status: hold?.status || "not_held", requested_date: lead.preferred_event_date, preferred_time: lead.preferred_time, timezone: lead.event_timezone };

  const { data: draft, error } = await db.from("sales_response_drafts").insert({
    lead_id: lead.id, prospect_id: lead.prospect_id, deal_id: deal?.id || null, response_type: type,
    recipient_email: lead.email, recommended_package: pkg, subject, generated_body: body, body_text: body,
    capacity_snapshot: snapshot, generated_by: user.email,
  }).select("id").single();
  if (!error) {
    await db.from("sales_response_revisions").insert({
      response_id: draft.id, revision_type: "generated", subject, body_text: body, actor: user.email,
      metadata: { response_type: type, capacity_snapshot: snapshot },
    });
  }
  await audit("create_sales_response_draft", user, { lead_id: leadId, response_id: draft?.id, response_type: type, package: pkg }, lead.prospect_id, error ? "failed" : "completed", error?.message);
  return { ok: !error, errorCode: error ? "draft_failed" : undefined };
}

export async function approveAndSendSalesResponse(user, formData) {
  const id = clean(formData.get("id"), 50);
  const subject = clean(formData.get("subject"), 300);
  const body = clean(formData.get("body_text"), 10000);
  if (!id || !subject || !body) return { ok: false, errorCode: "response_incomplete" };

  const db = getSupabaseAdmin();
  const { data: draft } = await db.from("sales_response_drafts").select("*").eq("id", id).in("status", ["draft", "send_failed"]).single();
  if (!draft) return { ok: false, errorCode: "response_unavailable" };

  const approvedAt = new Date().toISOString();
  const { data: claimed } = await db.from("sales_response_drafts").update({
    subject, body_text: body, status: "sending", approved_by: user.email, approved_at: approvedAt, last_error: null,
  }).eq("id", id).in("status", ["draft", "send_failed"]).select("id").maybeSingle();
  if (!claimed) return { ok: false, errorCode: "response_claim_failed" };

  await db.from("sales_response_revisions").insert({
    response_id: id, revision_type: "approved_edit", subject, body_text: body, actor: user.email,
    metadata: { edited: subject !== draft.subject || body !== draft.generated_body },
  });

  const from = process.env.INTERNAL_NOTIFICATION_EMAIL
    ? `Teamtastic <${process.env.INTERNAL_NOTIFICATION_EMAIL}>`
    : process.env.RESEND_FROM_EMAIL;
  if (!process.env.RESEND_API_KEY || !from) {
    await db.from("sales_response_drafts").update({ status: "send_failed", last_error: "Email provider not configured" }).eq("id", id);
    return { ok: false, errorCode: "email_not_configured" };
  }

  const { reserved, sent, providerMessageId, reason } = await sendViaResend(db, {
    messageType: "proposal",
    recipient: draft.recipient_email,
    from,
    subject,
    text: body,
    idempotencyKey: `sales-response/${id}`,
    timeoutMs: HTTP_TIMEOUT_MS.slow,
  });

  if (!reserved) {
    await db.from("sales_response_drafts").update({ status: "draft", last_error: reason }).eq("id", id);
    return { ok: false, errorCode: encodeURIComponent(reason) };
  }

  if (!sent) {
    await db.from("sales_response_drafts").update({ status: "send_failed", last_error: reason }).eq("id", id);
    await db.from("sales_response_revisions").insert({
      response_id: id, revision_type: "failed", subject, body_text: body, actor: user.email, metadata: { error: reason },
    });
    await audit("send_sales_response", user, { response_id: id }, draft.prospect_id, "failed", reason);
    return { ok: false, errorCode: "send_failed" };
  }

  const sentAt = new Date().toISOString();
  await db.from("sales_response_drafts").update({ status: "sent", provider_message_id: providerMessageId, sent_at: sentAt, last_error: null }).eq("id", id);
  await db.from("sales_response_revisions").insert({
    response_id: id, revision_type: "sent", subject, body_text: body, actor: user.email, metadata: { provider_message_id: providerMessageId },
  });
  await db.from("messages").insert({
    prospect_id: draft.prospect_id, direction: "outbound", message_type: "manual", provider: "resend",
    from_address: from, to_addresses: [draft.recipient_email], subject, body_text: body,
    provider_message_id: providerMessageId, sent_at: sentAt, status: "sent",
    metadata: { sales_response_id: id, response_type: draft.response_type },
  });
  await audit("send_sales_response", user, { response_id: id, response_type: draft.response_type, provider_message_id: providerMessageId }, draft.prospect_id);
  return { ok: true };
}
