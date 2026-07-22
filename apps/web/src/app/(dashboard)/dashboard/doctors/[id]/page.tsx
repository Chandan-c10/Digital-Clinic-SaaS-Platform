import Link from "next/link";
import { notFound } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api";
import type { Branch, DoctorDetail } from "@/lib/types";
import { EditDoctorForm } from "./EditDoctorForm";
import { AvailabilityForm } from "./AvailabilityForm";

export default async function DoctorDetailPage({ params }: { params: { id: string } }) {
  let doctor: DoctorDetail;
  try {
    doctor = await apiFetch<DoctorDetail>(`/doctors/${params.id}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  const branches = await apiFetch<Branch[]>("/branches");

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/dashboard/doctors" className="text-sm text-slate-500 hover:underline">
          ← Doctors
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">{doctor.displayName}</h1>
        <p className="text-sm text-slate-500">{doctor.specialization ?? "General practice"}</p>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-medium text-slate-700">Profile</h2>
        <EditDoctorForm doctor={doctor} />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="mb-1 text-sm font-medium text-slate-700">Weekly availability</h2>
        <p className="mb-4 text-sm text-slate-500">
          Saving replaces the doctor&rsquo;s whole schedule with what&rsquo;s below — bookable slots
          are generated from these windows (see Appointments). Add one row per recurring block of
          time this doctor sees patients.
        </p>
        <AvailabilityForm
          doctorId={doctor.id}
          initialSlots={doctor.availabilities}
          branches={branches}
        />
      </section>
    </div>
  );
}
