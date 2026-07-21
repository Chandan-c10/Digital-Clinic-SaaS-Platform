"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

const METHODS = ["CASH", "CARD", "UPI", "BANK_TRANSFER", "OTHER"];

export function RecordPaymentForm({
  invoiceId,
  remaining,
  currency,
}: {
  invoiceId: string;
  remaining: number;
  currency: string;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState(remaining.toFixed(2));
  const [method, setMethod] = useState("CASH");
  const [reference, setReference] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch(`/api/billing/invoices/${invoiceId}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: Number(amount), method, reference: reference || undefined }),
    });

    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({ message: "Could not record payment" }));
      setError(Array.isArray(body.message) ? body.message.join(", ") : body.message);
      return;
    }

    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-lg border border-slate-200 bg-white p-5"
    >
      <span className="block text-sm font-medium text-slate-700">
        Record a payment (remaining: {currency} {remaining.toFixed(2)})
      </span>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Input
          label="Amount"
          type="number"
          min={0.01}
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
        <label className="space-y-1 text-sm">
          <span className="block font-medium text-slate-700">Method</span>
          <select
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
          >
            {METHODS.map((m) => (
              <option key={m} value={m}>
                {m.replace("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <Input
          label="Reference (optional)"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={submitting}>
        {submitting ? "Recording…" : "Record payment"}
      </Button>
    </form>
  );
}
