import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getRequiredSupabaseEnv, hasSupabaseEnv } from "@/lib/supabase/env";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  if (!hasSupabaseEnv()) {
    return response;
  }

  const { publishableKey, url } = getRequiredSupabaseEnv();

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));

        response = NextResponse.next({
          request,
        });

        cookiesToSet.forEach(({ name, options, value }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const isPublicPage =
    path === "/login" ||
    path.startsWith("/auth/confirm") ||
    path.startsWith("/auth/error");
  const redirect = (pathname: string) => {
    const nextResponse = NextResponse.redirect(new URL(pathname, request.url));
    response.cookies
      .getAll()
      .forEach((cookie) => nextResponse.cookies.set(cookie));
    return nextResponse;
  };

  if (!user && !isPublicPage && !path.startsWith("/api/")) {
    return redirect("/login");
  }

  if (user && path === "/login") {
    return redirect("/");
  }

  return response;
}
