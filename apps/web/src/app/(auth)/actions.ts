"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACCESS_TOKEN_COOKIE, API_BASE_URL, REFRESH_TOKEN_COOKIE } from "@/lib/constants";
import {
  ACCESS_TOKEN_MAX_AGE,
  REFRESH_TOKEN_MAX_AGE,
  sessionCookieOptions,
} from "@/lib/session-cookies";

function setSessionCookies(accessToken: string, refreshToken: string) {
  cookies().set(ACCESS_TOKEN_COOKIE, accessToken, sessionCookieOptions(ACCESS_TOKEN_MAX_AGE));
  cookies().set(REFRESH_TOKEN_COOKIE, refreshToken, sessionCookieOptions(REFRESH_TOKEN_MAX_AGE));
}

export async function loginAction(_prevState: unknown, formData: FormData) {
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
  redirect("/dashboard");
}

export async function registerClinicAction(_prevState: unknown, formData: FormData) {
  const payload = {
    clinicName: String(formData.get("clinicName") ?? ""),
    slug: String(formData.get("slug") ?? "").toLowerCase(),
    ownerName: String(formData.get("ownerName") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  };

  const res = await fetch(`${API_BASE_URL}/auth/register-clinic`, {
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
  redirect("/dashboard");
}

export async function logoutAction() {
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
  redirect("/login");
}
