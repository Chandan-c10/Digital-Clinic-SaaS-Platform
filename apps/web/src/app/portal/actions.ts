"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACCESS_TOKEN_COOKIE, API_BASE_URL, REFRESH_TOKEN_COOKIE } from "@/lib/constants";
import {
  ACCESS_TOKEN_MAX_AGE,
  REFRESH_TOKEN_MAX_AGE,
  sessionCookieOptions,
} from "@/lib/session-cookies";

// Separate from apps/web/src/app/(auth)/actions.ts only in where they
// redirect afterward (/portal vs /dashboard) — login itself is the same
// role-agnostic /auth/login endpoint, since a User row's role decides what
// it can do, not which form was used to log in.
function setSessionCookies(accessToken: string, refreshToken: string) {
  cookies().set(ACCESS_TOKEN_COOKIE, accessToken, sessionCookieOptions(ACCESS_TOKEN_MAX_AGE));
  cookies().set(REFRESH_TOKEN_COOKIE, refreshToken, sessionCookieOptions(REFRESH_TOKEN_MAX_AGE));
}

export async function patientLoginAction(_prevState: unknown, formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: "Login failed" }));
    return { error: body.message ?? "Invalid email or password" };
  }

  const { accessToken, refreshToken } = await res.json();
  setSessionCookies(accessToken, refreshToken);
  redirect("/portal");
}

export async function patientRegisterAction(_prevState: unknown, formData: FormData) {
  const payload = {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? "") || undefined,
    password: String(formData.get("password") ?? ""),
  };

  const res = await fetch(`${API_BASE_URL}/auth/register-patient`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: "Registration failed" }));
    return { error: Array.isArray(body.message) ? body.message.join(", ") : body.message };
  }

  const { accessToken, refreshToken } = await res.json();
  setSessionCookies(accessToken, refreshToken);
  redirect("/portal");
}

export async function portalLogoutAction() {
  const refreshToken = cookies().get(REFRESH_TOKEN_COOKIE)?.value;
  if (refreshToken) {
    await fetch(`${API_BASE_URL}/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      cache: "no-store",
    }).catch(() => undefined);
  }
  cookies().delete(ACCESS_TOKEN_COOKIE);
  cookies().delete(REFRESH_TOKEN_COOKIE);
  redirect("/portal/login");
}
