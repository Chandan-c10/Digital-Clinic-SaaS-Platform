import { apiFetch } from "@/lib/api";
import type { PortalPrescription } from "@/lib/types";

export default async function PortalPrescriptionsPage() {
  const prescriptions = await apiFetch<PortalPrescription[]>("/patient-portal/prescriptions");

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">Prescriptions</h1>

      {prescriptions.length === 0 ? (
        <p className="text-sm text-slate-500">No prescriptions yet.</p>
      ) : (
        <div className="space-y-4">
          {prescriptions.map((rx) => (
            <div key={rx.id} className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900">{rx.doctor.displayName}</p>
                  <p className="text-sm text-slate-500">{rx.clinic.name}</p>
                </div>
                <span className="text-sm text-slate-500">
                  {new Date(rx.createdAt).toLocaleDateString()}
                </span>
              </div>
              <ul className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-sm">
                {rx.medicines.map((m, i) => (
                  <li key={i} className="text-slate-700">
                    {m.name} — {m.dosage}, {m.frequency}, {m.durationDays} day(s)
                    {m.instructions && (
                      <span className="text-slate-500"> ({m.instructions})</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
