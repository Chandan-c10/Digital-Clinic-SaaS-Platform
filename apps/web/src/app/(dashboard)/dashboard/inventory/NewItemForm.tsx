"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export function NewItemForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const payload = {
      name: formData.get("name"),
      unit: formData.get("unit"),
      category: formData.get("category") || undefined,
      sku: formData.get("sku") || undefined,
      reorderLevel: formData.get("reorderLevel") ? Number(formData.get("reorderLevel")) : undefined,
    };

    const res = await fetch("/api/inventory/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({ message: "Could not create item" }));
      setError(Array.isArray(body.message) ? body.message.join(", ") : body.message);
      return;
    }

    setOpen(false);
    event.currentTarget.reset();
    router.refresh();
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} type="button">
        + New item
      </Button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-6 grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-5 sm:grid-cols-2"
    >
      <Input label="Item name" name="name" required placeholder="Paracetamol 500mg" />
      <Input label="Unit" name="unit" required placeholder="tablet, box, ml" />
      <Input label="Category (optional)" name="category" placeholder="Medicine" />
      <Input label="SKU (optional)" name="sku" />
      <Input label="Reorder level" name="reorderLevel" type="number" min={0} defaultValue={0} />
      {error && <p className="col-span-full text-sm text-red-600">{error}</p>}
      <div className="col-span-full flex gap-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : "Save item"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
