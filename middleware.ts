import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/* Session refresh and the front door. Seed mode (no database configured, or an
   explicit demo flag off production) skips auth so audits and previews can run. */

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const demo =
    process.env.VERCEL_ENV !== "production" && process.env.DEMO_MODE === "true";

  if (demo || !url || !anonKey) {
    if (request.nextUrl.pathname === "/login") {
      return NextResponse.redirect(new URL("/today", request.url));
    }
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const onLogin = request.nextUrl.pathname === "/login";

  if (!user && !onLogin) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (user && onLogin) {
    return NextResponse.redirect(new URL("/today", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons|brand|sw.js|manifest.webmanifest|api).*)",
  ],
};
