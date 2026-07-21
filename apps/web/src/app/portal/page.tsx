import { apiFetch } from "@/lib/api";
import type { PortalAppointment } from "@/lib/types";

interface Me {
  name: string | null;
  email: string | null;
}

export default async function PortalOverviewPage() {
  const [me, appointments] = await Promise.all([
    apiFetch<Me>("/patient-portal/me"),
    apiFetch<PortalAppointment[]>("/patient-portal/appointments"),
  ]);

  const upcoming = appointments
    .filter((a) => new Date(a.scheduledAt).getTime() > Date.now() && a.status !== "CANCELLED")
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Welcome, {me.name ?? "there"}</h1>
        <p className="text-sm text-slate-500">{me.email}</p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-3 text-sm font-medium text-slate-700">
          Upcoming appointments
        </div>
        <ul className="divide-y divide-slate-100">
          {upcoming.length === 0 && (
            <li className="px-5 py-6 text-sm text-slate-500">
              No upcoming appointments.{" "}
              <a href="/portal/book" className="font-medium text-brand-600 hover:underline">
                Book one
              </a>
              .
            </li>
          )}
          {upcoming.map((appt) => (
            <li key={appt.id} className="flex items-center justify-between px-5 py-3 text-sm">
              <div>
                <span className="font-medium text-slate-900">{appt.doctor.displayName}</span>
                <span className="text-slate-500"> at {appt.clinic.name}</span>
              </div>
              <span className="text-slate-500">{new Date(appt.scheduledAt).toLocaleString()}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
