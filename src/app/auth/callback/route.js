import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { officeAllowedEmail } from "@/lib/server/office-auth";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";

export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next")?.startsWith("/office")
    ? url.searchParams.get("next")
    : "/office";

  if (!code) {
    const response = NextResponse.redirect(new URL("/office/login?error=missing_link", url.origin));
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  const email = data.user?.email?.toLowerCase();
  if (error || !email || email !== officeAllowedEmail()) {
    await supabase.auth.signOut();
    const response = NextResponse.redirect(new URL("/office/login?error=not_allowed", url.origin));
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }

  await getSupabaseAdmin().from("agent_log").insert({
    agent_name: "office",
    action: "office_sign_in",
    outcome: "completed",
    decision: { actor: email, auth_user_id: data.user.id },
  });

  const response = NextResponse.redirect(new URL(next, url.origin));
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
