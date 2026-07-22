"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";

/**
 * Scoped to the portal route segment (QA/security audit, 2026-07-22,
 * TC-UX-01) — see the identical comment on (dashboard)/dashboard/error.tsx.
 */
export default function PortalError({
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
