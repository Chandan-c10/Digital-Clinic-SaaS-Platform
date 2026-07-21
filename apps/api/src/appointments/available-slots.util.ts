export interface AvailabilityWindow {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotDurationMinutes: number;
  isActive: boolean;
  branchId?: string | null;
}

/**
 * Pure slot computation, shared by staff booking (AppointmentsService) and
 * patient-initiated booking (PatientPortalService) — both need the same
 * "given a doctor's weekly availability and what's already booked, which
 * times are open on this date" logic, just fetched with different
 * clinic-scoping around it.
 */
export function computeAvailableSlots(
  date: Date,
  availabilities: AvailabilityWindow[],
  bookedTimes: Set<string>,
): string[] {
  const dayOfWeek = date.getDay();
  const dayAvailabilities = availabilities.filter(
    (slot) => slot.dayOfWeek === dayOfWeek && slot.isActive,
  );

  const slots: string[] = [];
  for (const availability of dayAvailabilities) {
    const [startHour, startMinute] = availability.startTime.split(":").map(Number);
    const [endHour, endMinute] = availability.endTime.split(":").map(Number);

    const cursor = new Date(date);
    cursor.setHours(startHour, startMinute, 0, 0);
    const end = new Date(date);
    end.setHours(endHour, endMinute, 0, 0);

    while (cursor < end) {
      if (!bookedTimes.has(cursor.toISOString()) && cursor.getTime() > Date.now()) {
        slots.push(cursor.toISOString());
      }
      cursor.setMinutes(cursor.getMinutes() + availability.slotDurationMinutes);
    }
  }
  return slots.sort();
}

/**
 * Which branch a given scheduled time belongs to, by finding the
 * availability window that contains it — used to stamp Appointment.branchId
 * (and, transitively, Invoice/Prescription.branchId) at booking time rather
 * than requiring the caller to specify it separately. Time strings are
 * compared lexicographically (works because they're always zero-padded
 * "HH:MM", same convention as everywhere else this format is used). Returns
 * null for single-branch clinics (no availability row has a branchId) or if
 * no matching window is found (shouldn't happen if the slot came from
 * computeAvailableSlots, but this is defensive, not load-bearing).
 */
export function resolveBranchForTime(
  scheduledAt: Date,
  availabilities: AvailabilityWindow[],
): string | null {
  const dayOfWeek = scheduledAt.getDay();
  const timeOfDay = `${String(scheduledAt.getHours()).padStart(2, "0")}:${String(
    scheduledAt.getMinutes(),
  ).padStart(2, "0")}`;

  const match = availabilities.find(
    (a) => a.dayOfWeek === dayOfWeek && a.startTime <= timeOfDay && timeOfDay < a.endTime,
  );
  return match?.branchId ?? null;
}
