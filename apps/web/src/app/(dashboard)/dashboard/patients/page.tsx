import { apiFetch } from "@/lib/api";
import type { Patient } from "@/lib/types";
import { NewPatientForm } from "./NewPatientForm";

export default async function PatientsPage() {
  const patients = await apiFetch<Patient[]>("/patients");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Patients</h1>
        <NewPatientForm />
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-5 py-3 font-medium">Name</th>
              <th className="px-5 py-3 font-medium">Phone</th>
              <th className="px-5 py-3 font-medium">Email</th>
              <th className="px-5 py-3 font-medium">Added</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {patients.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-6 text-center text-slate-500">
                  No patients yet.
                </td>
              </tr>
            )}
            {patients.map((patient) => (
              <tr key={patient.id}>
                <td className="px-5 py-3 font-medium text-slate-900">{patient.name}</td>
                <td className="px-5 py-3 text-slate-600">{patient.phone ?? "—"}</td>
                <td className="px-5 py-3 text-slate-600">{patient.email ?? "—"}</td>
                <td className="px-5 py-3 text-slate-600">
                  {new Date(patient.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
