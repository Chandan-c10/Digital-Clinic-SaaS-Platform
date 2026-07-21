export interface Patient {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  gender?: string | null;
  createdAt: string;
}

export interface DoctorProfile {
  id: string;
  displayName: string;
  specialization?: string | null;
}

export type AppointmentStatus = "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED" | "NO_SHOW";
export type AppointmentType = "ONLINE" | "WALK_IN";

export interface Appointment {
  id: string;
  scheduledAt: string;
  status: AppointmentStatus;
  type: AppointmentType;
  tokenNumber?: number | null;
  reasonForVisit?: string | null;
  patient: Patient;
  doctor: DoctorProfile;
}
