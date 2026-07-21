import { NextRequest, NextResponse } from "next/server";
import { ACCESS_TOKEN_COOKIE } from "@/lib/constants";

const APP_DOMAIN = process.env.NEXT_PUBLIC_APP_DOMAIN ?? "platform.local";

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const hostname = req.headers.get("host")?.split(":")[0] ?? "";

  // Dashboard routes require a session cookie. This is a fast, cheap check
  // only — the NestJS API is what actually verifies the JWT signature on
  // every request; the dashboard layout also re-checks server-side.
  if (url.pathname.startsWith("/dashboard") && !req.cookies.get(ACCESS_TOKEN_COOKIE)) {
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
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
  matcher: ["/dashboard/:path*", "/"],
};
