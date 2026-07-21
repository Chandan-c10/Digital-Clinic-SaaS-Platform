"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import type { DoctorProfile, Patient } from "@/lib/types";

interface Props {
  doctors: DoctorProfile[];
  patients: Patient[];
}

export function BookAppointmentForm({ doctors, patients }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [doctorId, setDoctorId] = useState(doctors[0]?.id ?? "");
  const [patientId, setPatientId] = useState(patients[0]?.id ?? "");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [slots, setSlots] = useState<string[]>([]);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !doctorId || !date) return;
    setLoadingSlots(true);
    setSlotsError(null);
    setSelectedSlot("");
    fetch(`/api/appointments/available-slots?doctorId=${doctorId}&date=${date}`)
      .then((res) => {
        if (!res.ok) throw new Error("Could not load available slots");
        return res.json();
      })
      .then((data) => setSlots(Array.isArray(data) ? data : []))
      .catch(() => {
        setSlots([]);
        setSlotsError("Could not load available slots. Try a different date or reopen the form.");
      })
      .finally(() => setLoadingSlots(false));
  }, [open, doctorId, date]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!selectedSlot) {
      setError("Pick an available time slot");
      return;
    }
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ doctorId, patientId, scheduledAt: selectedSlot, type: "ONLINE" }),
    });

    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({ message: "Could not book appointment" }));
      setError(Array.isArray(body.message) ? body.message.join(", ") : body.message);
      return;
    }

    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <Button type="button" onClick={() => setOpen(true)} disabled={doctors.length === 0 || patients.length === 0}>
        + Book appointment
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 space-y-4 rounded-lg border border-slate-200 bg-white p-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="space-y-1 text-sm">
          <span className="block font-medium text-slate-700">Doctor</span>
          <select
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={doctorId}
            onChange={(e) => setDoctorId(e.target.value)}
          >
            {doctors.map((doctor) => (
              <option key={doctor.id} value={doctor.id}>
                {doctor.displayName}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-sm">
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

        <label className="space-y-1 text-sm">
          <span className="block font-medium text-slate-700">Date</span>
          <input
            type="date"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={date}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
      </div>

      <div>
        <span className="mb-2 block text-sm font-medium text-slate-700">Available slots</span>
        {loadingSlots && <p className="text-sm text-slate-500">Loading…</p>}
        {!loadingSlots && slotsError && <p className="text-sm text-red-600">{slotsError}</p>}
        {!loadingSlots && !slotsError && slots.length === 0 && (
          <p className="text-sm text-slate-500">No open slots for this day.</p>
        )}
        <div className="flex flex-wrap gap-2">
          {slots.map((slot) => (
            <button
              key={slot}
              type="button"
              onClick={() => setSelectedSlot(slot)}
              className={`rounded-md border px-3 py-1.5 text-sm ${
                selectedSlot === slot
                  ? "border-brand-600 bg-brand-50 text-brand-700"
                  : "border-slate-300 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {new Date(slot).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Booking…" : "Confirm booking"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
