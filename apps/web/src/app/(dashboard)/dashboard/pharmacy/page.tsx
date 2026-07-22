import Link from "next/link";
import { apiFetch } from "@/lib/api";
import type { Prescription } from "@/lib/types";

export default async function PharmacyPage() {
  const prescriptions = await apiFetch<Prescription[]>("/pharmacy/prescriptions/pending");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Pharmacy</h1>
        <p className="text-sm text-slate-500">Prescriptions waiting to be dispensed.</p>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-5 py-3 font-medium">Patient</th>
              <th className="px-5 py-3 font-medium">Doctor</th>
              <th className="px-5 py-3 font-medium">Medicines</th>
              <th className="px-5 py-3 font-medium">Written</th>
              <th className="px-5 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {prescriptions.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-6 text-center text-slate-500">
                  Nothing pending — every prescription has been dispensed.
                </td>
              </tr>
            )}
            {prescriptions.map((rx) => (
              <tr key={rx.id}>
                <td className="px-5 py-3 font-medium text-slate-900">{rx.patient.name}</td>
                <td className="px-5 py-3 text-slate-600">{rx.doctor.displayName}</td>
                <td className="px-5 py-3 text-slate-600">
                  {rx.medicines.map((m) => m.name).join(", ")}
                </td>
                <td className="px-5 py-3 text-slate-600">
                  {new Date(rx.createdAt).toLocaleDateString()}
                </td>
                <td className="px-5 py-3 text-right">
                  <Link
                    href={`/dashboard/pharmacy/${rx.id}`}
                    className="text-brand-700 hover:underline"
                  >
                    Dispense
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
