import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { BarChart } from "@/components/ui/BarChart";

interface DoctorPerformance {
  doctorId: string;
  doctorName: string;
  totalAppointments: number;
  appointmentsByStatus: Record<string, number>;
  revenue: number;
}

interface PopularService {
  description: string;
  count: number;
  revenue: number;
}

interface GrowthPoint {
  date: string;
  count: number;
}

interface Retention {
  totalPatients: number;
  returningPatients: number;
  newPatients: number;
  retentionRate: number;
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

export default async function AdvancedAnalyticsPage() {
  const [doctors, services, growth, retention] = await Promise.all([
    apiFetch<DoctorPerformance[]>("/reports/doctor-performance"),
    apiFetch<PopularService[]>("/reports/popular-services"),
    apiFetch<GrowthPoint[]>("/reports/patient-growth"),
    apiFetch<Retention>("/reports/patient-retention"),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/reports" className="text-sm text-slate-500 hover:underline">
          ← Reports
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">Advanced analytics</h1>
        <p className="text-sm text-slate-500">Trailing 30 days, same range as Reports.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Patients seen" value={retention.totalPatients} />
        <StatCard label="Returning patients" value={retention.returningPatients} />
        <StatCard label="Retention rate" value={`${Math.round(retention.retentionRate * 100)}%`} />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-medium text-slate-700">New patients per day</h2>
        <BarChart
          points={growth.map((g) => ({ date: g.date, value: g.count }))}
          ariaLabel="New patients per day bar chart"
          formatValue={(v) => String(Math.round(v))}
          emptyMessage="No new patients in this period."
        />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-3 text-sm font-medium text-slate-700">
          Doctor performance
        </div>
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-5 py-3 font-medium">Doctor</th>
              <th className="px-5 py-3 font-medium">Appointments</th>
              <th className="px-5 py-3 font-medium">Completed</th>
              <th className="px-5 py-3 font-medium">No-shows</th>
              <th className="px-5 py-3 font-medium">Revenue</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {doctors.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-6 text-center text-slate-500">No doctors yet.</td>
              </tr>
            )}
            {doctors.map((d) => (
              <tr key={d.doctorId}>
                <td className="px-5 py-3 font-medium text-slate-900">{d.doctorName}</td>
                <td className="px-5 py-3 text-slate-600">{d.totalAppointments}</td>
                <td className="px-5 py-3 text-slate-600">{d.appointmentsByStatus.COMPLETED ?? 0}</td>
                <td className="px-5 py-3 text-slate-600">{d.appointmentsByStatus.NO_SHOW ?? 0}</td>
                <td className="px-5 py-3 text-slate-600">{d.revenue.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-3 text-sm font-medium text-slate-700">
          Popular services
        </div>
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-5 py-3 font-medium">Service</th>
              <th className="px-5 py-3 font-medium">Times billed</th>
              <th className="px-5 py-3 font-medium">Revenue</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {services.length === 0 && (
              <tr>
                <td colSpan={3} className="px-5 py-6 text-center text-slate-500">No invoiced services yet.</td>
              </tr>
            )}
            {services.map((s) => (
              <tr key={s.description}>
                <td className="px-5 py-3 font-medium text-slate-900">{s.description}</td>
                <td className="px-5 py-3 text-slate-600">{s.count}</td>
                <td className="px-5 py-3 text-slate-600">{s.revenue.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
