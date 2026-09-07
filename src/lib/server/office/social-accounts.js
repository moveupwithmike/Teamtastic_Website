"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import { requireOfficeUser } from "@/lib/server/office-auth";
import { audit, clean } from "./shared";
import { SOCIAL_PLATFORMS } from "./social-shared";

const ACCOUNTS_PATH = "/office/social-accounts";

function fail(code) {
  redirect(`${ACCOUNTS_PATH}?error=${code}`);
}

export async function createSocialAccount(formData) {
  const user = await requireOfficeUser();
  const db = getSupabaseAdmin();
  const platform = clean(formData.get("platform"), 20);
  const accountName = clean(formData.get("account_name"), 120);
  const accountType = clean(formData.get("account_type"), 30) || "organization";
  const providerId = clean(formData.get("provider_id"), 200);
  const destination = clean(formData.get("destination"), 200) || null;
  const requiresManualPost = formData.get("requires_manual_post") === "on";
  const accessToken = clean(formData.get("access_token"), 1000) || null;
  const orgUrn = clean(formData.get("org_urn"), 200) || null;
  if (!SOCIAL_PLATFORMS.includes(platform) || platform === "reddit") fail("platform_invalid");
  if (!accountName) fail("incomplete");
  if (requiresManualPost && accessToken) fail("manual_token_mixed");
  if (accessToken && !providerId) fail("provider_id_required");

  const credentials = accessToken
    ? { access_token: accessToken, ...(orgUrn ? { org_urn: orgUrn } : {}) }
    : null;

  const { data, error } = await db.from("social_accounts").insert({
    platform,
    account_name: accountName,
    account_type: accountType,
    provider_id: providerId,
    destination: destination || accountName,
    requires_manual_post: requiresManualPost,
    credentials,
    status: accessToken ? "connected" : "disconnected",
  }).select("id,platform,account_name,status").single();
  if (error || !data) fail("create_failed");
  await audit("create_social_account", user, { account_id: data.id, platform, account_name: data.account_name, status: data.status });
  revalidatePath(ACCOUNTS_PATH);
  redirect(`${ACCOUNTS_PATH}?success=created`);
}

export async function updateSocialAccount(formData) {
  const user = await requireOfficeUser();
  const db = getSupabaseAdmin();
  const id = clean(formData.get("id"), 60);
  if (!id) fail("incomplete");
  const { data: account } = await db.from("social_accounts").select("id,platform,status,credentials").eq("id", id).maybeSingle();
  if (!account) fail("missing");
  const changes = {};
  if (formData.has("write_enabled")) changes.write_enabled = formData.get("write_enabled") === "on";
  if (formData.has("requires_manual_post")) changes.requires_manual_post = formData.get("requires_manual_post") === "on";
  if (formData.has("status")) {
    const status = clean(formData.get("status"), 20);
    if (["connected", "disconnected", "revoked"].includes(status)) changes.status = status;
  }
  const accessToken = clean(formData.get("access_token"), 1000);
  if (accessToken) changes.credentials = { ...(account.credentials || {}), access_token: accessToken };
  if (!Object.keys(changes).length) redirect(`${ACCOUNTS_PATH}?success=updated`);
  const { error } = await db.from("social_accounts").update(changes).eq("id", id);
  if (error) fail("update_failed");
  await audit("update_social_account", user, { account_id: id, changed: Object.keys(changes) });
  revalidatePath(ACCOUNTS_PATH);
  redirect(`${ACCOUNTS_PATH}?success=updated`);
}

export async function updateSocialConfig(formData) {
  const user = await requireOfficeUser();
  const db = getSupabaseAdmin();
  const patch = {};
  for (const flag of ["social_master_enabled", "linkedin_write_enabled", "instagram_write_enabled", "facebook_write_enabled", "x_write_enabled"]) {
    if (formData.has(flag)) patch[flag] = formData.get(flag) === "on";
  }
  if (!Object.keys(patch).length) redirect(`${ACCOUNTS_PATH}?success=updated`);
  const { error } = await db.from("system_config").update(patch).eq("id", true);
  if (error) fail("update_failed");
  await audit("update_social_config", user, patch);
  revalidatePath(ACCOUNTS_PATH);
  redirect(`${ACCOUNTS_PATH}?success=updated`);
}