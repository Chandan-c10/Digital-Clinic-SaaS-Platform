"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CancelInvoiceButton({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCancel() {
    // Native confirm() rather than a custom modal — this app has no Modal
    // component yet (see README § Frontend conventions); this is a stopgap,
    // not the long-term pattern for confirmation dialogs.
    if (!window.confirm("Cancel this invoice? This cannot be undone.")) return;

    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/billing/invoices/${invoiceId}/cancel`, { method: "PATCH" });
    setSubmitting(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({ message: "Could not cancel invoice" }));
      setError(Array.isArray(body.message) ? body.message.join(", ") : body.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleCancel}
        disabled={submitting}
        className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
      >
        {submitting ? "Cancelling…" : "Cancel invoice"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
