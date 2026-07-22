"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { PortalClinic, PortalDoctor } from "@/lib/types";

export function BookAppointmentFlow({ clinics }: { clinics: PortalClinic[] }) {
  const router = useRouter();
  const [clinicId, setClinicId] = useState(clinics[0]?.id ?? "");
  const [doctors, setDoctors] = useState<PortalDoctor[]>([]);
  const [doctorId, setDoctorId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [slots, setSlots] = useState<string[]>([]);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [reasonForVisit, setReasonForVisit] = useState("");
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!clinicId) return;
    setLoadingDoctors(true);
    setDoctorId("");
    fetch(`/api/patient-portal/clinics/${clinicId}/doctors`)
      .then((res) => res.json())
      .then((data) => {
        setDoctors(Array.isArray(data) ? data : []);
        setDoctorId(Array.isArray(data) && data.length > 0 ? data[0].id : "");
      })
      .finally(() => setLoadingDoctors(false));
  }, [clinicId]);

  useEffect(() => {
    if (!clinicId || !doctorId || !date) return;
    setLoadingSlots(true);
    setSlotsError(null);
    setSelectedSlot("");
    fetch(`/api/patient-portal/available-slots?clinicId=${clinicId}&doctorId=${doctorId}&date=${date}`)
      .then((res) => {
        if (!res.ok) throw new Error("Could not load available slots");
        return res.json();
      })
      .then((data) => setSlots(Array.isArray(data) ? data : []))
      .catch(() => {
        setSlots([]);
        setSlotsError("Could not load available slots. Try a different date.");
      })
      .finally(() => setLoadingSlots(false));
  }, [clinicId, doctorId, date]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!selectedSlot) {
      setError("Pick an available time slot");
      return;
    }
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/patient-portal/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clinicId,
        doctorId,
        scheduledAt: selectedSlot,
        reasonForVisit: reasonForVisit || undefined,
      }),
    });

    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({ message: "Could not book appointment" }));
      setError(Array.isArray(body.message) ? body.message.join(", ") : body.message);
      return;
    }

    setSuccess(true);
    router.refresh();
  }

  if (clinics.length === 0) {
    return <p className="text-sm text-slate-500">No clinics are open for online booking right now.</p>;
  }

  if (success) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800">
        Appointment booked. See it under{" "}
        <a href="/portal/appointments" className="font-medium underline">
          Appointments
        </a>
        .
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
      <label className="block space-y-1 text-sm">
        <span className="block font-medium text-slate-700">Clinic</span>
        <select
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          value={clinicId}
          onChange={(e) => setClinicId(e.target.value)}
        >
          {clinics.map((clinic) => (
            <option key={clinic.id} value={clinic.id}>
              {clinic.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1 text-sm">
        <span className="block font-medium text-slate-700">Doctor</span>
        <select
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          value={doctorId}
          onChange={(e) => setDoctorId(e.target.value)}
          disabled={loadingDoctors || doctors.length === 0}
        >
          {doctors.length === 0 && <option value="">No doctors at this clinic</option>}
          {doctors.map((doctor) => (
            <option key={doctor.id} value={doctor.id}>
              {doctor.displayName}
              {doctor.specialization ? ` — ${doctor.specialization}` : ""}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1 text-sm">
        <span className="block font-medium text-slate-700">Date</span>
        <input
          type="date"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          value={date}
          min={new Date().toISOString().slice(0, 10)}
          onChange={(e) => setDate(e.target.value)}
        />
      </label>

      <div>
        <span className="mb-2 block text-sm font-medium text-slate-700">Available slots</span>
        {loadingSlots && <p className="text-sm text-slate-500">Loading…</p>}
        {!loadingSlots && slotsError && (
          <p role="alert" className="text-sm text-red-600">
            {slotsError}
          </p>
        )}
        {!loadingSlots && !slotsError && slots.length === 0 && (
          <p className="text-sm text-slate-500">No open slots for this day.</p>
        )}
        <div className="flex flex-wrap gap-2">
          {slots.map((slot) => (
            <button
              key={slot}
              type="button"
              aria-pressed={selectedSlot === slot}
              onClick={() => setSelectedSlot(slot)}
              className={`rounded-md border px-3 py-1.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
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

      <Input
        label="Reason for visit (optional)"
        value={reasonForVisit}
        onChange={(e) => setReasonForVisit(e.target.value)}
      />

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <Button type="submit" disabled={submitting || !selectedSlot}>
        {submitting ? "Booking…" : "Confirm booking"}
      </Button>
    </form>
  );
}
