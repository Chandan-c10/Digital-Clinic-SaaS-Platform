"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

export function StaffStatusToggle({
  id,
  name,
  isActive,
}: {
  id: string;
  name: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function toggle() {
    setSubmitting(true);
    await fetch(`/api/staff/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    setSubmitting(false);
    setConfirmOpen(false);
    router.refresh();
  }

  // Reactivating isn't destructive — only confirm before deactivating,
  // which also signs the account out of any live session (see the
  // isActive comment on the User model).
  if (!isActive) {
    return (
      <button
        type="button"
        onClick={toggle}
        disabled={submitting}
        className="text-sm font-medium text-brand-600 hover:text-brand-700 disabled:opacity-50"
      >
        Reactivate
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        disabled={submitting}
        className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
      >
        Deactivate
      </button>
      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Deactivate staff member?"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="danger" onClick={toggle} disabled={submitting}>
              {submitting ? "Deactivating…" : "Deactivate"}
            </Button>
          </>
        }
      >
        <p>
          <strong>{name}</strong> will be signed out of any active session and won&rsquo;t be able to
          log in until reactivated. Their history is kept, not deleted.
        </p>
      </Modal>
    </>
  );
}
