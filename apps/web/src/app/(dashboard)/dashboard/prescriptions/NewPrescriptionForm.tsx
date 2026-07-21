"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import type { Patient } from "@/lib/types";

interface MedicineRow {
  name: string;
  dosage: string;
  frequency: string;
  durationDays: number;
  instructions: string;
}

const EMPTY_MEDICINE: MedicineRow = { name: "", dosage: "", frequency: "", durationDays: 5, instructions: "" };

export function NewPrescriptionForm({ patients }: { patients: Patient[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [patientId, setPatientId] = useState(patients[0]?.id ?? "");
  const [medicines, setMedicines] = useState<MedicineRow[]>([{ ...EMPTY_MEDICINE }]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateMedicine(index: number, patch: Partial<MedicineRow>) {
    setMedicines((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/prescriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientId,
        medicines: medicines.map((m) => ({
          name: m.name,
          dosage: m.dosage,
          frequency: m.frequency,
          durationDays: Number(m.durationDays),
          instructions: m.instructions || undefined,
        })),
        notes: notes || undefined,
      }),
    });

    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({ message: "Could not create prescription" }));
      setError(Array.isArray(body.message) ? body.message.join(", ") : body.message);
      return;
    }

    const prescription = await res.json();
    router.push(`/dashboard/prescriptions/${prescription.id}`);
  }

  if (!open) {
    return (
      <Button type="button" onClick={() => setOpen(true)} disabled={patients.length === 0}>
        + New prescription
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
        <span className="block text-sm font-medium text-slate-700">Medicines</span>
        {medicines.map((medicine, index) => (
          <div key={index} className="grid grid-cols-12 gap-2">
            <input
              className="col-span-3 rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="Name"
              value={medicine.name}
              onChange={(e) => updateMedicine(index, { name: e.target.value })}
              required
            />
            <input
              className="col-span-2 rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="Dosage"
              value={medicine.dosage}
              onChange={(e) => updateMedicine(index, { dosage: e.target.value })}
              required
            />
            <input
              className="col-span-2 rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="Frequency"
              value={medicine.frequency}
              onChange={(e) => updateMedicine(index, { frequency: e.target.value })}
              required
            />
            <input
              type="number"
              min={1}
              className="col-span-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="Days"
              value={medicine.durationDays}
              onChange={(e) => updateMedicine(index, { durationDays: Number(e.target.value) })}
              required
            />
            <input
              className="col-span-3 rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="Instructions (optional)"
              value={medicine.instructions}
              onChange={(e) => updateMedicine(index, { instructions: e.target.value })}
            />
            <button
              type="button"
              className="col-span-1 text-sm text-red-600 hover:text-red-700 disabled:opacity-30"
              disabled={medicines.length === 1}
              onClick={() => setMedicines((rows) => rows.filter((_, i) => i !== index))}
            >
              Remove
            </button>
          </div>
        ))}
        <Button
          type="button"
          variant="secondary"
          onClick={() => setMedicines((rows) => [...rows, { ...EMPTY_MEDICINE }])}
        >
          + Add medicine
        </Button>
      </div>

      <Input label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={submitting || !patientId}>
          {submitting ? "Saving…" : "Create prescription"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
