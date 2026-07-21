// Shared between Server Actions (apps/web/src/app/(auth)/actions.ts, using
// `next/headers` cookies()) and middleware.ts (using NextResponse's
// ResponseCookies) — both accept the same options shape, so the values stay
// in one place instead of drifting between two hand-copied literals.
//
// These durations mirror the API's JWT_ACCESS_EXPIRES_IN / JWT_REFRESH_EXPIRES_IN
// *defaults* (see .env.example) — they are not read from the API's actual
// config, so if those env vars are changed in a deployment, update the values
// below to match. A cookie that outlives its token is harmless (the API still
// rejects the expired JWT), but a cookie that expires *before* its token does
// forces an unnecessary logout.
export const ACCESS_TOKEN_MAX_AGE = 15 * 60;
export const REFRESH_TOKEN_MAX_AGE = 30 * 24 * 60 * 60;

export function sessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}
