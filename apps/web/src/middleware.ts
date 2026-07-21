import { NextRequest, NextResponse } from "next/server";
import { ACCESS_TOKEN_COOKIE, API_BASE_URL, REFRESH_TOKEN_COOKIE } from "@/lib/constants";
import {
  ACCESS_TOKEN_MAX_AGE,
  REFRESH_TOKEN_MAX_AGE,
  sessionCookieOptions,
} from "@/lib/session-cookies";

const APP_DOMAIN = process.env.NEXT_PUBLIC_APP_DOMAIN ?? "platform.local";

/**
 * Access tokens are short-lived (15m default) and nothing else in the app
 * ever calls this — without it, every dashboard session would hard-expire
 * every 15 minutes despite holding a valid 30-day refresh token. Returns
 * null on any failure (expired/revoked refresh token, API unreachable) so
 * the caller falls back to redirecting to login.
 */
async function refreshSession(
  refreshToken: string,
): Promise<{ accessToken: string; refreshToken: string } | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as { accessToken: string; refreshToken: string };
  } catch {
    return null;
  }
}

// Dashboard (clinic staff) and portal (patients) are separate login flows
// with separate landing pages, but share the same cookie-based session
// mechanism — see apps/web/src/lib/session-cookies.ts.
const PROTECTED_PREFIXES = [
  { prefix: "/dashboard", loginPath: "/login" },
  { prefix: "/portal", loginPath: "/portal/login" },
];

export async function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const hostname = req.headers.get("host")?.split(":")[0] ?? "";

  const protectedMatch = PROTECTED_PREFIXES.find((p) => url.pathname.startsWith(p.prefix));

  // Protected routes require a session. This is a fast, cheap check plus a
  // silent refresh when the access token cookie has expired — the NestJS API
  // is what actually verifies the JWT signature on every request; the
  // dashboard/portal layouts also re-check server-side. This is a UX layer
  // (avoid an unnecessary forced logout every 15 minutes), not the security
  // boundary.
  if (protectedMatch && !req.cookies.get(ACCESS_TOKEN_COOKIE)) {
    const refreshToken = req.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
    const refreshed = refreshToken ? await refreshSession(refreshToken) : null;

    if (!refreshed) {
      const loginUrl = new URL(protectedMatch.loginPath, req.url);
      const redirectResponse = NextResponse.redirect(loginUrl);
      redirectResponse.cookies.delete(ACCESS_TOKEN_COOKIE);
      redirectResponse.cookies.delete(REFRESH_TOKEN_COOKIE);
      return redirectResponse;
    }

    // Forward the refreshed token on the request itself so this same
    // request's server components see it immediately, not just the next one.
    req.cookies.set(ACCESS_TOKEN_COOKIE, refreshed.accessToken);
    const response = NextResponse.next({ request: { headers: req.headers } });
    response.cookies.set(
      ACCESS_TOKEN_COOKIE,
      refreshed.accessToken,
      sessionCookieOptions(ACCESS_TOKEN_MAX_AGE),
    );
    response.cookies.set(
      REFRESH_TOKEN_COOKIE,
      refreshed.refreshToken,
      sessionCookieOptions(REFRESH_TOKEN_MAX_AGE),
    );
    return response;
  }

  // Subdomain routing: {slug}.platform.local -> /c/{slug} (the clinic's
  // public marketing website, module B "Website Builder").
  //
  // TODO(phase 2): custom domains (www.drsmith.com) need a lookup from
  // hostname -> clinic slug. That lookup can't hit Postgres directly from
  // Edge middleware — call a small cached API route (e.g.
  // GET /clinics/resolve-domain?host=...) once that endpoint exists, then
  // rewrite the same way as the subdomain case below.
  if (hostname !== APP_DOMAIN && hostname.endsWith(`.${APP_DOMAIN}`)) {
    const slug = hostname.slice(0, -(`.${APP_DOMAIN}`.length));
    if (slug && slug !== "www" && url.pathname === "/") {
      url.pathname = `/c/${slug}`;
      return NextResponse.rewrite(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/portal/:path*", "/"],
};
