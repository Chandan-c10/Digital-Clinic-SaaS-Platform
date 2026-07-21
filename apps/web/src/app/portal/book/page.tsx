import { apiFetch } from "@/lib/api";
import type { PortalClinic } from "@/lib/types";
import { BookAppointmentFlow } from "./BookAppointmentFlow";

export default async function PortalBookPage() {
  const clinics = await apiFetch<PortalClinic[]>("/patient-portal/clinics");

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">Book an appointment</h1>
      <BookAppointmentFlow clinics={clinics} />
    </div>
  );
}
