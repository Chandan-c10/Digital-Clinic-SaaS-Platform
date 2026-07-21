"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function StaffStatusToggle({ id, isActive }: { id: string; isActive: boolean }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function toggle() {
    setSubmitting(true);
    await fetch(`/api/staff/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    setSubmitting(false);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={submitting}
      className={
        isActive
          ? "text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
          : "text-sm font-medium text-brand-600 hover:text-brand-700 disabled:opacity-50"
      }
    >
      {isActive ? "Deactivate" : "Reactivate"}
    </button>
  );
}
