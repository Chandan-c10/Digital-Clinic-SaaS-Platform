"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

const TYPES = ["RECEIVED", "DISPENSED", "ADJUSTED", "EXPIRED", "DAMAGED"];

export function RecordTransactionForm({ itemId, unit }: { itemId: string; unit: string }) {
  const router = useRouter();
  const [type, setType] = useState("RECEIVED");
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch(`/api/inventory/items/${itemId}/transactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, quantity: Number(quantity), reason: reason || undefined }),
    });

    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({ message: "Could not record transaction" }));
      setError(Array.isArray(body.message) ? body.message.join(", ") : body.message);
      return;
    }

    setReason("");
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-lg border border-slate-200 bg-white p-5"
    >
      <span className="block text-sm font-medium text-slate-700">Record stock movement</span>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="space-y-1 text-sm">
          <span className="block font-medium text-slate-700">Type</span>
          <select
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <Input
          label={`Quantity (${unit})`}
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          required
        />
        <Input label="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
      {type === "ADJUSTED" && (
        <p className="text-xs text-slate-500">
          For ADJUSTED, use a negative quantity to correct stock downward.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <Button type="submit" disabled={submitting}>
        {submitting ? "Recording…" : "Record"}
      </Button>
    </form>
  );
}
