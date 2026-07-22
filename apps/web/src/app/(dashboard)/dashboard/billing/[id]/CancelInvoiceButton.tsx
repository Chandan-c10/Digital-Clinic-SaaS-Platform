"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

export function CancelInvoiceButton({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function handleCancel() {
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/billing/invoices/${invoiceId}/cancel`, { method: "PATCH" });
    setSubmitting(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({ message: "Could not cancel invoice" }));
      setError(Array.isArray(body.message) ? body.message.join(", ") : body.message);
      return;
    }
    setConfirmOpen(false);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        disabled={submitting}
        className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
      >
        {submitting ? "Cancelling…" : "Cancel invoice"}
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Cancel this invoice?"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setConfirmOpen(false)}>
              Keep invoice
            </Button>
            <Button type="button" variant="danger" onClick={handleCancel} disabled={submitting}>
              {submitting ? "Cancelling…" : "Cancel invoice"}
            </Button>
          </>
        }
      >
        <p>This cannot be undone. The invoice stays on record but is marked cancelled.</p>
      </Modal>
    </div>
  );
}
