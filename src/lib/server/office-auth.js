// @ts-ignore - server-only has no bundled type declarations; enforced at build time by Next.js.
import "server-only";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
