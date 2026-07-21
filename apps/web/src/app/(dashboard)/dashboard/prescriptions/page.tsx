import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { getSession } from "@/lib/session";
import type { Patient, Prescription } from "@/lib/types";
import { NewPrescriptionForm } from "./NewPrescriptionForm";

export default async function PrescriptionsPage() {
  const session = getSession();
  const [prescriptions, patients] = await Promise.all([
    apiFetch<Prescription[]>("/prescriptions"),
    apiFetch<Patient[]>("/patients"),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Prescriptions</h1>
        {session?.role === "DOCTOR" && <NewPrescriptionForm patients={patients} />}
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-5 py-3 font-medium">Patient</th>
              <th className="px-5 py-3 font-medium">Doctor</th>
              <th className="px-5 py-3 font-medium">Medicines</th>
              <th className="px-5 py-3 font-medium">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {prescriptions.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-6 text-center text-slate-500">
                  No prescriptions yet.
                </td>
              </tr>
            )}
            {prescriptions.map((rx) => (
              <tr key={rx.id}>
                <td className="px-5 py-3 font-medium">
                  <Link
                    href={`/dashboard/prescriptions/${rx.id}`}
                    className="text-brand-700 hover:underline"
                  >
                    {rx.patient.name}
                  </Link>
                </td>
                <td className="px-5 py-3 text-slate-600">{rx.doctor.displayName}</td>
                <td className="px-5 py-3 text-slate-600">
                  {rx.medicines.map((m) => m.name).join(", ")}
                </td>
                <td className="px-5 py-3 text-slate-600">
                  {new Date(rx.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
