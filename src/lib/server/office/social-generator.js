import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { buildTrackedUrl, slugify } from "./social-shared";
import { buildVoiceContext } from "./social-voice";
import { recordDistributionEvent } from "./social-events";

export const MAX_PROPOSALS_PER_ACCOUNT = 2;
// The plan calls for "a deliberately small daily plan — normally two or three
// strong items, not a flood of generic content." Per-account capacity alone
// doesn't guarantee that once there are several connected accounts, so this
// caps the whole batch too. Round-robin below (one slot per account per pass)
// keeps platform variety instead of exhausting the budget on one account.
export const MAX_DAILY_PROPOSALS = 3;
const DEDUP_LOOKBACK_DAYS = 30;

const OBJECTIVE_ROTATION = ["awareness", "consideration", "conversion", "engagement", "follow_up"];
const FUNNEL_STAGE = { awareness: "top", consideration: "middle", conversion: "bottom", engagement: "middle", follow_up: "bottom" };

// Platform-specific lead lines keep the rule "post a platform-specific version,
// never identical filler across every platform" without inventing new copy.
const PLATFORM_LEAD = {
  linkedin: "A quick thought for your feed:",
  instagram: "A moment worth saving:",
  facebook: "The honest take:",
  x: "Take:",
  reddit: "From the team event trenches:",
};

const CTA_TEMPLATES = {
  awareness: "Want to see it happen live? Tell us about your team.",
  consideration: "Curious how it works? Book a 15-minute walkthrough.",
  conversion: "Ready to lock in a date? Reach out today.",
  engagement: "Tell us in the comments — what would your team do first?",
  follow_up: "Forward this to whoever plans your team events.",
};

const TARGET_PAGES = [
  "/team-building/corporate",
  "/virtual-holiday-party",
  "/virtual-family-reunion-game-show",
  "/virtual-birthday-game-show",
  "/long-distance-family-game-night",
];

