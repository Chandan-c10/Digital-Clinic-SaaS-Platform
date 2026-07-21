import { notFound } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api";
import type { Prescription } from "@/lib/types";

export default async function PrescriptionDetailPage({ params }: { params: { id: string } }) {
  let prescription: Prescription;
  try {
    prescription = await apiFetch<Prescription>(`/prescriptions/${params.id}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{prescription.patient.name}</h1>
          <p className="text-sm text-slate-500">
            {prescription.doctor.displayName} ·{" "}
            {new Date(prescription.createdAt).toLocaleDateString()}
          </p>
        </div>
        <a
          href={`/api/prescriptions/${prescription.id}/pdf`}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Download PDF
        </a>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-medium text-slate-700">Medicines</h2>
        <ul className="divide-y divide-slate-100">
          {prescription.medicines.map((medicine, index) => (
            <li key={index} className="py-3 text-sm">
              <div className="font-medium text-slate-900">
                {medicine.name} — {medicine.dosage}
              </div>
              <div className="text-slate-600">
                {medicine.frequency} · {medicine.durationDays} day(s)
              </div>
              {medicine.instructions && (
                <div className="mt-1 text-slate-500">{medicine.instructions}</div>
              )}
            </li>
          ))}
        </ul>

        {prescription.notes && (
          <div className="mt-4 border-t border-slate-100 pt-4 text-sm">
            <h3 className="mb-1 font-medium text-slate-700">Notes</h3>
            <p className="text-slate-600">{prescription.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
