import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

function applyCacheHeaders(response, cacheHeaders) {
  if (!cacheHeaders) return;
  if (typeof cacheHeaders.forEach === "function") {
    cacheHeaders.forEach((value, key) => response.headers.set(key, value));
    return;
  }
  Object.entries(cacheHeaders).forEach(([key, value]) => response.headers.set(key, value));
}

export async function proxy(request) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, cacheHeaders) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        applyCacheHeaders(response, cacheHeaders);
      },
    },
  });

  await supabase.auth.getUser();
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: ["/office/:path*"],
};
