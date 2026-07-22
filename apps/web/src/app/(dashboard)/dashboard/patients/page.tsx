import { apiFetchPaginated } from "@/lib/api";
import type { Patient } from "@/lib/types";
import { Pager } from "@/components/ui/Pager";
import { NewPatientForm } from "./NewPatientForm";
import { PatientRestoreButton } from "./PatientRestoreButton";

const PAGE_SIZE = 25;

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: { search?: string; includeInactive?: string; page?: string };
}) {
  const search = searchParams.search || undefined;
  const includeInactive = searchParams.includeInactive === "true";
  const page = Math.max(1, Number(searchParams.page) || 1);

  const query = new URLSearchParams();
  if (search) query.set("search", search);
  if (includeInactive) query.set("includeInactive", "true");
  query.set("page", String(page));
  query.set("pageSize", String(PAGE_SIZE));

  const { data: patients, total } = await apiFetchPaginated<Patient>(`/patients?${query.toString()}`);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Patients</h1>
          <p className="text-sm text-slate-500">{total} total</p>
        </div>
        <NewPatientForm />
      </div>

      <form className="flex flex-wrap items-center gap-3 text-sm">
        <input
          type="search"
          name="search"
          defaultValue={search}
          placeholder="Search name, phone, email…"
          aria-label="Search patients"
          className="w-64 rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <label className="flex items-center gap-2 text-slate-600">
          <input type="checkbox" name="includeInactive" value="true" defaultChecked={includeInactive} />
          Show deleted patients
        </label>
        <button
          type="submit"
          className="rounded-md border border-slate-300 px-3 py-2 font-medium text-slate-700 hover:bg-slate-50"
        >
          Apply
        </button>
      </form>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-5 py-3 font-medium">Name</th>
              <th className="px-5 py-3 font-medium">Phone</th>
              <th className="px-5 py-3 font-medium">Email</th>
              <th className="px-5 py-3 font-medium">Added</th>
              <th className="px-5 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {patients.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-6 text-center text-slate-500">
                  No patients yet.
                </td>
              </tr>
            )}
            {patients.map((patient) => (
              <tr key={patient.id}>
                <td className="px-5 py-3 font-medium text-slate-900">
                  {patient.name}
                  {!patient.isActive && (
                    <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                      Deleted
                    </span>
                  )}
                </td>
                <td className="px-5 py-3 text-slate-600">{patient.phone ?? "—"}</td>
                <td className="px-5 py-3 text-slate-600">{patient.email ?? "—"}</td>
                <td className="px-5 py-3 text-slate-600">
                  {new Date(patient.createdAt).toLocaleDateString()}
                </td>
                <td className="px-5 py-3 text-right">
                  {!patient.isActive && <PatientRestoreButton id={patient.id} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pager page={page} totalPages={totalPages} basePath="/dashboard/patients" searchParams={searchParams} />
    </div>
  );
}
