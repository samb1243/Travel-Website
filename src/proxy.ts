import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Optimistic check only: if there's no session cookie at all, send the user
 * to /login straight away instead of rendering the page first. The real check
 * (is the session valid? does this user own the trip?) happens on the server
 * in every page and action via src/server/session.ts.
 */
export function proxy(request: NextRequest) {
  if (getSessionCookie(request)) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  const login = new URL("/login", request.url);
  login.searchParams.set("next", pathname + search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/dashboard/:path*", "/profile/:path*", "/trips/:path*", "/invite/:path*"],
};
