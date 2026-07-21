import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ACCESS_TOKEN_COOKIE, API_BASE_URL, REFRESH_TOKEN_COOKIE } from "@/lib/constants";
import {
  ACCESS_TOKEN_MAX_AGE,
  REFRESH_TOKEN_MAX_AGE,
  sessionCookieOptions,
} from "@/lib/session-cookies";

function callUpstream(url: string, method: string, body: string | undefined, token: string | undefined) {
  return fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body,
    cache: "no-store",
  });
}

/** Same one used by middleware.ts for page loads — kept independent since a
 * Route Handler (unlike a Server Component) is allowed to set cookies, so
 * this covers the client-fetch path middleware.ts never sees. */
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

/**
 * Same-origin proxy so client components can call `/api/patients`,
 * `/api/appointments/available-slots`, etc. without ever touching the
 * httpOnly access-token cookie directly — this route reads it server-side
 * and forwards it as a Bearer header to the NestJS API.
 */
async function proxy(req: NextRequest, { params }: { params: { path: string[] } }) {
  const token = cookies().get(ACCESS_TOKEN_COOKIE)?.value;
  const targetPath = params.path.join("/");
  const url = `${API_BASE_URL}/${targetPath}${req.nextUrl.search}`;

  const body = ["GET", "HEAD"].includes(req.method) ? undefined : await req.text();

  let upstream = await callUpstream(url, req.method, body, token);

  // Client components can stay open on a page for a while — if the access
  // token expired mid-session, try one silent refresh and retry before
  // surfacing the failure, same as middleware.ts does for page navigations.
  if (upstream.status === 401) {
    const refreshToken = cookies().get(REFRESH_TOKEN_COOKIE)?.value;
    const refreshed = refreshToken ? await refreshSession(refreshToken) : null;
    if (refreshed) {
      cookies().set(
        ACCESS_TOKEN_COOKIE,
        refreshed.accessToken,
        sessionCookieOptions(ACCESS_TOKEN_MAX_AGE),
      );
      cookies().set(
        REFRESH_TOKEN_COOKIE,
        refreshed.refreshToken,
        sessionCookieOptions(REFRESH_TOKEN_MAX_AGE),
      );
      upstream = await callUpstream(url, req.method, body, refreshed.accessToken);
    }
  }

  // Stream the body through as-is rather than buffering via .text() — the
  // billing PDF endpoint returns binary data, and decoding/re-encoding that
  // as UTF-8 text would corrupt it. This also forwards Content-Disposition
  // (needed for the PDF's suggested filename) instead of hand-picking headers.
  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") ?? "application/json",
      ...(upstream.headers.get("Content-Disposition")
        ? { "Content-Disposition": upstream.headers.get("Content-Disposition")! }
        : {}),
    },
  });
}

export {
  proxy as GET,
  proxy as POST,
  proxy as PATCH,
  proxy as DELETE,
  proxy as PUT,
};
