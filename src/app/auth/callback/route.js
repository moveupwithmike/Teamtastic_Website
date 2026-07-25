import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { officeAllowedEmail } from "@/lib/server/office-auth";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";

function callbackClient(request, response) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase sign-in is not configured");

  return createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, cacheHeaders) {
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(cacheHeaders || {}).forEach(([name, value]) => response.headers.set(name, value));
      },
    },
  });
}

export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const next = url.searchParams.get("next")?.startsWith("/office")
    ? url.searchParams.get("next")
    : "/office";

  if (!code && !(tokenHash && type === "email")) {
    const response = NextResponse.redirect(new URL("/office/login?error=missing_link", url.origin));
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }

  const response = NextResponse.redirect(new URL(next, url.origin));
  const supabase = callbackClient(request, response);
  const { data, error } = tokenHash
    ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "email" })
    : await supabase.auth.exchangeCodeForSession(code);
  const email = data.user?.email?.toLowerCase();
  if (error || !email || email !== officeAllowedEmail()) {
    await supabase.auth.signOut();
    const errorResponse = NextResponse.redirect(new URL("/office/login?error=not_allowed", url.origin));
    errorResponse.headers.set("Cache-Control", "private, no-store");
    return errorResponse;
  }

  await getSupabaseAdmin().from("agent_log").insert({
    agent_name: "office",
    action: "office_sign_in",
    outcome: "completed",
    decision: { actor: email, auth_user_id: data.user.id },
  });

  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
