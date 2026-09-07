import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { EddieError } from "./eddie-error";
import { clean } from "./shared";
import {
  buildTrackedUrl, slugify, SOCIAL_PLATFORMS, SOCIAL_FORMATS, SOCIAL_OBJECTIVES,
  SOCIAL_VIDEO_TEMPLATES, socialContentFingerprint, socialScheduleFingerprint,
} from "./social-shared";
import { platformStatus } from "./social-publishers";
import { attemptSocialPublish, formatName, formatRequiresMedia } from "./social-publish";
import { recordDistributionEvent } from "./social-events";
import { createHelpfulDraft } from "@/lib/server/organic-intent";

export const SOCIAL_ACTION_TYPES = [
  "prepare_social_plan", "create_social_post", "revise_social_post", "create_social_video",
  "approve_social_item", "schedule_social_item", "publish_social_item",
  "pause_scheduled_social_item", "prepare_comment_reply",
];

const EASTERN_FORMATTER = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" });

function easternTime(value) {
  return EASTERN_FORMATTER.format(new Date(value));
}

async function socialAccount(db, id) {
  const { data, error } = await db.from("social_accounts")
    .select("id,platform,account_name,account_type,destination,provider_id,requires_manual_post,write_enabled,status,credentials,updated_at")
    .eq("id", id).maybeSingle();
  if (error || !data) throw new EddieError("action_target_not_found", 409);
  return data;
}

async function distributionItem(db, id) {
  const { data, error } = await db.from("distribution_items").select("*").eq("id", id).maybeSingle();
  if (error || !data) throw new EddieError("social_item_not_found", 409);
  return data;
}

async function socialConfig(db) {
  const { data, error } = await db.from("system_config")
    .select("social_master_enabled,linkedin_write_enabled,instagram_write_enabled,facebook_write_enabled,x_write_enabled")
    .eq("id", true).maybeSingle();
  if (error || !data) throw new EddieError("social_configuration_unavailable", 503);
  return data;
}

// ---------------------------------------------------------------------------
// Context slice
// ---------------------------------------------------------------------------