function normalizeCopy(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function generatorHash(platform, caption) {
  return createHash("sha256").update(`${platform}|${normalizeCopy(caption)}`).digest("hex");
}

export function easternGenerationDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

async function claimDailyRun(db, { generationDate, trigger }) {
  const { data, error } = await db.from("social_generation_runs").insert({
    generation_date: generationDate,
    trigger,
    status: "running",
  }).select("id,generation_date,status,created_count,batch_id,result").single();
  if (!error && data) return { run: data };

  // A unique generation_date is the concurrency-safe lock. If a Vercel retry
  // races the original invocation, the retry reports the existing run and
  // creates no additional drafts.
  const { data: existing, error: existingError } = await db.from("social_generation_runs")
    .select("id,generation_date,status,created_count,batch_id,result")
    .eq("generation_date", generationDate).maybeSingle();
  if (!existingError && existing) return { existing };
  return { error: error || existingError || { message: "run_claim_failed" } };
}

async function completeDailyRun(db, runId, result) {
  await db.from("social_generation_runs").update({
    status: "completed",
    created_count: Number(result.created || 0),
    batch_id: result.batch_id || null,
    result,
    error: null,
    completed_at: new Date().toISOString(),
  }).eq("id", runId);
}

async function releaseFailedRun(db, runId) {
  // Removing only our claimed row allows the next scheduled retry to recover.
  // The unique date lock still protects every in-flight successful invocation.
  await db.from("social_generation_runs").delete().eq("id", runId).eq("status", "running");
}

// Fast, case-insensitive guard against the avoid list. Entries shorter than 4
// characters are ignored so genuinely shared words never veto a batch.
function containsAvoid(text, avoid) {
  const haystack = normalizeCopy(text);
  return avoid.some((entry) => {
    const needle = normalizeCopy(entry.body);
    return needle.length >= 4 && haystack.includes(needle);
  });
}

// Proposes the day's social drafts from approved voice + connected accounts.
// This is review-only: rows are inserted as drafts, nothing is approved or
// scheduled, and publication switches are never consulted or changed.
export async function buildMorningProposals({ db, now = new Date(), trigger = "office" }) {
  const { data: config, error: configError } = await db.from("system_config")
    .select("social_generator_enabled").eq("id", true).maybeSingle();
  if (configError || !config?.social_generator_enabled) return { enabled: false, reason: "generator_off" };

  const generationDate = easternGenerationDate(now);
  const claimed = await claimDailyRun(db, { generationDate, trigger: trigger === "vercel_cron" ? "vercel_cron" : "office" });
  if (claimed.existing) {
    return {
      enabled: true,
      created: 0,
      already_generated: true,
      generation_date: generationDate,
      previous_created: Number(claimed.existing.created_count || 0),
      batch_id: claimed.existing.batch_id || null,
    };
  }
  if (!claimed.run) return { enabled: false, reason: "generator_run_unavailable" };
  const runId = claimed.run.id;

  const cutoff = new Date(now.getTime() - DEDUP_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const [voice, accountsResult, recentResult] = await Promise.all([
    buildVoiceContext(db),
    db.from("social_accounts")
      .select("id,platform,account_name,destination,requires_manual_post,status")
      .eq("status", "connected").order("platform", { ascending: true }).limit(50),
    db.from("distribution_items")
      .select("id,channel,status,caption,body_text,source_evidence")
      .gte("created_at", cutoff).limit(200),
  ]);

  const accounts = (accountsResult.data || [])
    .filter((account) => account && account.platform)
    .sort((a, b) => `${a.platform}:${a.account_name}`.localeCompare(`${b.platform}:${b.account_name}`));

  const recent = (recentResult.data || []).filter((item) => !["rejected", "archived"].includes(item.status));
  const usedHashes = new Set();
  for (const item of recent) {
    const hash = generatorHash(item.channel, item.caption || item.body_text);
    usedHashes.add(hash);
    if (item.source_evidence?.generator_hash) usedHashes.add(String(item.source_evidence.generator_hash));
  }

  const { signatures, openers, phrases, facts, avoid } = voice;
  if (!signatures.length && !openers.length && !facts.length) {
    const result = { enabled: true, created: 0, generation_date: generationDate, skipped: { no_voice: accounts.length } };
    await completeDailyRun(db, runId, result);
    return result;
  }

  const campaign = `social_${now.toISOString().slice(0, 7).replace("-", "_")}`;
  const batchId = randomUUID();
  const proposed = [];
  let signatureCursor = 0, openerCursor = 0, phraseCursor = 0, factCursor = 0, targetCursor = 0;
  let duplicates = 0, avoided = 0;

  batch: for (let slot = 0; slot < MAX_PROPOSALS_PER_ACCOUNT; slot += 1) {
    for (const account of accounts) {
      if (proposed.length >= MAX_DAILY_PROPOSALS) break batch;
      const objective = OBJECTIVE_ROTATION[(accounts.indexOf(account) + slot) % OBJECTIVE_ROTATION.length];
      let row = null;

      for (let attempt = 0; attempt < 3 && !row; attempt += 1) {
        const signature = signatures[signatureCursor % signatures.length]; signatureCursor += 1;
        const opener = openers[openerCursor % openers.length]; openerCursor += 1;
        const phrase = phrases[phraseCursor % phrases.length]; phraseCursor += 1;
        const fact = facts[factCursor % facts.length]; factCursor += 1;
        if (!signature && !opener && !fact) break;

        const anchor = fact?.body || signature?.body || opener?.body || account.account_name;
        const title = anchor.length > 60 ? `${anchor.slice(0, 57)}…` : anchor;
        const hook = opener?.body || signature?.body || fact?.body;
        const lead = PLATFORM_LEAD[account.platform] || "";
        const caption = [lead, fact?.body, phrase?.body].filter(Boolean).join("\n\n");
        const cta = CTA_TEMPLATES[objective];
        const fullCopy = [hook, caption, cta].join("\n");
        if (containsAvoid(fullCopy, avoid)) { avoided += 1; continue; }

        const hash = generatorHash(account.platform, caption);
        if (usedHashes.has(hash)) { duplicates += 1; continue; }
        usedHashes.add(hash);

        const targetPage = TARGET_PAGES[targetCursor % TARGET_PAGES.length]; targetCursor += 1;
        const trackedUrl = buildTrackedUrl({ channel: account.platform, targetPage, campaign, content: slugify(title) });
        const voiceUsed = [
          signature && { kind: "signature", id: signature.id },
          opener && { kind: "opener", id: opener.id },
          phrase && { kind: "phrase", id: phrase.id },
          fact && { kind: "fact", id: fact.id },
        ].filter(Boolean);

        row = {
          title,
          channel: account.platform,
          audience: "",
          target_page: targetPage,
          body_text: [hook, caption, cta].filter(Boolean).join("\n\n"),
          utm_source: account.platform,
          utm_medium: "organic_distribution",
          utm_campaign: campaign,
          utm_content: slugify(title),
          tracked_url: trackedUrl,
          status: "draft",
          format: "text",
          content_objective: objective,
          funnel_stage: FUNNEL_STAGE[objective],
          hook: hook || null,
          caption,
          cta,
          media: [],
          destination: account.destination || account.account_name,
          platform_account_id: account.id,
          publish_mode: "now",
          requires_manual_post: Boolean(account.requires_manual_post || account.platform === "reddit"),
          source_evidence: {
            generated_by: "morning_generator",
            batch_id: batchId,
            generator_hash: hash,
            generator_voice: voiceUsed,
            // These two are honest about today's method: rotation through
            // approved voice copy, not yet a signal-driven pick (no lead,
            // SEO, or engagement data is read). Revisit once that lands.
            reason: `Rotates approved ${objective.replace("_", " ")} voice copy for ${account.platform}; no live lead, SEO, or engagement signal was used to choose this topic.`,
            measurement: `Track via ${account.platform} post engagement and tracked-link clicks/leads under utm_campaign "${campaign}".`,
          },
          voice_sources: voiceUsed,
          fingerprint: `generator:${batchId}:${randomUUID()}`,
          decision: { generated_by: "morning_generator", batch_id: batchId, automatic_publishing: false },
        };
      }

      if (row) proposed.push(row);
    }
  }

  if (!proposed.length) {
    const result = { enabled: true, created: 0, batch_id: batchId, generation_date: generationDate, skipped: { no_content: true, duplicates, avoided } };
    await completeDailyRun(db, runId, result);
    return result;
  }

  const { data, error } = await db.from("distribution_items").insert(proposed).select("id,title,channel,status");
  if (error || !data) {
    await releaseFailedRun(db, runId);
    return { enabled: false, reason: "generator_failed" };
  }

  for (const row of data) {
    await recordDistributionEvent(db, row.id, {
      action: "created",
      statusBefore: null,
      statusAfter: "draft",
      actor: "morning_generator",
      decision: { generated_by: "morning_generator", batch_id: batchId, automatic_publishing: false },
    });
  }

  const result = {
    enabled: true,
    created: data.length,
    batch_id: batchId,
    generation_date: generationDate,
    campaigns: campaign,
    skipped: { duplicates, avoided },
  };
  await completeDailyRun(db, runId, result);
  return result;
}
