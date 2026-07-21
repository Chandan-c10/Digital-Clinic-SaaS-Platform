import { apiFetch } from "@/lib/api";
import type { PortalAppointment } from "@/lib/types";

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-700",
  CONFIRMED: "bg-emerald-50 text-emerald-700",
  CANCELLED: "bg-red-50 text-red-700",
  COMPLETED: "bg-slate-100 text-slate-600",
  NO_SHOW: "bg-red-50 text-red-700",
};

export default async function PortalAppointmentsPage() {
  const appointments = await apiFetch<PortalAppointment[]>("/patient-portal/appointments");

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">Appointments</h1>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-5 py-3 font-medium">Clinic</th>
              <th className="px-5 py-3 font-medium">Doctor</th>
              <th className="px-5 py-3 font-medium">When</th>
              <th className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {appointments.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-6 text-center text-slate-500">
                  No appointments yet.
                </td>
              </tr>
            )}
            {appointments.map((appt) => (
              <tr key={appt.id}>
                <td className="px-5 py-3 font-medium text-slate-900">{appt.clinic.name}</td>
                <td className="px-5 py-3 text-slate-600">{appt.doctor.displayName}</td>
                <td className="px-5 py-3 text-slate-600">
                  {new Date(appt.scheduledAt).toLocaleString()}
                </td>
                <td className="px-5 py-3">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_STYLES[appt.status]}`}
                  >
                    {appt.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
