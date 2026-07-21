import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import {
  AppointmentStatus,
  AppointmentType,
  NotificationChannel,
  NotificationType,
} from "@digital-clinic/database";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { computeAvailableSlots, resolveBranchForTime } from "../appointments/available-slots.util";
import { PortalBookAppointmentDto } from "./dto/book-appointment.dto";
import { PortalAvailableSlotsQueryDto } from "./dto/available-slots-query.dto";

const ACTIVE_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.PENDING,
  AppointmentStatus.CONFIRMED,
];

@Injectable()
export class PatientPortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, phone: true, createdAt: true },
    });
    if (!user) throw new NotFoundException("Account not found");
    return user;
  }

  /**
   * Every route below is scoped by `patient: { userId }` — a patient's
   * records live across potentially several per-clinic `Patient` rows (see
   * the schema comment on `Patient.userId`), so this is identity-scoped, not
   * clinic-scoped like every other module. There's no TenantGuard/clinicId
   * here because there's no single clinic to resolve.
   */
  myAppointments(userId: string) {
    return this.prisma.appointment.findMany({
      where: { patient: { userId } },
      include: { doctor: true, clinic: { select: { name: true, slug: true } } },
      orderBy: { scheduledAt: "desc" },
    });
  }

  myPrescriptions(userId: string) {
    return this.prisma.prescription.findMany({
      where: { patient: { userId } },
      include: { doctor: true, clinic: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  myInvoices(userId: string) {
    return this.prisma.invoice.findMany({
      where: { patient: { userId } },
      include: { clinic: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  /** Clinics with a published website — the only ones a patient can discover and book at. */
  listClinics() {
    return this.prisma.clinic.findMany({
      where: { website: { isPublished: true } },
      select: { id: true, name: true, slug: true },
      orderBy: { name: "asc" },
    });
  }

  listDoctors(clinicId: string) {
    return this.prisma.doctorProfile.findMany({
      where: { clinicId },
      select: { id: true, displayName: true, specialization: true },
    });
  }

  async availableSlots(query: PortalAvailableSlotsQueryDto) {
    const doctor = await this.prisma.doctorProfile.findFirst({
      where: { id: query.doctorId, clinicId: query.clinicId },
      include: { availabilities: true },
    });
    if (!doctor) throw new NotFoundException("Doctor not found");

    const date = new Date(`${query.date}T00:00:00`);
    const dayStart = new Date(date);
    const dayEnd = new Date(date);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const bookedAppointments = await this.prisma.appointment.findMany({
      where: {
        clinicId: query.clinicId,
        doctorId: query.doctorId,
        status: { in: ACTIVE_STATUSES },
        scheduledAt: { gte: dayStart, lt: dayEnd },
      },
      select: { scheduledAt: true },
    });
    const bookedTimes = new Set(bookedAppointments.map((a) => a.scheduledAt.toISOString()));

    return computeAvailableSlots(date, doctor.availabilities, bookedTimes);
  }

  /**
   * Books an appointment for the logged-in patient at a clinic of their
   * choosing. Finds or creates their per-clinic `Patient` row — a patient
   * can have one at several clinics (see the Patient model comment) — rather
   * than requiring clinic staff to have pre-registered them first.
   */
  async bookAppointment(userId: string, dto: PortalBookAppointmentDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException("Account not found");

    const clinic = await this.prisma.clinic.findFirst({
      where: { id: dto.clinicId, website: { isPublished: true } },
    });
    if (!clinic) throw new NotFoundException("Clinic not found");

    const doctor = await this.prisma.doctorProfile.findFirst({
      where: { id: dto.doctorId, clinicId: dto.clinicId },
      include: { availabilities: true },
    });
    if (!doctor) throw new NotFoundException("Doctor not found");

    const scheduledAt = new Date(dto.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) {
      throw new BadRequestException("Invalid scheduledAt date");
    }

    const branchId = resolveBranchForTime(scheduledAt, doctor.availabilities);

    const existingPatient = await this.prisma.patient.findFirst({
      where: { userId, clinicId: dto.clinicId },
    });
    const patient =
      existingPatient ??
      (await this.prisma.patient.create({
        data: {
          clinicId: dto.clinicId,
          userId,
          name: user.name ?? "Patient",
          email: user.email,
          phone: user.phone,
        },
      }));

    const appointment = await this.prisma.$transaction(async (tx) => {
      const conflict = await tx.appointment.findFirst({
        where: {
          clinicId: dto.clinicId,
          doctorId: dto.doctorId,
          scheduledAt,
          status: { in: ACTIVE_STATUSES },
        },
      });
      if (conflict) throw new ConflictException("That slot is no longer available");

      return tx.appointment.create({
        data: {
          clinicId: dto.clinicId,
          patientId: patient.id,
          doctorId: dto.doctorId,
          branchId,
          scheduledAt,
          type: AppointmentType.ONLINE,
          status: AppointmentStatus.CONFIRMED,
          reasonForVisit: dto.reasonForVisit,
        },
        include: { doctor: true, clinic: { select: { name: true } } },
      });
    });

    void this.notifications.send({
      clinicId: dto.clinicId,
      channel: NotificationChannel.EMAIL,
      type: NotificationType.APPOINTMENT_CONFIRMATION,
      recipient: user.email,
      subject: "Appointment confirmed",
      body: `Your appointment with ${appointment.doctor.displayName} at ${appointment.clinic.name} is confirmed for ${appointment.scheduledAt.toLocaleString()}.`,
    });

    return appointment;
  }
}
