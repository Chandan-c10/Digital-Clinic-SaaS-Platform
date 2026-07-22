import { notFound } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api";
import type { InventoryItem, PharmacyPrescription } from "@/lib/types";
import { DispenseForm } from "./DispenseForm";

export default async function PharmacyPrescriptionPage({ params }: { params: { id: string } }) {
  let prescription: PharmacyPrescription;
  try {
    prescription = await apiFetch<PharmacyPrescription>(`/pharmacy/prescriptions/${params.id}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  const items = await apiFetch<InventoryItem[]>("/inventory/items");

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{prescription.patient.name}</h1>
        <p className="text-sm text-slate-500">Prescribed by {prescription.doctor.displayName}</p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-medium text-slate-700">Prescribed medicines</h2>
        <ul className="space-y-2 text-sm">
          {prescription.medicines.map((m, i) => (
            <li key={i} className="rounded-md bg-slate-50 px-3 py-2">
              <span className="font-medium text-slate-900">{m.name}</span>
              <span className="text-slate-600">
                {" "}
                — {m.dosage}, {m.frequency}, {m.durationDays} days
              </span>
              {m.instructions && <p className="text-slate-500">{m.instructions}</p>}
            </li>
          ))}
        </ul>
      </div>

      {prescription.dispensedAt ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800">
          Dispensed on {new Date(prescription.dispensedAt).toLocaleString()}.
        </div>
      ) : (
        <DispenseForm prescriptionId={prescription.id} items={items} />
      )}

      {prescription.dispenses && prescription.dispenses.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-5 py-3 text-sm font-medium text-slate-700">
            Dispense history
          </div>
          <ul className="divide-y divide-slate-100">
            {prescription.dispenses.map((d) => (
              <li key={d.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <span>
                  {Math.abs(d.quantity)} {d.item.unit} of {d.item.name}
                </span>
                <span className="text-slate-500">{new Date(d.createdAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
