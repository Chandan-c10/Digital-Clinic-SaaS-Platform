import "server-only";
import { cookies } from "next/headers";
import { ACCESS_TOKEN_COOKIE, API_BASE_URL } from "./constants";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Server-side fetch helper — attaches the caller's access token cookie. */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = cookies().get(ACCESS_TOKEN_COOKIE)?.value;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(res.status, body.message ?? "Request failed");
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
