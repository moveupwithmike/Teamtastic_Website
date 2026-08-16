// @ts-ignore - server-only has no bundled type declarations; enforced at build time by Next.js.
import "server-only";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";

export function officeAllowedEmail() {
  return (process.env.OFFICE_ALLOWED_EMAIL || process.env.INTERNAL_NOTIFICATION_EMAIL || "")
    .trim().toLowerCase();
}

export async function getOfficeUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user?.email || user.email.toLowerCase() !== officeAllowedEmail()) return null;
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
