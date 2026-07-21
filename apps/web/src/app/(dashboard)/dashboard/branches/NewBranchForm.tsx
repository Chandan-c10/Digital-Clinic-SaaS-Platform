"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export function NewBranchForm() {
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
      addressLine1: formData.get("addressLine1") || undefined,
      city: formData.get("city") || undefined,
      state: formData.get("state") || undefined,
      phone: formData.get("phone") || undefined,
    };

    const res = await fetch("/api/branches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({ message: "Could not create branch" }));
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
        + New branch
      </Button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-6 grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-5 sm:grid-cols-2"
    >
      <Input label="Branch name" name="name" required placeholder="Downtown" />
      <Input label="Phone" name="phone" />
      <Input label="Address" name="addressLine1" />
      <Input label="City" name="city" />
      <Input label="State" name="state" />
      {error && <p className="col-span-full text-sm text-red-600">{error}</p>}
      <div className="col-span-full flex gap-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : "Save branch"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
