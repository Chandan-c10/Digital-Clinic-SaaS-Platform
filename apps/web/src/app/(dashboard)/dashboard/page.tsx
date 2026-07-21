import { apiFetch } from "@/lib/api";
import type { Appointment, Patient } from "@/lib/types";

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

export default async function DashboardOverviewPage() {
  const [appointments, patients] = await Promise.all([
    apiFetch<Appointment[]>("/appointments"),
    apiFetch<Patient[]>("/patients"),
  ]);

  const today = new Date().toDateString();
  const todaysAppointments = appointments.filter(
    (a) => new Date(a.scheduledAt).toDateString() === today,
  );
  const upcoming = appointments
    .filter((a) => new Date(a.scheduledAt).getTime() > Date.now() && a.status !== "CANCELLED")
    .slice(0, 8);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">Overview</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Today's appointments" value={todaysAppointments.length} />
        <StatCard label="Total patients" value={patients.length} />
        <StatCard label="Upcoming appointments" value={upcoming.length} />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-3 text-sm font-medium text-slate-700">
          Upcoming appointments
        </div>
        <ul className="divide-y divide-slate-100">
          {upcoming.length === 0 && (
            <li className="px-5 py-6 text-sm text-slate-500">No upcoming appointments.</li>
          )}
          {upcoming.map((appt) => (
            <li key={appt.id} className="flex items-center justify-between px-5 py-3 text-sm">
              <div>
                <span className="font-medium text-slate-900">{appt.patient.name}</span>
                <span className="text-slate-500"> with {appt.doctor.displayName}</span>
              </div>
              <span className="text-slate-500">
                {new Date(appt.scheduledAt).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