export async function socialContextSlice(db) {
  const [accountsResult, itemsResult, opportunitiesResult, voiceResult] = await Promise.all([
    db.from("social_accounts")
      .select("id,platform,account_name,account_type,destination,provider_id,write_enabled,requires_manual_post,status,updated_at")
      .order("account_name").limit(25),
    db.from("distribution_items")
      .select("id,title,channel,format,status,caption,hook,cta,tracked_url,destination,platform_account_id,publish_mode,scheduled_for,content_objective,funnel_stage,last_error,updated_at")
      .neq("status", "archived").order("created_at", { ascending: false }).limit(15),
    db.from("organic_opportunities")
      .select("id,title,excerpt,community,intent_score,recommended_page,tracking_token,status")
      .in("status", ["review", "drafted"]).order("intent_score", { ascending: false }).limit(10),
    db.from("social_voice_entries")
      .select("id,kind,body").eq("enabled", true).order("kind").limit(80),
  ]);

  const failures = [accountsResult, itemsResult, opportunitiesResult, voiceResult].filter((result) => result.error);
  if (failures.length) return { error: { code: "social_context_unavailable" }, data: null };

  const voiceGroups = (kind) => (voiceResult.data || []).filter((entry) => entry.kind === kind).map((entry) => entry.body);

  return {
    error: null,
    data: {
      accounts: accountsResult.data || [],
      items: (itemsResult.data || []).map(({ caption, hook, ...item }) => ({ ...item, caption: (caption || "").slice(0, 600), hook: (hook || "").slice(0, 200) })),
      organic_opportunities: (opportunitiesResult.data || []).map(({ excerpt, ...opportunity }) => ({
        ...opportunity,
        excerpt: (excerpt || "").slice(0, 700),
        status: opportunity.status,
      })),
      voice: {
        signatures: voiceGroups("signature"),
        phrases: voiceGroups("phrase"),
        avoid: voiceGroups("avoid"),
        rules: voiceGroups("rule"),
        facts: voiceGroups("fact"),
        needs_evidence: voiceGroups("needs_evidence"),
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Action preparation (review-only; nothing executes)
// ---------------------------------------------------------------------------

export async function prepareSocialAction(db, input) {
  const type = clean(input.action_type, 50);

  if (type === "prepare_social_plan") {
    const draftTitle = clean(input.draft_title, 300);
    const draftBody = clean(input.draft_body, 12000);
    if (!draftTitle || !draftBody) throw new EddieError("action_details_missing", 409);
    return {
      action: { type, draft_title: draftTitle, draft_body: draftBody },
      confirmation: {
        title: "Save a social plan for review",
        details: [draftTitle, clean(draftBody, 700), "This saves a review-only plan. Individual posts are then prepared separately and each needs its own approval."],
      },
    };
  }

  if (type === "create_social_post" || type === "create_social_video") {
    const platform = clean(input.platform, 20);
    const accountId = clean(input.account_id, 60);
    const format = clean(type === "create_social_video" ? (input.format || "video") : (input.format || "text"), 20);
    const title = clean(input.title, 200);
    const caption = clean(input.caption, 3000);
    const hook = clean(input.hook, 400);
    const cta = clean(input.cta, 400);
    const objective = SOCIAL_OBJECTIVES.includes(input.content_objective) ? input.content_objective : null;
    const funnelStage = clean(input.funnel_stage, 100) || null;
    const targetPage = clean(input.target_page, 300);
    const publishMode = input.publish_mode === "scheduled" ? "scheduled" : "now";
    const evidence = clean(input.evidence, 1000);

    if (!SOCIAL_PLATFORMS.includes(platform)) throw new EddieError("action_details_missing", 409);
    if (!SOCIAL_FORMATS.includes(format) || format === "comment") throw new EddieError("action_details_missing", 409);
    if (!accountId || !title || !caption || !evidence) throw new EddieError("action_details_missing", 409);
    if (!targetPage.startsWith("/")) throw new EddieError("action_details_missing", 409);
    const account = await socialAccount(db, accountId);
    if (account.platform !== platform) throw new EddieError("action_target_not_found", 409);

    const base = {
      type, platform, account_id: account.id, account_name: account.account_name, format,
      title, caption, hook, cta, content_objective: objective, funnel_stage: funnelStage,
      target_page: targetPage, publish_mode: publishMode, evidence,
      requires_manual_post: account.requires_manual_post || platform === "reddit",
    };

    if (type === "create_social_video") {
      const template = clean(input.template, 40);
      const script = clean(input.script, 12000);
      const shotList = Array.isArray(input.shot_list) ? input.shot_list.map((shot) => clean(shot, 1500)).filter(Boolean).slice(0, 12) : [];
      if (!SOCIAL_VIDEO_TEMPLATES.includes(template) || !script || !shotList.length) throw new EddieError("action_details_missing", 409);
      return {
        action: { ...base, template, script, shot_list: shotList },
        confirmation: {
          title: "Create a social video draft",
          details: [`Template: ${template.replaceAll("_", " ")}`, `Format: ${formatName(format)}`, title, clean(caption, 220), `${shotList.length} shots in the shot list`, "Saves the script and shot list for review. Rendering is a separate future step and nothing is uploaded."],
        },
      };
    }

    return {
      action: base,
      confirmation: {
        title: "Create a social post draft",
        details: [`${account.account_name} (${platform})`, `Format: ${formatName(format)}`, title, clean(caption, 300), `Tracked link: ${targetPage}`, "Creates a draft for review only. Nothing is published."],
      },
    };
  }

  if (type === "revise_social_post") {
    const item = await distributionItem(db, clean(input.target_id, 60));
    if (item.status !== "draft") throw new EddieError("social_item_not_editable", 409);
    const changes = {};
    for (const field of ["caption", "hook", "cta", "format", "funnel_stage"]) {
      const raw = input[field];
      if (typeof raw === "string" && raw.trim()) changes[field] = clean(raw, field === "caption" ? 3000 : field === "format" ? 20 : 400);
    }
    if (!Object.keys(changes).length) throw new EddieError("action_details_missing", 409);
    return {
      action: { type, social_item_id: item.id, expected_status: "draft", expected_fingerprint: socialContentFingerprint(item), changes },
      confirmation: {
        title: "Revise this social post",
        details: [item.title || item.caption, `Changes: ${Object.keys(changes).join(", ")}`, "This updates the draft only. It will need a fresh approval before anything can publish."],
      },
    };
  }

  if (type === "approve_social_item") {
    const item = await distributionItem(db, clean(input.target_id, 60));
    if (item.status !== "draft") throw new EddieError("social_item_status_invalid", 409);
    if (formatRequiresMedia(item.format) && (!Array.isArray(item.media) || !item.media.length)) {
      throw new EddieError("social_media_required", 409);
    }
    const contentFp = socialContentFingerprint(item);
    return {
      action: { type, social_item_id: item.id, expected_status: "draft", expected_fingerprint: contentFp },
      confirmation: {
        title: "Approve this social post",
        details: [item.title || item.caption, `Platform: ${item.channel}`, `Format: ${formatName(item.format)}`, clean(item.caption || item.body_text, 300), `${Array.isArray(item.media) ? item.media.length : 0} media assets`, "Approval is bound to this exact content. Publishing still needs a separate confirmation."],
      },
    };
  }

  if (type === "schedule_social_item") {
    const when = clean(input.scheduled_for, 100);
    const date = new Date(when);
    if (!Number.isFinite(date.getTime()) || date.getTime() <= Date.now()) throw new EddieError("schedule_required", 409);
    const item = await distributionItem(db, clean(input.target_id, 60));
    if (item.status !== "approved") throw new EddieError("social_item_status_invalid", 409);
    const contentFp = socialContentFingerprint(item);
    return {
      action: { type, social_item_id: item.id, expected_status: "approved", expected_fingerprint: contentFp, scheduled_for: date.toISOString(), scheduled_fingerprint: socialScheduleFingerprint(contentFp, date.toISOString()) },
      confirmation: {
        title: "Schedule this social post",
        details: [item.title || item.caption, `Exact publish time: ${easternTime(date)} Eastern`, "The exact publish time is bound to this schedule."],
      },
    };
  }

  if (type === "publish_social_item") {
    const item = await distributionItem(db, clean(input.target_id, 60));
    if (!["approved", "scheduled"].includes(item.status)) throw new EddieError("social_item_status_invalid", 409);
    const account = item.platform_account_id ? await socialAccount(db, item.platform_account_id) : null;
    const config = await socialConfig(db);
    const readiness = platformStatus({ platform: item.channel, account, config });
    if (!readiness.ready) throw new EddieError(readiness.reason, 409);

    const contentFp = socialContentFingerprint(item);
    if (item.approved_fingerprint && contentFp !== item.approved_fingerprint) throw new EddieError("social_content_changed", 409);
    if (item.status === "scheduled") {
      const scheduledFp = socialScheduleFingerprint(contentFp, item.scheduled_for);
      if (!item.scheduled_fingerprint || scheduledFp !== item.scheduled_fingerprint) throw new EddieError("social_time_changed", 409);
      if (new Date(item.scheduled_for).getTime() > Date.now()) throw new EddieError("social_not_yet_due", 409);
    }

    const details = [
      `${account.account_name} (${item.channel})`,
      `Format: ${formatName(item.format)}`,
      clean(item.caption || item.body_text, 300),
      item.status === "scheduled" ? `Scheduled for ${easternTime(item.scheduled_for)} Eastern` : "Publish now",
      `Tracked link: ${item.tracked_url}`,
      `This posts a live ${item.channel} update that cannot be undone by this action.`,
    ];
    return {
      action: {
        type, social_item_id: item.id, platform: item.channel, account_id: account.id,
        expected_status: item.status, expected_content_fingerprint: contentFp,
        expected_scheduled_fingerprint: item.scheduled_fingerprint || null,
      },
      confirmation: { title: `Publish to ${account.account_name}`, details, dangerous: true },
    };
  }

  if (type === "pause_scheduled_social_item") {
    const item = await distributionItem(db, clean(input.target_id, 60));
    if (item.status !== "scheduled") throw new EddieError("social_item_status_invalid", 409);
    return {
      action: { type, social_item_id: item.id, expected_status: "scheduled", expected_scheduled_fingerprint: item.scheduled_fingerprint },
      confirmation: { title: "Pause this scheduled post", details: [item.title || item.caption, "Cancels the scheduled publish. Reschedule it later to try again."] },
    };
  }

  if (type === "prepare_comment_reply") {
    const opportunityId = clean(input.target_id, 60);
    const { data: opportunity, error } = await db.from("organic_opportunities")
      .select("id,title,excerpt,community,recommended_page,tracking_token,status").eq("id", opportunityId).maybeSingle();
    if (error || !opportunity || !["review", "drafted"].includes(opportunity.status)) throw new EddieError("action_target_not_found", 409);
    const draft = createHelpfulDraft({ excerpt: opportunity.excerpt, recommendedPage: opportunity.recommended_page || "/virtual-holiday-party", trackingToken: opportunity.tracking_token });
    const excerptFp = createHash("sha256").update(opportunity.excerpt).digest("hex");
    return {
      action: { type, opportunity_id: opportunity.id, expected_status: opportunity.status, expected_excerpt_fingerprint: excerptFp, draft_body: draft.bodyText, draft_tracked_url: draft.trackedUrl },
      confirmation: {
        title: "Prepare an authentic comment reply",
        details: [opportunity.community || "Community", clean(opportunity.title, 200), clean(draft.bodyText, 400), "Creates a reply draft for review only. You post it manually; it is never auto-posted."],
      },
    };
  }

  throw new EddieError("action_not_allowed", 409);
}

// ---------------------------------------------------------------------------
// Execution (only ever reached through a signed confirmation)
// ---------------------------------------------------------------------------

export async function runSocialConfirmedAction(db, user, receiptId, action, fetchImpl = fetch) {
  const now = new Date().toISOString();

  if (action.type === "prepare_social_plan") {
    const { data, error } = await db.from("marketing_asset_drafts").insert({
      draft_type: "social_plan",
      title: action.draft_title,
      body_text: action.draft_body,
      metadata: { source: "eddie", receipt_id: receiptId, automatic_external_changes: false },
      created_by: user.email,
    }).select("id,title,draft_type,status").single();
    if (error || !data) throw new EddieError("social_plan_save_failed", 503);
    return { message: `Done. I saved “${data.title}” as a social plan draft for review. Individual posts are prepared separately.`, record: data };
  }

  if (action.type === "create_social_post" || action.type === "create_social_video") {
    const { data: account, error: accountError } = await db.from("social_accounts")
      .select("id,platform,account_name,destination,requires_manual_post").eq("id", action.account_id).maybeSingle();
    if (accountError || !account || account.platform !== action.platform) throw new EddieError("action_target_not_found", 409);

    const campaign = `social_${now.slice(0, 7).replace("-", "_")}`;
    const trackedUrl = buildTrackedUrl({ channel: action.platform, targetPage: action.target_page, campaign, content: slugify(action.title) });
    const bodyText = [action.hook, action.caption, action.cta].filter(Boolean).join("\n");
    const sourceEvidence = { generated_by: "eddie", receipt_id: receiptId, evidence: action.evidence, target_page: action.target_page };
    if (action.script) sourceEvidence.video = { template: action.template, script: action.script, shot_list: action.shot_list, render_pending: true };

    const row = {
      title: action.title,
      channel: action.platform,
      audience: "",
      target_page: action.target_page,
      body_text: bodyText,
      utm_source: action.platform,
      utm_medium: "organic_distribution",
      utm_campaign: campaign,
      utm_content: slugify(action.title),
      tracked_url: trackedUrl,
      status: "draft",
      format: action.format,
      content_objective: action.content_objective,
      funnel_stage: action.funnel_stage,
      hook: action.hook,
      caption: action.caption,
      cta: action.cta,
      media: [],
      destination: account.destination || account.account_name,
      platform_account_id: account.id,
      publish_mode: action.publish_mode || "now",
      requires_manual_post: Boolean(action.requires_manual_post),
      source_evidence: sourceEvidence,
      voice_sources: [],
      fingerprint: `social:${receiptId}:${randomUUID()}`,
      decision: { generated_by: "eddie", receipt_id: receiptId, automatic_publishing: false },
    };
    const { data, error } = await db.from("distribution_items").insert(row).select("id,title,channel,format,status").single();
    if (error || !data) throw new EddieError("social_item_create_failed", 503);
    await recordDistributionEvent(db, data.id, { action: "created", statusBefore: null, statusAfter: "draft", actor: user.email, decision: { generated_by: "eddie", receipt_id: receiptId } });
    const verb = action.type === "create_social_video" ? "video draft (script and shot list)" : "social draft";
    return { message: `Done. I created the ${data.channel} ${verb} “${data.title}” for review. Nothing has been published.`, record: data };
  }

  if (action.type === "revise_social_post") {
    const { data: item, error: readError } = await db.from("distribution_items").select("id,title,status,revision,media,caption,hook,cta,format,tracked_url,destination,platform_account_id").eq("id", action.social_item_id).maybeSingle();
    if (readError || !item || item.status !== "draft" || socialContentFingerprint(item) !== action.expected_fingerprint) throw new EddieError("social_item_changed", 409);
    const { data, error } = await db.from("distribution_items").update({ ...action.changes, revision: (item.revision || 0) + 1, last_error: null }).eq("id", item.id).eq("status", "draft").select("id,title,status,revision").single();
    if (error || !data) throw new EddieError("social_item_update_failed", 503);
    await recordDistributionEvent(db, data.id, { action: "revised", statusBefore: "draft", statusAfter: "draft", actor: user.email, decision: { changed: Object.keys(action.changes), receipt_id: receiptId } });
    return { message: `Done. I revised “${data.title}”. It needs a fresh approval before publishing.`, record: data };
  }

  if (action.type === "approve_social_item") {
    const { data: item, error: readError } = await db.from("distribution_items").select("*").eq("id", action.social_item_id).maybeSingle();
    if (readError || !item || item.status !== "draft" || socialContentFingerprint(item) !== action.expected_fingerprint) throw new EddieError("social_item_changed", 409);
    const contentFp = socialContentFingerprint(item);
    const { data, error } = await db.from("distribution_items").update({ status: "approved", approved_fingerprint: contentFp, approved_by: user.email, approved_at: now }).eq("id", item.id).eq("status", "draft").select("id,title,status").single();
    if (error || !data) throw new EddieError("social_item_update_failed", 503);
    await recordDistributionEvent(db, data.id, { action: "approved", statusBefore: "draft", statusAfter: "approved", actor: user.email, receiptId, fingerprint: contentFp });
    return { message: `Done. I approved “${data.title}”. Publishing still needs a separate confirmation.`, record: data };
  }

  if (action.type === "schedule_social_item") {
    const { data: item, error: readError } = await db.from("distribution_items").select("id,title,status,media,caption,hook,cta,format,tracked_url,destination,platform_account_id,approved_fingerprint").eq("id", action.social_item_id).maybeSingle();
    if (readError || !item || item.status !== "approved" || socialContentFingerprint(item) !== action.expected_fingerprint) throw new EddieError("social_item_changed", 409);
    const { data, error } = await db.from("distribution_items").update({ status: "scheduled", scheduled_for: action.scheduled_for, scheduled_fingerprint: action.scheduled_fingerprint, last_error: null }).eq("id", item.id).eq("status", "approved").select("id,title,status,scheduled_for").single();
    if (error || !data) throw new EddieError("social_item_update_failed", 503);
    await recordDistributionEvent(db, data.id, { action: "scheduled", statusBefore: "approved", statusAfter: "scheduled", actor: user.email, receiptId, fingerprint: action.scheduled_fingerprint, decision: { scheduled_for: action.scheduled_for } });
    return { message: `Done. “${data.title}” is scheduled for ${easternTime(action.scheduled_for)} Eastern.`, record: data };
  }

  if (action.type === "publish_social_item") {
    const [{ data: item, error: itemError }, accountResult, configResult] = await Promise.all([
      db.from("distribution_items").select("*").eq("id", action.social_item_id).maybeSingle(),
      db.from("social_accounts").select("*").eq("id", action.account_id).maybeSingle(),
      socialConfig(db),
    ]);
    const account = accountResult?.data;
    if (itemError || !item || !account) throw new EddieError("action_target_not_found", 409);
    const readiness = platformStatus({ platform: action.platform, account, config: configResult });
    if (!readiness.ready) throw new EddieError(readiness.reason, 409);
    if (item.status !== action.expected_status) throw new EddieError("social_item_changed", 409);
    const contentFp = socialContentFingerprint(item);
    if (contentFp !== action.expected_content_fingerprint) throw new EddieError("social_content_changed", 409);
    if (item.status === "scheduled") {
      if (action.expected_scheduled_fingerprint && item.scheduled_fingerprint !== action.expected_scheduled_fingerprint) throw new EddieError("social_time_changed", 409);
      if (new Date(item.scheduled_for).getTime() > Date.now()) throw new EddieError("social_not_yet_due", 409);
    }

    const result = await attemptSocialPublish({ db, item, account, config: configResult, trigger: "eddie", receiptId, actor: user.email, fetchImpl });
    return {
      message: `Done. The post is now live on ${account.account_name}: ${result.providerUrl}`,
      record: { id: item.id, status: "published", provider_post_id: result.providerPostId, provider_url: result.providerUrl },
    };
  }

  if (action.type === "pause_scheduled_social_item") {
    const { data: item, error: readError } = await db.from("distribution_items").select("id,title,status,scheduled_fingerprint,media,caption,hook,cta,format,tracked_url,destination,platform_account_id").eq("id", action.social_item_id).maybeSingle();
    if (readError || !item || item.status !== "scheduled" || item.scheduled_fingerprint !== action.expected_scheduled_fingerprint) throw new EddieError("social_item_changed", 409);
    const { data, error } = await db.from("distribution_items").update({ status: "paused", last_error: null }).eq("id", item.id).eq("status", "scheduled").select("id,title,status").single();
    if (error || !data) throw new EddieError("social_item_update_failed", 503);
    await recordDistributionEvent(db, data.id, { action: "paused", statusBefore: "scheduled", statusAfter: "paused", actor: user.email, receiptId, decision: { scheduled_for: item.scheduled_for } });
    return { message: `Done. “${data.title}” is paused and will not publish automatically.`, record: data };
  }

  if (action.type === "prepare_comment_reply") {
    const { data: opportunity, error: readError } = await db.from("organic_opportunities")
      .select("id,title,excerpt,status").eq("id", action.opportunity_id).maybeSingle();
    if (readError || !opportunity || !["review", "drafted"].includes(opportunity.status) || createHash("sha256").update(opportunity.excerpt).digest("hex") !== action.expected_excerpt_fingerprint) {
      throw new EddieError("social_item_changed", 409);
    }
    const draftFingerprint = createHash("sha256").update(`${opportunity.id}|eddie-comment-reply-v1`).digest("hex");
    const { error: draftError } = await db.from("organic_response_drafts").upsert({
      opportunity_id: opportunity.id,
      body_text: action.draft_body,
      tracked_url: action.draft_tracked_url,
      status: "review",
      fingerprint: draftFingerprint,
      decision: { generated_by: "eddie", receipt_id: receiptId, automatic_publishing: false },
    }, { onConflict: "fingerprint" });
    if (draftError) throw new EddieError("social_comment_draft_failed", 503);
    const { error: oppError } = await db.from("organic_opportunities").update({ status: "drafted", updated_at: now }).eq("id", opportunity.id);
    if (oppError) throw new EddieError("social_comment_draft_failed", 503);
    return { message: `Done. I prepared an authentic reply draft for “${opportunity.title}”. Review it, then post it manually.`, record: { id: opportunity.id, status: "drafted" } };
  }

  throw new EddieError("action_not_allowed", 400);
}