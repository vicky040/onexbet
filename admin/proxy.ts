import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE } from "@/lib/env";
import { verifyAdminSession } from "@/lib/tokens";

/**
 * Two jobs:
 *
 * 1. CORS for `/api/v1`, so the Flutter **web** build can call the API from
 *    the origin `flutter run -d chrome` serves it on. Native builds do not
 *    need this; browsers do.
 * 2. Keeping signed-out visitors out of the panel before any page renders.
 *    The panel layout still re-checks against the database — this is the
 *    cheap first pass, not the authority.
 *
 * The admin API is left alone: it is called from this origin, and it answers
 * with a 401 envelope rather than a redirect.
 *
 * Next 16 calls this file "proxy" (it replaced the middleware convention).
 */

const AGENT_API = "/api/v1";

const CORS_METHODS = "GET, POST, PATCH, DELETE, OPTIONS";
const CORS_HEADERS = "authorization, content-type, accept";

/**
 * Which origin to echo back, or null to send no CORS headers at all.
 *
 * Set ALLOWED_ORIGINS (comma-separated) in production. In development any
 * localhost origin is allowed, because the Flutter web dev server picks a
 * new port on every run.
 */
function allowedOrigin(origin: string | null): string | null {
  const configured = (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (configured.includes("*")) return "*";
  if (!origin) return null;
  if (configured.includes(origin)) return origin;

  if (
    process.env.NODE_ENV !== "production" &&
    /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
  ) {
    return origin;
  }

  return null;
}

function applyCors(headers: Headers, origin: string | null) {
  // Vary regardless, so a cache cannot serve one origin's answer to another.
  headers.append("Vary", "Origin");
  if (!origin) return;
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Methods", CORS_METHODS);
  headers.set("Access-Control-Allow-Headers", CORS_HEADERS);
  headers.set("Access-Control-Max-Age", "86400");
}

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith(AGENT_API)) {
    const origin = allowedOrigin(request.headers.get("origin"));

    if (request.method === "OPTIONS") {
      const preflight = new NextResponse(null, { status: 204 });
      applyCors(preflight.headers, origin);
      return preflight;
    }

    const response = NextResponse.next();
    applyCors(response.headers, origin);
    return response;
  }

  const token = request.cookies.get(ADMIN_COOKIE)?.value;
  const session = token ? await verifyAdminSession(token) : null;
  const isLoginPage = request.nextUrl.pathname === "/login";

  if (!session && !isLoginPage) {
    const url = new URL("/login", request.url);
    const target = request.nextUrl.pathname + request.nextUrl.search;
    if (target !== "/") url.searchParams.set("next", target);
    return NextResponse.redirect(url);
  }

  if (session && isLoginPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // A master only has the dashboard and their own agents. The session token
  // carries the role, so this costs nothing and keeps them off pages that
  // would otherwise render platform-wide data before the API refused it.
  if (session?.role === "MASTER_ADMIN") {
    const path = request.nextUrl.pathname;
    const allowed = path === "/" || path === "/agents" || path.startsWith("/agents/");
    if (!allowed) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // The agent API, for CORS.
    "/api/v1/:path*",
    // Every page, for the session check. Next's own assets, static files and
    // the admin API are left out.
    "/((?!api/|_next/|favicon.ico|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
