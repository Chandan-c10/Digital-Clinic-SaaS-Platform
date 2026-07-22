"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import type { Branch, DoctorAvailabilitySlot } from "@/lib/types";

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface SlotRow {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotDurationMinutes: number;
  branchId: string; // "" = no specific branch
}

function toRow(slot: DoctorAvailabilitySlot): SlotRow {
  return {
    dayOfWeek: slot.dayOfWeek,
    startTime: slot.startTime,
    endTime: slot.endTime,
    slotDurationMinutes: slot.slotDurationMinutes,
    branchId: slot.branchId ?? "",
  };
}

const BLANK_ROW: SlotRow = {
  dayOfWeek: 1,
  startTime: "09:00",
  endTime: "17:00",
  slotDurationMinutes: 15,
  branchId: "",
};

export function AvailabilityForm({
  doctorId,
  initialSlots,
  branches,
}: {
  doctorId: string;
  initialSlots: DoctorAvailabilitySlot[];
  branches: Branch[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState<SlotRow[]>(initialSlots.map(toRow));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function updateRow(index: number, patch: Partial<SlotRow>) {
    setSaved(false);
    setRows((rs) => rs.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function removeRow(index: number) {
    setSaved(false);
    setRows((rs) => rs.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    setSaved(false);

    const payload = {
      slots: rows.map((r) => ({
        dayOfWeek: r.dayOfWeek,
        startTime: r.startTime,
        endTime: r.endTime,
        slotDurationMinutes: r.slotDurationMinutes,
        branchId: r.branchId || undefined,
      })),
    };

    const res = await fetch(`/api/doctors/${doctorId}/availability`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({ message: "Could not save availability" }));
      setError(Array.isArray(body.message) ? body.message.join(", ") : body.message);
      return;
    }

    setSaved(true);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {rows.length === 0 && (
        <p className="text-sm text-slate-500">No availability set yet — add a time block below.</p>
      )}

      {rows.map((row, index) => (
        <div
          key={index}
          className="grid grid-cols-1 items-end gap-2 rounded-md border border-slate-200 p-3 sm:grid-cols-12"
        >
          <div className="space-y-1 sm:col-span-3">
            <label htmlFor={`day-${index}`} className="block text-xs font-medium text-slate-700">
              Day
            </label>
            <select
              id={`day-${index}`}
              value={row.dayOfWeek}
              onChange={(e) => updateRow(index, { dayOfWeek: Number(e.target.value) })}
              className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              {DAY_LABELS.map((label, day) => (
                <option key={day} value={day}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1 sm:col-span-2">
            <label htmlFor={`start-${index}`} className="block text-xs font-medium text-slate-700">
              Start
            </label>
            <input
              id={`start-${index}`}
              type="time"
              required
              value={row.startTime}
              onChange={(e) => updateRow(index, { startTime: e.target.value })}
              className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          <div className="space-y-1 sm:col-span-2">
            <label htmlFor={`end-${index}`} className="block text-xs font-medium text-slate-700">
              End
            </label>
            <input
              id={`end-${index}`}
              type="time"
              required
              value={row.endTime}
              onChange={(e) => updateRow(index, { endTime: e.target.value })}
              className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          <div className="space-y-1 sm:col-span-2">
            <label htmlFor={`duration-${index}`} className="block text-xs font-medium text-slate-700">
              Slot (min)
            </label>
            <input
              id={`duration-${index}`}
              type="number"
              min={5}
              required
              value={row.slotDurationMinutes}
              onChange={(e) => updateRow(index, { slotDurationMinutes: Number(e.target.value) })}
              className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          {branches.length > 0 && (
            <div className="space-y-1 sm:col-span-2">
              <label htmlFor={`branch-${index}`} className="block text-xs font-medium text-slate-700">
                Branch
              </label>
              <select
                id={`branch-${index}`}
                value={row.branchId}
                onChange={(e) => updateRow(index, { branchId: e.target.value })}
                className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="">Any branch</option>
                {/* A deactivated branch is no longer offered for a *new*
                    assignment, but if this row is already pointing at one
                    (set before it was deactivated), keep it in the list so
                    the dropdown shows the truth instead of silently
                    displaying a different branch than what's saved. */}
                {branches
                  .filter((branch) => branch.isActive || branch.id === row.branchId)
                  .map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                    {!branch.isActive ? " (deactivated)" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className={branches.length > 0 ? "sm:col-span-1" : "sm:col-span-3"}>
            <button
              type="button"
              onClick={() => removeRow(index)}
              aria-label={`Remove ${DAY_LABELS[row.dayOfWeek]} ${row.startTime}–${row.endTime} time block`}
              className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm font-medium text-red-600 hover:bg-red-50 focus:outline-none focus:ring-1 focus:ring-red-500"
            >
              Remove
            </button>
          </div>
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <Button type="button" variant="secondary" onClick={() => setRows((rs) => [...rs, { ...BLANK_ROW }])}>
          + Add time block
        </Button>
        <Button type="button" disabled={submitting || rows.length === 0} onClick={handleSubmit}>
          {submitting ? "Saving…" : "Save availability"}
        </Button>
        {rows.length === 0 && (
          <span className="text-sm text-slate-500">Add at least one time block to save.</span>
        )}
        {saved && !submitting && (
          <span role="status" className="text-sm text-emerald-600">
            Saved.
          </span>
        )}
      </div>
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
    </div>
  );
}
