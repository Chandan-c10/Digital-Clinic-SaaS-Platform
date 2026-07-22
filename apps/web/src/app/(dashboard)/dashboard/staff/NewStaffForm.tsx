"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

const ROLE_OPTIONS = [
  { value: "RECEPTIONIST", label: "Receptionist" },
  { value: "NURSE", label: "Nurse" },
  { value: "ACCOUNTANT", label: "Accountant" },
];

export function NewStaffForm() {
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
      email: formData.get("email"),
      password: formData.get("password"),
      phone: formData.get("phone") || undefined,
      role: formData.get("role"),
    };

    const res = await fetch("/api/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({ message: "Could not create staff member" }));
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
        + New staff member
      </Button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-6 grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-5 sm:grid-cols-2"
    >
      <Input label="Full name" name="name" required />
      <Input label="Email" name="email" type="email" required />
      <Input label="Temporary password" name="password" type="password" minLength={8} required />
      <Input label="Phone" name="phone" />
      <div className="space-y-1">
        <label htmlFor="role" className="block text-sm font-medium text-slate-700">
          Role
        </label>
        <select
          id="role"
          name="role"
          required
          defaultValue=""
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          <option value="" disabled>
            Select a role
          </option>
          {ROLE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      {error && (
        <p role="alert" className="col-span-full text-sm text-red-600">
          {error}
        </p>
      )}
      <div className="col-span-full flex gap-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : "Save staff member"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
