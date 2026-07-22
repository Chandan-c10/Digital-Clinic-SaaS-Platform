"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";

/**
 * Scoped to the dashboard route segment (QA/security audit, 2026-07-22,
 * TC-UX-01) — sits alongside layout.tsx, not above it, so a failed panel
 * (an expired-session fetch, an API error) swaps out just this content;
 * the sidebar and header stay mounted instead of the whole dashboard chrome
 * unmounting to the root app/error.tsx.
 */
export default function DashboardError({
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
    <div role="alert" className="flex flex-col items-center gap-4 py-16 text-center">
      <p className="text-sm font-semibold text-red-600">Something went wrong</p>
      <h1 className="text-xl font-bold text-slate-900">This page couldn&rsquo;t load</h1>
      <p className="max-w-md text-slate-600">
        This can happen if your session expired or the connection dropped. Try again, or use the
        sidebar to go elsewhere.
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
