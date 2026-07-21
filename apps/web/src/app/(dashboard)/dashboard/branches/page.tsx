import { apiFetch } from "@/lib/api";
import type { Branch } from "@/lib/types";
import { NewBranchForm } from "./NewBranchForm";
import { BranchStatusToggle } from "./BranchStatusToggle";

export default async function BranchesPage() {
  const branches = await apiFetch<Branch[]>("/branches");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Branches</h1>
          <p className="text-sm text-slate-500">
            Optional — a clinic with a single location doesn&rsquo;t need any branches. Add one per
            physical location once you have more than one; doctors then set separate availability
            per branch (via the API for now — no dedicated UI for that yet).
          </p>
        </div>
        <NewBranchForm />
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-5 py-3 font-medium">Name</th>
              <th className="px-5 py-3 font-medium">Address</th>
              <th className="px-5 py-3 font-medium">Phone</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {branches.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-6 text-center text-slate-500">
                  No branches yet — this clinic operates as a single location.
                </td>
              </tr>
            )}
            {branches.map((branch) => (
              <tr key={branch.id}>
                <td className="px-5 py-3 font-medium text-slate-900">{branch.name}</td>
                <td className="px-5 py-3 text-slate-600">
                  {[branch.addressLine1, branch.city, branch.state].filter(Boolean).join(", ") ||
                    "—"}
                </td>
                <td className="px-5 py-3 text-slate-600">{branch.phone ?? "—"}</td>
                <td className="px-5 py-3">
                  <span
                    className={
                      branch.isActive
                        ? "rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700"
                        : "rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500"
                    }
                  >
                    {branch.isActive ? "Active" : "Deactivated"}
                  </span>
                </td>
                <td className="px-5 py-3 text-right">
                  <BranchStatusToggle id={branch.id} isActive={branch.isActive} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
