"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import type { Patient } from "@/lib/types";

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

const EMPTY_LINE_ITEM: LineItem = { description: "", quantity: 1, unitPrice: 0 };

export function NewInvoiceForm({ patients }: { patients: Patient[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [patientId, setPatientId] = useState(patients[0]?.id ?? "");
  const [lineItems, setLineItems] = useState<LineItem[]>([{ ...EMPTY_LINE_ITEM }]);
  const [discountAmount, setDiscountAmount] = useState("0");
  const [taxAmount, setTaxAmount] = useState("0");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subtotal = lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const total = subtotal - Number(discountAmount || 0) + Number(taxAmount || 0);

  function updateLineItem(index: number, patch: Partial<LineItem>) {
    setLineItems((items) => items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/billing/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientId,
        lineItems,
        discountAmount: Number(discountAmount || 0),
        taxAmount: Number(taxAmount || 0),
        notes: notes || undefined,
      }),
    });

    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({ message: "Could not create invoice" }));
      setError(Array.isArray(body.message) ? body.message.join(", ") : body.message);
      return;
    }

    const invoice = await res.json();
    router.push(`/dashboard/billing/${invoice.id}`);
  }

  if (!open) {
    return (
      <Button type="button" onClick={() => setOpen(true)} disabled={patients.length === 0}>
        + New invoice
      </Button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-6 space-y-4 rounded-lg border border-slate-200 bg-white p-5"
    >
      <label className="block space-y-1 text-sm">
        <span className="block font-medium text-slate-700">Patient</span>
        <select
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          value={patientId}
          onChange={(e) => setPatientId(e.target.value)}
        >
          {patients.map((patient) => (
            <option key={patient.id} value={patient.id}>
              {patient.name}
            </option>
          ))}
        </select>
      </label>

      <div className="space-y-2">
        <span className="block text-sm font-medium text-slate-700">Line items</span>
        {lineItems.map((item, index) => (
          <div key={index} className="grid grid-cols-12 gap-2">
            <input
              className="col-span-6 rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="Description"
              value={item.description}
              onChange={(e) => updateLineItem(index, { description: e.target.value })}
              required
            />
            <input
              type="number"
              min={1}
              className="col-span-2 rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="Qty"
              value={item.quantity}
              onChange={(e) => updateLineItem(index, { quantity: Number(e.target.value) })}
              required
            />
            <input
              type="number"
              min={0}
              step="0.01"
              className="col-span-3 rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="Unit price"
              value={item.unitPrice}
              onChange={(e) => updateLineItem(index, { unitPrice: Number(e.target.value) })}
              required
            />
            <button
              type="button"
              className="col-span-1 text-sm text-red-600 hover:text-red-700 disabled:opacity-30"
              disabled={lineItems.length === 1}
              onClick={() => setLineItems((items) => items.filter((_, i) => i !== index))}
            >
              Remove
            </button>
          </div>
        ))}
        <Button
          type="button"
          variant="secondary"
          onClick={() => setLineItems((items) => [...items, { ...EMPTY_LINE_ITEM }])}
        >
          + Add line
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          label="Discount"
          type="number"
          min={0}
          step="0.01"
          value={discountAmount}
          onChange={(e) => setDiscountAmount(e.target.value)}
        />
        <Input
          label="Tax"
          type="number"
          min={0}
          step="0.01"
          value={taxAmount}
          onChange={(e) => setTaxAmount(e.target.value)}
        />
      </div>

      <Input label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />

      <div className="rounded-md bg-slate-50 px-4 py-3 text-sm">
        <div className="flex justify-between text-slate-600">
          <span>Subtotal</span>
          <span>{subtotal.toFixed(2)}</span>
        </div>
        <div className="mt-1 flex justify-between font-semibold text-slate-900">
          <span>Total</span>
          <span>{total.toFixed(2)}</span>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={submitting || !patientId}>
          {submitting ? "Creating…" : "Create invoice"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
