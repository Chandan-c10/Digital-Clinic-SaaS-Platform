"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import type { InventoryItem } from "@/lib/types";

interface Line {
  inventoryItemId: string;
  quantity: number;
}

export function DispenseForm({
  prescriptionId,
  items,
}: {
  prescriptionId: string;
  items: InventoryItem[];
}) {
  const router = useRouter();
  const [lines, setLines] = useState<Line[]>([
    { inventoryItemId: items[0]?.id ?? "", quantity: 1 },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateLine(index: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch(`/api/pharmacy/prescriptions/${prescriptionId}/dispense`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: lines }),
    });

    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({ message: "Could not dispense" }));
      setError(Array.isArray(body.message) ? body.message.join(", ") : body.message);
      return;
    }

    router.refresh();
  }

  if (items.length === 0) {
    return <p className="text-sm text-slate-500">No inventory items exist yet to dispense against.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-slate-200 bg-white p-5">
      <span className="block text-sm font-medium text-slate-700">Dispense against inventory</span>
      {lines.map((line, index) => {
        const item = items.find((i) => i.id === line.inventoryItemId);
        return (
          <div key={index} className="grid grid-cols-12 gap-2">
            <select
              aria-label={`Line ${index + 1} inventory item`}
              className="col-span-7 rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={line.inventoryItemId}
              onChange={(e) => updateLine(index, { inventoryItemId: e.target.value })}
            >
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} ({i.currentStock} {i.unit} in stock)
                </option>
              ))}
            </select>
            <input
              aria-label={`Line ${index + 1} quantity`}
              type="number"
              min={1}
              className="col-span-3 rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={line.quantity}
              onChange={(e) => updateLine(index, { quantity: Number(e.target.value) })}
              required
            />
            <span className="col-span-2 self-center text-sm text-slate-500">{item?.unit}</span>
          </div>
        );
      })}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => setLines((ls) => [...ls, { inventoryItemId: items[0]?.id ?? "", quantity: 1 }])}
        >
          + Add item
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <Button type="submit" disabled={submitting}>
        {submitting ? "Dispensing…" : "Confirm dispense"}
      </Button>
    </form>
  );
}
