import Link from "next/link";
import { apiFetch } from "@/lib/api";
import type { Branch } from "@/lib/types";
import { BarChart } from "@/components/ui/BarChart";

interface Overview {
  range: { from: string; to: string };
  totalRevenue: number;
  totalInvoiced: number;
  outstandingAmount: number;
  totalAppointments: number;
  appointmentsByStatus: Record<string, number>;
  newPatients: number;
}

interface RevenuePoint {
  date: string;
  amount: number;
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

/**
 * Plain GET form, no client JS — works whether or not branches exist. Only
 * rendered at all when the clinic has at least one Branch (single-branch
 * clinics have nothing to filter by).
 */
function BranchFilter({ branches, selected }: { branches: Branch[]; selected?: string }) {
  return (
    <form className="flex items-center gap-2 text-sm">
      <label htmlFor="branchId" className="text-slate-600">
        Branch
      </label>
      <select
        id="branchId"
        name="branchId"
        defaultValue={selected ?? ""}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
      >
        <option value="">All branches</option>
        {branches.map((branch) => (
          <option key={branch.id} value={branch.id}>
            {branch.name}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        Apply
      </button>
    </form>
  );
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: { branchId?: string };
}) {
  const branchId = searchParams.branchId || undefined;
  const query = branchId ? `?branchId=${encodeURIComponent(branchId)}` : "";

  const [overview, revenue, branches] = await Promise.all([
    apiFetch<Overview>(`/reports/overview${query}`),
    apiFetch<RevenuePoint[]>(`/reports/revenue${query}`),
    apiFetch<Branch[]>("/branches"),
  ]);

  const statusEntries = Object.entries(overview.appointmentsByStatus);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Reports</h1>
          <p className="text-sm text-slate-500">
            {new Date(overview.range.from).toLocaleDateString()} –{" "}
            {new Date(overview.range.to).toLocaleDateString()}
          </p>
        </div>
        {branches.length > 0 && <BranchFilter branches={branches} selected={branchId} />}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Revenue collected" value={overview.totalRevenue.toFixed(2)} />
        <StatCard label="Outstanding" value={overview.outstandingAmount.toFixed(2)} />
        <StatCard label="Appointments" value={overview.totalAppointments} />
        <StatCard label="New patients" value={overview.newPatients} />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-medium text-slate-700">Daily revenue</h2>
        <BarChart
          points={revenue.map((r) => ({ date: r.date, value: r.amount }))}
          ariaLabel="Daily revenue bar chart"
          emptyMessage="No payments recorded in this period."
        />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-medium text-slate-700">Appointments by status</h2>
        {statusEntries.length === 0 ? (
          <p className="text-sm text-slate-500">No appointments in this period.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
            {statusEntries.map(([status, count]) => (
              <li key={status} className="rounded-md bg-slate-50 px-3 py-2">
                <div className="text-slate-500">{status.replace("_", " ")}</div>
                <div className="font-semibold text-slate-900">{count}</div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Link href="/dashboard/reports/advanced" className="text-sm font-medium text-brand-700 hover:underline">
        View advanced analytics →
      </Link>
    </div>
  );
}
