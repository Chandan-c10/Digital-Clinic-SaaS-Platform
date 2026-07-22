export interface Patient {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  gender?: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface Branch {
  id: string;
  name: string;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postalCode?: string | null;
  phone?: string | null;
  isActive: boolean;
  createdAt: string;
}

export type StaffRole = "RECEPTIONIST" | "NURSE" | "ACCOUNTANT";

export interface Staff {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: StaffRole;
  isActive: boolean;
  createdAt: string;
}

export interface DoctorProfile {
  id: string;
  displayName: string;
  specialization?: string | null;
  qualification?: string | null;
}

export interface DoctorAvailabilitySlot {
  id: string;
  dayOfWeek: number; // 0 (Sun) – 6 (Sat)
  startTime: string; // "09:00"
  endTime: string;
  slotDurationMinutes: number;
  isActive: boolean;
  branchId?: string | null;
}

// Full DoctorProfile record, as returned by GET /doctors and /doctors/:id —
// DoctorProfile above stays the minimal shape other modules embed doctors
// with (Appointment.doctor, Prescription.doctor).
export interface DoctorDetail extends DoctorProfile {
  registrationNumber?: string | null;
  experienceYears?: number | null;
  consultationFee?: string | null; // Decimal -> JSON string, see the note above on Invoice
  bio?: string | null;
  languagesSpoken: string[];
  createdAt: string;
  availabilities: DoctorAvailabilitySlot[];
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

export type InvoiceStatus = "UNPAID" | "PARTIALLY_PAID" | "PAID" | "CANCELLED";
export type PaymentMethod = "CASH" | "CARD" | "UPI" | "BANK_TRANSFER" | "OTHER";

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

// Decimal fields (subtotal, discountAmount, taxAmount, totalAmount,
// amountPaid, amount) arrive as JSON strings — Prisma's Decimal serializes
// via toJSON(), not as a JS number. Parse with Number(...) before doing math
// or formatting.
export interface Payment {
  id: string;
  amount: string;
  method: PaymentMethod;
  reference?: string | null;
  paidAt: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: number;
  status: InvoiceStatus;
  lineItems: InvoiceLineItem[];
  subtotal: string;
  discountAmount: string;
  taxAmount: string;
  totalAmount: string;
  amountPaid: string;
  currency: string;
  notes?: string | null;
  createdAt: string;
  patient: Patient;
  payments?: Payment[];
}

export interface InsuranceProvider {
  id: string;
  name: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
  isActive: boolean;
}

export interface InsurancePolicy {
  id: string;
  policyNumber: string;
  memberName?: string | null;
  provider: InsuranceProvider;
  patient?: Patient;
}

export type InsuranceClaimStatus = "SUBMITTED" | "APPROVED" | "PARTIALLY_APPROVED" | "REJECTED" | "PAID";

export interface InsuranceClaim {
  id: string;
  status: InsuranceClaimStatus;
  claimedAmount: string;
  approvedAmount?: string | null;
  submittedAt: string;
  policy: InsurancePolicy;
  invoice: { id: string; invoiceNumber: number; totalAmount: string };
}

export interface Medicine {
  name: string;
  dosage: string;
  frequency: string;
  durationDays: number;
  instructions?: string;
}

export interface Prescription {
  id: string;
  medicines: Medicine[];
  notes?: string | null;
  createdAt: string;
  patient: Patient;
  doctor: DoctorProfile;
  dispensedAt?: string | null;
}

export interface PharmacyDispenseRecord {
  id: string;
  quantity: number;
  createdAt: string;
  item: { name: string; unit: string };
}

export interface PharmacyPrescription extends Prescription {
  dispenses?: PharmacyDispenseRecord[];
}

// Patient Portal — same records as above, but viewed by the patient across
// every clinic they've visited, so each row carries which clinic it's from.
export interface ClinicRef {
  name: string;
  slug?: string;
}

export interface PortalAppointment extends Omit<Appointment, "patient"> {
  clinic: ClinicRef;
}

export interface PortalPrescription extends Omit<Prescription, "patient"> {
  clinic: ClinicRef;
}

export interface PortalInvoice extends Omit<Invoice, "patient"> {
  clinic: ClinicRef;
}

export interface PortalClinic {
  id: string;
  name: string;
  slug: string;
}

export interface PortalDoctor {
  id: string;
  displayName: string;
  specialization?: string | null;
}

export type InventoryTransactionType = "RECEIVED" | "DISPENSED" | "ADJUSTED" | "EXPIRED" | "DAMAGED";

export interface InventoryItem {
  id: string;
  name: string;
  sku?: string | null;
  unit: string;
  category?: string | null;
  reorderLevel: number;
  isActive: boolean;
  currentStock: number;
  createdAt: string;
}

export interface InventoryTransactionRecord {
  id: string;
  type: InventoryTransactionType;
  quantity: number;
  reason?: string | null;
  createdAt: string;
}

export interface InventoryItemDetail extends InventoryItem {
  transactions: InventoryTransactionRecord[];
}
