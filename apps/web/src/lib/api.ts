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

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
}

/**
 * Same as apiFetch, but also reads the `X-Total-Count` header a paginated
 * list endpoint sets (see apps/api/src/common/pagination.util.ts) — the
 * response body itself is still a plain bounded array, unchanged for every
 * other caller using plain apiFetch against the same route.
 */
export async function apiFetchPaginated<T>(path: string, init: RequestInit = {}): Promise<PaginatedResponse<T>> {
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

  const data = (await res.json()) as T[];
  const total = Number(res.headers.get("X-Total-Count") ?? data.length);
  return { data, total };
}
