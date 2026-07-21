"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

/**
 * Next.js only preserves `message`/`digest` on errors crossing the server →
 * client boundary into this component (custom fields like ApiError's
 * `status` are stripped), so this can't reliably branch on "was this a 401."
 * It's also a last resort by the time it fires — middleware.ts and the proxy
 * route (apps/web/src/app/api/[...path]/route.ts) already silently refresh
 * an expired access token before a request gets this far, so this mainly
 * covers a fully expired session (30-day refresh token) or a genuine outage.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-sm font-semibold text-red-600">Something went wrong</p>
      <h1 className="text-2xl font-bold text-slate-900">We couldn&rsquo;t load this page</h1>
      <p className="max-w-md text-slate-600">
        This can happen if your session expired or the connection dropped. Try again, or log in
        again if the problem continues.
      </p>
      <div className="flex gap-3">
        <Button onClick={reset}>Try again</Button>
        <Link
          href="/login"
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Log in again
        </Link>
      </div>
    </main>
  );
}
