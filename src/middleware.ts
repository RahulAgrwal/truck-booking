import { NextResponse, type NextRequest } from "next/server";

/**
 * Cheap gate only (TechnicalDocument.md §4.3).
 *
 * Middleware runs on the Edge runtime, where the Firebase Admin SDK cannot run,
 * so this checks for the *presence* of a session cookie and nothing more. Real
 * cryptographic verification happens in getSession() inside Server Components
 * and Server Actions — that is the boundary that actually protects data.
 * Role separation lives in requireRole(), for the same reason.
 */

const SESSION_COOKIE = "__session";

// Signed-in users have no business here.
const PUBLIC_ONLY = ["/login", "/signup"];

// Everything below requires a cookie.
const PROTECTED = ["/shipper", "/carrier", "/onboarding", "/profile"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // /api/cron carries its own bearer secret and is called by Cloud Scheduler,
  // which has no cookie. It must never be redirected to /login.
  if (pathname.startsWith("/api/cron")) return NextResponse.next();

  // DEV_AUTH_BYPASS mocks a session server-side but sets no cookie, so this
  // gate would bounce every request. getSession() still enforces the real rule.
  if (process.env.DEV_AUTH_BYPASS === "true" && process.env.NODE_ENV !== "production") {
    return NextResponse.next();
  }

  const hasCookie = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  if (!hasCookie && PROTECTED.some((path) => pathname.startsWith(path))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (hasCookie && PUBLIC_ONLY.some((path) => pathname.startsWith(path))) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Skip Next internals and static assets — matching them would cost a
  // middleware invocation per image.
  matcher: ["/((?!_next/static|_next/image|icons|manifest.json|favicon.ico|.*\\.svg$).*)"],
};
