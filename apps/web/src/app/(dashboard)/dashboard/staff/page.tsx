import { apiFetch } from "@/lib/api";
import type { Staff } from "@/lib/types";
import { NewStaffForm } from "./NewStaffForm";
import { StaffStatusToggle } from "./StaffStatusToggle";

const ROLE_LABELS: Record<Staff["role"], string> = {
  RECEPTIONIST: "Receptionist",
  NURSE: "Nurse",
  ACCOUNTANT: "Accountant",
};

export default async function StaffPage() {
  const staff = await apiFetch<Staff[]>("/staff");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Staff</h1>
        <NewStaffForm />
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-5 py-3 font-medium">Name</th>
              <th className="px-5 py-3 font-medium">Role</th>
              <th className="px-5 py-3 font-medium">Email</th>
              <th className="px-5 py-3 font-medium">Phone</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {staff.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-6 text-center text-slate-500">
                  No staff members yet.
                </td>
              </tr>
            )}
            {staff.map((member) => (
              <tr key={member.id}>
                <td className="px-5 py-3 font-medium text-slate-900">{member.name}</td>
                <td className="px-5 py-3 text-slate-600">{ROLE_LABELS[member.role]}</td>
                <td className="px-5 py-3 text-slate-600">{member.email}</td>
                <td className="px-5 py-3 text-slate-600">{member.phone ?? "—"}</td>
                <td className="px-5 py-3">
                  <span
                    className={
                      member.isActive
                        ? "rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700"
                        : "rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500"
                    }
                  >
                    {member.isActive ? "Active" : "Deactivated"}
                  </span>
                </td>
                <td className="px-5 py-3 text-right">
                  <StaffStatusToggle id={member.id} name={member.name} isActive={member.isActive} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
