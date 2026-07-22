import Link from "next/link";
import { apiFetch } from "@/lib/api";
import type { DoctorDetail } from "@/lib/types";
import { NewDoctorForm } from "./NewDoctorForm";

export default async function DoctorsPage() {
  const doctors = await apiFetch<DoctorDetail[]>("/doctors");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Doctors</h1>
          <p className="text-sm text-slate-500">
            Manage doctor profiles and each doctor&rsquo;s weekly availability.
          </p>
        </div>
        <NewDoctorForm />
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-5 py-3 font-medium">Name</th>
              <th className="px-5 py-3 font-medium">Specialization</th>
              <th className="px-5 py-3 font-medium">Experience</th>
              <th className="px-5 py-3 font-medium">Availability</th>
              <th className="px-5 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {doctors.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-6 text-center text-slate-500">
                  No doctors yet.
                </td>
              </tr>
            )}
            {doctors.map((doctor) => (
              <tr key={doctor.id}>
                <td className="px-5 py-3 font-medium text-slate-900">{doctor.displayName}</td>
                <td className="px-5 py-3 text-slate-600">{doctor.specialization ?? "—"}</td>
                <td className="px-5 py-3 text-slate-600">
                  {doctor.experienceYears != null ? `${doctor.experienceYears} yrs` : "—"}
                </td>
                <td className="px-5 py-3 text-slate-600">
                  {doctor.availabilities.length === 0 ? (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                      Not set
                    </span>
                  ) : (
                    `${doctor.availabilities.length} slot${doctor.availabilities.length === 1 ? "" : "s"}/week`
                  )}
                </td>
                <td className="px-5 py-3 text-right">
                  <Link
                    href={`/dashboard/doctors/${doctor.id}`}
                    className="text-sm font-medium text-brand-600 hover:text-brand-700"
                  >
                    Manage
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
