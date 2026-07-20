import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { officeAllowedEmail } from "@/lib/server/office-auth";

export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next")?.startsWith("/office")
    ? url.searchParams.get("next")
    : "/office";

  if (!code) return NextResponse.redirect(new URL("/office/login?error=missing_link", url.origin));

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  const email = data.user?.email?.toLowerCase();
  if (error || !email || email !== officeAllowedEmail()) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/office/login?error=not_allowed", url.origin));
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
