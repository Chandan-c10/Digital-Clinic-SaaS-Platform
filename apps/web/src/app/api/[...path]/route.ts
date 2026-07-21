import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ACCESS_TOKEN_COOKIE, API_BASE_URL } from "@/lib/constants";

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

  const upstream = await fetch(url, {
    method: req.method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body,
    cache: "no-store",
  });

  const responseBody = await upstream.text();
  return new NextResponse(responseBody, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("Content-Type") ?? "application/json" },
  });
}

export {
  proxy as GET,
  proxy as POST,
  proxy as PATCH,
  proxy as DELETE,
  proxy as PUT,
};
