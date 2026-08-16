// @ts-ignore - server-only has no bundled type declarations; enforced at build time by Next.js.
import "server-only";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";

// OFFICE_ALLOWED_EMAILS supports a comma-separated list so more than one
// admin can sign in; OFFICE_ALLOWED_EMAIL and INTERNAL_NOTIFICATION_EMAIL
// remain as single-address fallbacks for existing deployments.
export function officeAllowedEmails() {
  const raw = process.env.OFFICE_ALLOWED_EMAILS
    || process.env.OFFICE_ALLOWED_EMAIL
    || process.env.INTERNAL_NOTIFICATION_EMAIL
    || "";
  return raw.split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);
}

export function isOfficeAllowedEmail(email) {
  const normalized = String(email || "").trim().toLowerCase();
  return normalized !== "" && officeAllowedEmails().includes(normalized);
}

export async function getOfficeUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user?.email || !isOfficeAllowedEmail(user.email)) return null;
  return user;
}

export async function requireOfficeUser() {
  const user = await getOfficeUser();
  if (!user) redirect("/office/login");
  return user;
}

// Defense-in-depth: bundles the authorization check together with the
// service-role (RLS-bypassing) client, so a private office page's data
// access can't be reached without also passing requireOfficeUser() — the
// check no longer depends solely on the page living under the
// (private) route group.
export async function getOfficeDb() {
  const user = await requireOfficeUser();
  return { db: getSupabaseAdmin(), user };
}
