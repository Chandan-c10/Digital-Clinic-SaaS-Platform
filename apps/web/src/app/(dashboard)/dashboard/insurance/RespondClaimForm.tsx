"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function RespondClaimForm({ claimId }: { claimId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState("APPROVED");
  const [approvedAmount, setApprovedAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/insurance/claims/${claimId}/respond`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status,
        approvedAmount: status === "REJECTED" ? undefined : Number(approvedAmount),
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({ message: "Could not respond to claim" }));
      setError(Array.isArray(body.message) ? body.message.join(", ") : body.message);
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
      <select
        aria-label="Claim response"
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
      >
        <option value="APPROVED">Approve</option>
        <option value="PARTIALLY_APPROVED">Partially approve</option>
        <option value="PAID">Mark paid</option>
        <option value="REJECTED">Reject</option>
      </select>
      {status !== "REJECTED" && (
        <input
          aria-label="Approved amount"
          type="number"
          min={0.01}
          step="0.01"
          placeholder="Amount"
          value={approvedAmount}
          onChange={(e) => setApprovedAmount(e.target.value)}
          required
          className="w-28 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        />
      )}
      <Button type="submit" disabled={submitting} className="px-3 py-1.5 text-xs">
        {submitting ? "Saving…" : "Submit"}
      </Button>
      {error && (
        <span role="alert" className="text-xs text-red-600">
          {error}
        </span>
      )}
    </form>
  );
}
