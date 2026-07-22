"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import type { DoctorDetail } from "@/lib/types";

export function EditDoctorForm({ doctor }: { doctor: DoctorDetail }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSaved(false);

    const formData = new FormData(event.currentTarget);
    const languages = String(formData.get("languagesSpoken") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const experienceYears = formData.get("experienceYears");
    const consultationFee = formData.get("consultationFee");

    const payload = {
      displayName: formData.get("displayName"),
      qualification: formData.get("qualification") || undefined,
      specialization: formData.get("specialization") || undefined,
      registrationNumber: formData.get("registrationNumber") || undefined,
      experienceYears: experienceYears ? Number(experienceYears) : undefined,
      consultationFee: consultationFee ? Number(consultationFee) : undefined,
      bio: formData.get("bio") || undefined,
      languagesSpoken: languages,
    };

    const res = await fetch(`/api/doctors/${doctor.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({ message: "Could not save changes" }));
      setError(Array.isArray(body.message) ? body.message.join(", ") : body.message);
      return;
    }

    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Input label="Full name" name="displayName" defaultValue={doctor.displayName} required />
      <Input label="Specialization" name="specialization" defaultValue={doctor.specialization ?? ""} />
      <Input label="Qualification" name="qualification" defaultValue={doctor.qualification ?? ""} />
      <Input
        label="Registration number"
        name="registrationNumber"
        defaultValue={doctor.registrationNumber ?? ""}
      />
      <Input
        label="Experience (years)"
        name="experienceYears"
        type="number"
        min={0}
        defaultValue={doctor.experienceYears ?? ""}
      />
      <Input
        label="Consultation fee"
        name="consultationFee"
        type="number"
        min={0}
        step="0.01"
        defaultValue={doctor.consultationFee ?? ""}
      />
      <Input
        label="Languages spoken"
        name="languagesSpoken"
        defaultValue={doctor.languagesSpoken.join(", ")}
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
          defaultValue={doctor.bio ?? ""}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>
      {error && (
        <p role="alert" className="col-span-full text-sm text-red-600">
          {error}
        </p>
      )}
      <div className="col-span-full flex items-center gap-3">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : "Save profile"}
        </Button>
        {saved && !submitting && (
          <span role="status" className="text-sm text-emerald-600">
            Saved.
          </span>
        )}
      </div>
    </form>
  );
}
