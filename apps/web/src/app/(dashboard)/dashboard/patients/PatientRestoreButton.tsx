"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// No "delete" counterpart here — nothing in this UI calls DELETE /patients/:id
// today (see README § Architecture — Patients), so a soft-deleted patient can
// currently only exist via a direct API call. Restore is still real and
// needed: it's the only way back once one does.
export function PatientRestoreButton({ id }: { id: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function restore() {
    setSubmitting(true);
    await fetch(`/api/patients/${id}/restore`, { method: "PATCH" });
    setSubmitting(false);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={restore}
      disabled={submitting}
      className="text-sm font-medium text-brand-600 hover:text-brand-700 disabled:opacity-50"
    >
      {submitting ? "Restoring…" : "Restore"}
    </button>
  );
}
