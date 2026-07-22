"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import type { InsurancePolicy, Invoice } from "@/lib/types";

export function FileClaimForm({ invoices, policies }: { invoices: Invoice[]; policies: InsurancePolicy[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const formData = new FormData(event.currentTarget);
    const res = await fetch("/api/insurance/claims", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invoiceId: formData.get("invoiceId"),
        policyId: formData.get("policyId"),
        claimedAmount: Number(formData.get("claimedAmount")),
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({ message: "Could not file claim" }));
      setError(Array.isArray(body.message) ? body.message.join(", ") : body.message);
      return;
    }
    setOpen(false);
    event.currentTarget.reset();
    router.refresh();
  }

  if (invoices.length === 0 || policies.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Need at least one unpaid invoice and one policy on file to file a claim.
      </p>
    );
  }

  if (!open) {
    return (
      <Button type="button" onClick={() => setOpen(true)}>
        + File claim
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-5 sm:grid-cols-3">
      <label className="space-y-1 text-sm">
        <span className="block font-medium text-slate-700">Invoice</span>
        <select name="invoiceId" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" required>
          {invoices.map((inv) => (
            <option key={inv.id} value={inv.id}>
              #{inv.invoiceNumber} — {inv.patient.name} ({inv.currency} {Number(inv.totalAmount).toFixed(2)})
            </option>
          ))}
        </select>
      </label>
      <label className="space-y-1 text-sm">
        <span className="block font-medium text-slate-700">Policy</span>
        <select name="policyId" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" required>
          {policies.map((p) => (
            <option key={p.id} value={p.id}>
              {p.policyNumber} — {p.provider.name}
            </option>
          ))}
        </select>
      </label>
      <Input label="Claimed amount" name="claimedAmount" type="number" min={0.01} step="0.01" required />
      {error && (
        <p role="alert" className="col-span-full text-sm text-red-600">
          {error}
        </p>
      )}
      <div className="col-span-full flex gap-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Filing…" : "File claim"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
