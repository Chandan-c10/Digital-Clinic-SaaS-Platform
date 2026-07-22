"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export function NewDoctorForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const languages = String(formData.get("languagesSpoken") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const experienceYears = formData.get("experienceYears");
    const consultationFee = formData.get("consultationFee");

    const payload = {
      email: formData.get("email"),
      password: formData.get("password"),
      displayName: formData.get("displayName"),
      qualification: formData.get("qualification") || undefined,
      specialization: formData.get("specialization") || undefined,
      registrationNumber: formData.get("registrationNumber") || undefined,
      experienceYears: experienceYears ? Number(experienceYears) : undefined,
      consultationFee: consultationFee ? Number(consultationFee) : undefined,
      bio: formData.get("bio") || undefined,
      languagesSpoken: languages.length > 0 ? languages : undefined,
    };

    const res = await fetch("/api/doctors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({ message: "Could not create doctor" }));
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
        + New doctor
      </Button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-6 grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-5 sm:grid-cols-2"
    >
      <Input label="Full name" name="displayName" required placeholder="Dr. Jane Smith" />
      <Input label="Email" name="email" type="email" required />
      <Input label="Temporary password" name="password" type="password" minLength={8} required />
      <Input label="Specialization" name="specialization" placeholder="Cardiology" />
      <Input label="Qualification" name="qualification" placeholder="MBBS, MD" />
      <Input label="Registration number" name="registrationNumber" />
      <Input label="Experience (years)" name="experienceYears" type="number" min={0} />
      <Input label="Consultation fee" name="consultationFee" type="number" min={0} step="0.01" />
      <Input
        label="Languages spoken"
        name="languagesSpoken"
        placeholder="English, Hindi"
        className="sm:col-span-2"
      />
      <div className="space-y-1 sm:col-span-2">
        <label htmlFor="bio" className="block text-sm font-medium text-slate-700">
          Bio
        </label>
        <textarea
          id="bio"
          name="bio"
          rows={3}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>
      {error && (
        <p role="alert" className="col-span-full text-sm text-red-600">
          {error}
        </p>
      )}
      <div className="col-span-full flex gap-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : "Save doctor"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
