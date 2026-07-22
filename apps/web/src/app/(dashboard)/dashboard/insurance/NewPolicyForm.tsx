"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import type { InsuranceProvider, Patient } from "@/lib/types";

export function NewPolicyForm({ patients, providers }: { patients: Patient[]; providers: InsuranceProvider[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const formData = new FormData(event.currentTarget);
    const res = await fetch("/api/insurance/policies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientId: formData.get("patientId"),
        providerId: formData.get("providerId"),
        policyNumber: formData.get("policyNumber"),
        memberName: formData.get("memberName") || undefined,
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({ message: "Could not add policy" }));
      setError(Array.isArray(body.message) ? body.message.join(", ") : body.message);
      return;
    }
    setOpen(false);
    event.currentTarget.reset();
    router.refresh();
  }

  if (providers.length === 0) {
    return <p className="text-sm text-slate-500">Add an insurance provider first.</p>;
  }

  if (!open) {
    return (
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        + New policy
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-5 sm:grid-cols-2">
      <label className="space-y-1 text-sm">
        <span className="block font-medium text-slate-700">Patient</span>
        <select name="patientId" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" required>
          {patients.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </label>
      <label className="space-y-1 text-sm">
        <span className="block font-medium text-slate-700">Provider</span>
        <select name="providerId" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" required>
          {providers.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </label>
      <Input label="Policy number" name="policyNumber" required />
      <Input label="Member name (optional)" name="memberName" />
      {error && (
        <p role="alert" className="col-span-full text-sm text-red-600">
          {error}
        </p>
      )}
      <div className="col-span-full flex gap-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : "Save policy"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
