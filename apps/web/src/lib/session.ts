import "server-only";
import { cookies } from "next/headers";
import { ACCESS_TOKEN_COOKIE } from "./constants";

export interface Session {
  userId: string;
  role: string;
  clinicId: string | null;
}

/**
 * Decodes the access token's payload for UI purposes only (which nav
 * items to show, which clinicId to fetch). This does NOT verify the
 * signature — every API request is still authorized by the NestJS
 * resource server, which does verify it. Never trust this for access
 * control decisions, only for rendering.
 */
export function getSession(): Session | null {
  const token = cookies().get(ACCESS_TOKEN_COOKIE)?.value;
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;

  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    if (!payload.sub) return null;
    return { userId: payload.sub, role: payload.role, clinicId: payload.clinicId ?? null };
  } catch {
    return null;
  }
}
